const chance = require('chance').Chance();
const pathParams = require(`../../src/pathParametersCache`);

class Serverless {
  constructor(serviceName) {
    this._logMessages = [];
    this._recordedAwsRequests = []
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

    let { functionResourceName, methodResourceName } = addFunctionToCompiledCloudFormationTemplate(serverlessFunction, this);
    if (!this._functionsToResourcesMapping) {
      this._functionsToResourcesMapping = {}
    }
    this._functionsToResourcesMapping[functionName] = {
      functionResourceName,
      methodResourceName
    }
    // when a function with an http endpoint is defined, serverless creates an ApiGatewayRestApi resource
    this.service.provider.compiledCloudFormationTemplate.Resources['ApiGatewayRestApi'] = {};
    return this;
  }

  withPredefinedRestApiId(restApiId) {
    if (!this.service.provider.apiGateway) {
      this.service.provider.apiGateway = {}
    }
    this.service.provider.apiGateway.restApiId = restApiId;
    return this;
  }

  getMethodResourceForFunction(functionName) {
    let { methodResourceName } = this._functionsToResourcesMapping[functionName];
    return this.service.provider.compiledCloudFormationTemplate.Resources[methodResourceName];
  }

  getMethodResourceForMethodName(methodResourceName) {
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
          this._recordedAwsRequests.push({ awsService, method, properties, stage, region });
          if (awsService == 'CloudFormation'
            && method == 'describeStacks'
            && properties.StackName == 'serverless-stack-name'
            && stage == settings.stage
            && region == settings.region) {
            return {
              Stacks: [
                {
                  Outputs: [{
                    OutputKey: 'RestApiIdForApigCaching',
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

  getRequestsToAws() {
    return this._recordedAwsRequests;
  }
}

const clone = object => JSON.parse(JSON.stringify(object));

const addFunctionToCompiledCloudFormationTemplate = (serverlessFunction, serverless) => {
  const functionName = Object.keys(serverlessFunction)[0];
  const fullFunctionName = `${serverless.service.service}-${serverless.service.provider.stage}-${functionName}`;
  let { Resources } = serverless.service.provider.compiledCloudFormationTemplate;
  let functionTemplate = clone(require('./templates/aws-lambda-function'));
  functionTemplate.Properties.FunctionName = fullFunctionName;
  let functionResourceName = `${functionName}LambdaFunction`;
  Resources[functionResourceName] = functionTemplate;

  let methodTemplate = clone(require('./templates/aws-api-gateway-method'));
  let stringifiedMethodTemplate = JSON.stringify(methodTemplate);
  stringifiedMethodTemplate = stringifiedMethodTemplate.replace('#{LAMBDA_RESOURCE_DEPENDENCY}', functionResourceName);
  methodTemplate = JSON.parse(stringifiedMethodTemplate);

  const events = serverlessFunction[functionName].events;
  if (!Array.isArray(events) || !events.length) {
    methodResourceName = `ApiGatewayMethod${functionName}VarGet`;
  } else {
    for (event of events) {
      const path = event.http.path;
      const method = event.http.method;
      methodResourceName = pathParams.getApiGatewayMethodNameFor(path, method);
      Resources[methodResourceName] = methodTemplate;
    }
  }

  Resources[methodResourceName] = methodTemplate
  return { functionResourceName, methodResourceName }
}

module.exports = Serverless;
