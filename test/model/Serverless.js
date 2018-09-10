const chance = require('chance').Chance();

class Serverless {
  constructor(serviceName) {
    this.service = {
      service: serviceName,
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

    let { functionResourceName, methodResourceName } = addFunctionToCompiledCloudFormationTemplate(functionName, this);
    if (!this._functionsToResourcesMapping) {
      this._functionsToResourcesMapping = {}
    }
    this._functionsToResourcesMapping[functionName] = {
      functionResourceName,
      methodResourceName
    }
    return this;
  }

  getMethodResourceForFunction(functionName) {
    let { methodResourceName } = this._functionsToResourcesMapping[functionName];
    return this.service.provider.compiledCloudFormationTemplate.Resources[methodResourceName];
  }
}

const clone = object => JSON.parse(JSON.stringify(object));

const addFunctionToCompiledCloudFormationTemplate = (functionName, serverless) => {
  const fullFunctionName = `${serverless.service.service}-${serverless.service.provider.stage}-${functionName}`;
  let { Resources } = serverless.service.provider.compiledCloudFormationTemplate;
  let functionTemplate = clone(require('./templates/aws-lambda-function'));
  functionTemplate.Properties.FunctionName = fullFunctionName;
  let functionResourceName = chance.word({ length: 10 });
  Resources[functionResourceName] = functionTemplate;

  let methodTemplate = clone(require('./templates/aws-api-gateway-method'));
  let stringifiedMethodTemplate = JSON.stringify(methodTemplate);
  stringifiedMethodTemplate = stringifiedMethodTemplate.replace('#{LAMBDA_RESOURCE_DEPENDENCY}', functionResourceName);
  methodTemplate = JSON.parse(stringifiedMethodTemplate);
  methodResourceName = chance.word({ length: 12 });
  Resources[methodResourceName] = methodTemplate
  return { functionResourceName, methodResourceName }
}

module.exports = Serverless;
