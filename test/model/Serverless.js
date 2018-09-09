const addFunctionToCompiledCloudFormationTemplate = (functionName, serverless) => {

}

class Serverless {
  constructor() {
    this.service = {
      custom: {},
      provider: {
        compiledCloudFormationTemplate: {
          Resources: []
        }
      }
    }
  }

  forStage(stage) {
    this.service.provider.stage = stage;
    return this;
  }

  forRegion(region) {
    this.service.provider.region = region;
    return this;
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

    addFunctionToCompiledCloudFormationTemplate(functionName, this);
    return this;
  }
}
module.exports = Serverless;
