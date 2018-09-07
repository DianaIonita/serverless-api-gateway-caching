class ApiGatewayEndpointCachingSettings {
  constructor(functionName, functionSettings) {
    this.functionName = functionName;

    // TODO multiple http endpoints
    let cachingConfig = functionSettings.events.filter(e => e.http != null)[0].http.caching;
    if (!cachingConfig) {
      this.cachingEnabled = false;
    }
    this.cachingEnabled = cachingConfig.enabled;
    this.cacheTtlInSeconds = cachingConfig.ttlInSeconds;
    this.cacheKeyParameters = cachingConfig.cacheKeyParameters;
  }
}

class ApiGatewayCachingSettings {
  constructor(serverless) {
    if (!serverless.service.custom.apiGatewayCaching) {
      this.cachingEnabled = false;
      return;
    }
    this.cachingEnabled = serverless.service.custom.apiGatewayCaching.enabled;
    this.cacheClusterSize = serverless.service.custom.apiGatewayCaching.clusterSize;
    this.cacheTtlInSeconds = serverless.service.custom.apiGatewayCaching.ttlInSeconds;

    this.endpointSettings = [];
    for (let functionName in serverless.service.functions) {
      let functionSettings = serverless.service.functions[functionName];
      if (this.isApiGatewayEndpoint(functionSettings)) {
        this.endpointSettings.push(new ApiGatewayEndpointCachingSettings(functionName, functionSettings))
      }
    }
  }

  isApiGatewayEndpoint(functionSettings) {
    // TODO isEmpty
    if (!functionSettings.events) {
      return false;
    }
    return functionSettings.events.filter(e => e.http != null).length > 0;
  }
}
module.exports = ApiGatewayCachingSettings
