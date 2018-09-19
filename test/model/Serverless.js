const chance = require('chance').Chance();

class Serverless {
  constructor(serviceName) {
    this._logMessages = [];
    this.cli = {
      log: (logMessage) => {
        this._logMessages.push(logMessage);
      }
    };
    this.service = {
      service: serviceName,
      custom: {},
      provider: {
        compiledCloudFormationTemplate: {
          Resources: []
        }
      },
      getFunction(functionName) {
        return this.functions[functionName];
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

  withApiGatewayCachingConfig(cachingEnabled, clusterSize, ttlInSeconds, perKeyInvalidation) {
    this.service.custom.apiGatewayCaching = {
      enabled: cachingEnabled,
      clusterSize,
      ttlInSeconds,
      perKeyInvalidation
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

  setRestApiId(restApiId, settings) {
    this.providers = {
      aws: {
        naming: {
          getStackName: (stage) => {
            if (stage != settings.stage) {
              throw new Error('[Serverless Test Model] Something went wrong getting the Stack Name');
            }
            return 'serverless-stack-name';
          }
        },
        request: async (awsService, method, properties, stage, region) => {
          if (awsService != 'CloudFormation'
            || method != 'describeStacks'
            || properties.StackName != 'serverless-stack-name'
            || stage != settings.stage
            || region != settings.region) {
            throw new Error('[Serverless Test Model] Something went wrong getting the Rest Api Id');
          }

          return {
            Stacks: [
              {
                Outputs: [{
                  OutputKey: 'RestApiIdForApiGwCaching',
                  OutputValue: restApiId
                }]
              }
            ]
          };
        }
      }
    }
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
