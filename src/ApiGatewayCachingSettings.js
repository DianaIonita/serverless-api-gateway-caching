const isEmpty = require('lodash.isempty');
const get = require('lodash.get');

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
  }
}

class ApiGatewayCachingSettings {
  constructor(serverless, options) {
    const DEFAULT_CACHE_CLUSTER_SIZE = '0.5';
    const DEFAULT_TTL = 3600;
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

    for (let functionName in serverless.service.functions) {
      let functionSettings = serverless.service.functions[functionName];
      if (this.isApiGatewayEndpoint(functionSettings)) {
        this.endpointSettings.push(new ApiGatewayEndpointCachingSettings(functionName, functionSettings, this))
      }
    }
  }

  isApiGatewayEndpoint(functionSettings) {
    if (isEmpty(functionSettings.events)) {
      return false;
    }
    return functionSettings.events.filter(e => e.http != null).length > 0;
  }
}
module.exports = ApiGatewayCachingSettings
