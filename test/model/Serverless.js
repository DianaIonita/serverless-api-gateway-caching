class Serverless {
  constructor() {
    this.service = {
      custom: {}
    }
  }
   withApiGatewayCachingConfig(cachingEnabled, clusterSize, ttlInSeconds) {
    this.service.custom.apiGatewayCaching = {
      enabled: cachingEnabled,
      clusterSize,
      ttlInSeconds
    };
     return this;
  }
   withFunction(serverlessFunction) {
    if (!this.service.functions) {
      this.service.functions = {};
    }
    let functionName = Object.keys(serverlessFunction)[0];
    this.service.functions[functionName] = serverlessFunction[functionName];
    return this;
  }
}
 module.exports = Serverless;
