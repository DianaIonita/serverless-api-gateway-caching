const get = require('lodash.get');
const { Ignore, IgnoreWithWarning, Fail } = require('./UnauthorizedCacheControlHeaderStrategy');

const DEFAULT_CACHE_CLUSTER_SIZE = '0.5';
const DEFAULT_DATA_ENCRYPTED = false;
const DEFAULT_TTL = 3600;
const DEFAULT_UNAUTHORIZED_INVALIDATION_REQUEST_STRATEGY = IgnoreWithWarning;

const mapUnauthorizedRequestStrategy = strategy => {
  if (!strategy) {
    return DEFAULT_UNAUTHORIZED_INVALIDATION_REQUEST_STRATEGY;
  }
  switch (strategy.toLowerCase()) {
    case 'ignore': return Ignore;
    case 'ignorewithwarning': return IgnoreWithWarning;
    case 'fail': return Fail;
    default: return DEFAULT_UNAUTHORIZED_INVALIDATION_REQUEST_STRATEGY;
  }
}

const isApiGatewayEndpoint = event => {
  return event.http ? true : false;
}

class PerKeyInvalidationSettings {
  constructor(cachingSettings) {
    let { perKeyInvalidation } = cachingSettings;
    if (!perKeyInvalidation) {
      this.requireAuthorization = true;
      this.handleUnauthorizedRequests = DEFAULT_UNAUTHORIZED_INVALIDATION_REQUEST_STRATEGY;
    }
    else {
      this.requireAuthorization = perKeyInvalidation.requireAuthorization
      if (perKeyInvalidation.requireAuthorization) {
        this.handleUnauthorizedRequests =
          mapUnauthorizedRequestStrategy(perKeyInvalidation.handleUnauthorizedRequests);
      }
    }
  }
}

class ApiGatewayEndpointCachingSettings {
  constructor(functionName, event, globalSettings) {
    this.functionName = functionName;

    if (typeof (event.http) === 'string') {
      let parts = event.http.split(' ');
      this.method = parts[0];
      this.path = parts[1];
    }
    else {
      this.path = event.http.path;
      this.method = event.http.method;
    }

    if (this.path.endsWith('/') && this.path.length > 1) {
      this.path = this.path.slice(0, -1);
    }

    if (!event.http.caching) {
      this.cachingEnabled = false;
      return;
    }
    let cachingConfig = event.http.caching;
    this.cachingEnabled = globalSettings.cachingEnabled ? cachingConfig.enabled : false;
    this.dataEncrypted = cachingConfig.dataEncrypted || globalSettings.dataEncrypted;
    this.cacheTtlInSeconds = cachingConfig.ttlInSeconds >= 0 ? cachingConfig.ttlInSeconds : globalSettings.cacheTtlInSeconds;
    this.cacheKeyParameters = cachingConfig.cacheKeyParameters;

    if (!cachingConfig.perKeyInvalidation) {
      this.perKeyInvalidation = globalSettings.perKeyInvalidation;
    } else {
      this.perKeyInvalidation = new PerKeyInvalidationSettings(cachingConfig);
    }
  }
}

class ApiGatewayAdditionalEndpointCachingSettings {
  constructor(method, path, caching, globalSettings) {
    this.method = method;
    this.path = path;
    this.cachingEnabled = globalSettings.cachingEnabled ? get(caching, 'enabled', false) : false;
    if (caching) {
      this.cacheTtlInSeconds = caching.ttlInSeconds >= 0 ? caching.ttlInSeconds : globalSettings.cacheTtlInSeconds;
    }
    this.dataEncrypted = get(caching, 'dataEncrypted', globalSettings.dataEncrypted);
  }
}

class ApiGatewayCachingSettings {
  constructor(serverless, options) {
    if (!get(serverless, 'service.custom.apiGatewayCaching')) {
      return;
    }
    const cachingSettings = serverless.service.custom.apiGatewayCaching;
    this.cachingEnabled = cachingSettings.enabled;
    this.apiGatewayIsShared = cachingSettings.apiGatewayIsShared;

    if (options) {
      this.stage = options.stage || serverless.service.provider.stage;
      this.region = options.region || serverless.service.provider.region;
    } else {
      this.stage = serverless.service.provider.stage;
      this.region = serverless.service.provider.region;
    }

    this.endpointSettings = [];
    this.additionalEndpointSettings = [];

    this.cacheClusterSize = cachingSettings.clusterSize || DEFAULT_CACHE_CLUSTER_SIZE;
    this.cacheTtlInSeconds = cachingSettings.ttlInSeconds >= 0 ? cachingSettings.ttlInSeconds : DEFAULT_TTL;
    this.dataEncrypted = cachingSettings.dataEncrypted || DEFAULT_DATA_ENCRYPTED;

    const additionalEndpoints = cachingSettings.additionalEndpoints || [];
    for (let additionalEndpoint of additionalEndpoints) {
      const { method, path, caching } = additionalEndpoint;

      this.additionalEndpointSettings.push(new ApiGatewayAdditionalEndpointCachingSettings(method, path, caching, this))
    }

    this.perKeyInvalidation = new PerKeyInvalidationSettings(cachingSettings);

    for (let functionName in serverless.service.functions) {
      let functionSettings = serverless.service.functions[functionName];
      for (let event in functionSettings.events) {
        if (isApiGatewayEndpoint(functionSettings.events[event])) {
          this.endpointSettings.push(new ApiGatewayEndpointCachingSettings(functionName, functionSettings.events[event], this))
        }
      }
    }
  }
}

module.exports = ApiGatewayCachingSettings
