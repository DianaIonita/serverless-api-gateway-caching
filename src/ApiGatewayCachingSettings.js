const isEmpty = require('lodash.isempty');
const get = require('lodash.get');
const { Ignore, IgnoreWithWarning, Fail } = require('./UnauthorizedCacheControlHeaderStrategy');

const DEFAULT_CACHE_CLUSTER_SIZE = '0.5';
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

const isApiGatewayEndpoint = functionSettings => {
  if (isEmpty(functionSettings.events)) {
    return false;
  }
  return functionSettings.events.filter(e => e.http != null).length > 0;
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
  constructor(functionName, functionSettings, globalSettings) {
    this.functionName = functionName;

    // TODO multiple http endpoints
    let cachingConfig = functionSettings.events.filter(e => e.http != null)[0].http.caching;
    if (!cachingConfig) {
      this.cachingEnabled = false;
      return;
    }
    this.cachingEnabled = globalSettings.cachingEnabled ? cachingConfig.enabled : false;
    this.cacheTtlInSeconds = cachingConfig.ttlInSeconds || globalSettings.cacheTtlInSeconds;
    this.cacheKeyParameters = cachingConfig.cacheKeyParameters;

    if (!cachingConfig.perKeyInvalidation) {
      this.perKeyInvalidation = globalSettings.perKeyInvalidation;
    } else {
      this.perKeyInvalidation = new PerKeyInvalidationSettings(cachingConfig);
    }
  }
}

class ApiGatewayCachingSettings {
  constructor(serverless, options) {
    if (!get(serverless, 'service.custom.apiGatewayCaching')) {
      return;
    }
    this.cachingEnabled = serverless.service.custom.apiGatewayCaching.enabled;

    if (options) {
      this.stage = options.stage || serverless.service.provider.stage;
      this.region = options.region || serverless.service.provider.region;
    } else {
      this.stage = serverless.service.provider.stage;
      this.region = serverless.service.provider.region;
    }

    this.endpointSettings = [];

    this.cacheClusterSize = serverless.service.custom.apiGatewayCaching.clusterSize || DEFAULT_CACHE_CLUSTER_SIZE;
    this.cacheTtlInSeconds = serverless.service.custom.apiGatewayCaching.ttlInSeconds || DEFAULT_TTL;

    this.perKeyInvalidation = new PerKeyInvalidationSettings(serverless.service.custom.apiGatewayCaching);

    for (let functionName in serverless.service.functions) {
      let functionSettings = serverless.service.functions[functionName];
      if (isApiGatewayEndpoint(functionSettings)) {
        this.endpointSettings.push(new ApiGatewayEndpointCachingSettings(functionName, functionSettings, this))
      }
    }
  }
}

module.exports = ApiGatewayCachingSettings
