class Serverless {
  constructor(serviceName) {
    this._logMessages = [];
    this._recordedAwsRequests = [];
    this._mockedRequestsToAws = [];
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
    };

    this.providers = {
      aws: {
        naming: {
          getStackName: (stage) => {
            if (stage != this.service.provider.stage) {
              throw new Error('[Serverless Test Model] Something went wrong getting the Stack Name');
            }
            return 'serverless-stack-name';
          }
        },
        request: async (awsService, method, properties, stage, region) => {
          this._recordedAwsRequests.push({ awsService, method, properties, stage, region });

          if (awsService == 'APIGateway' && method == 'updateStage') {
            return;
          }

          const params = { awsService, method, properties, stage, region };
          const mockedFunction = this._mockedRequestsToAws[mockedRequestKeyFor(params)];
          if (!mockedFunction) {
            throw new Error(`[Serverless Test Model] No mock found for request to AWS { awsService = ${awsService}, method = ${method}, properties = ${JSON.stringify(properties)}, stage = ${stage}, region = ${region} }`)
          }
          const mockedResponse = mockedFunction(params);
          if (!mockedFunction) {
            throw new Error(`[Serverless Test Model] No mock response found for request to AWS { awsService = ${awsService}, method = ${method}, properties = ${JSON.stringify(properties)}, stage = ${stage}, region = ${region} }`)
          }
          return mockedResponse;
        }
      }
    }

    // add default mock for getStage
    this._mockedRequestsToAws[mockedRequestKeyFor({ awsService: 'APIGateway', method: 'getStage' })] = defaultMockedRequestToAWS;
  }

  forStage(stage) {
    this.service.provider.stage = stage;
    return this;
  }

  forRegion(region) {
    this.service.provider.region = region;
    return this;
  }

  withApiGatewayCachingConfig({ cachingEnabled = true, clusterSize = '0.5', ttlInSeconds = 45, perKeyInvalidation, dataEncrypted, apiGatewayIsShared,
    restApiId, basePath, endpointsInheritCloudWatchSettingsFromStage } = {}) {
    this.service.custom.apiGatewayCaching = {
      enabled: cachingEnabled,
      apiGatewayIsShared,
      restApiId,
      basePath,
      clusterSize,
      ttlInSeconds,
      perKeyInvalidation,
      dataEncrypted,
      endpointsInheritCloudWatchSettingsFromStage
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

  withAdditionalEndpoints(additionalEndpoints) {
    this.service.custom.apiGatewayCaching.additionalEndpoints = additionalEndpoints;
    // when a function with an http endpoint is defined, serverless creates an ApiGatewayRestApi resource
    this.service.provider.compiledCloudFormationTemplate.Resources['ApiGatewayRestApi'] = {};

    for (const additionalEndpointToAdd of additionalEndpoints) {

      let { additionalEndpoint, methodResourceName } = addAdditionalEndpointToCompiledCloudFormationTemplate(additionalEndpointToAdd, this);
      if (!this._additionalEndpointsToResourcesMapping) {
        this._additionalEndpointsToResourcesMapping = {}
      }
      this._additionalEndpointsToResourcesMapping[JSON.stringify(additionalEndpoint)] = {
        additionalEndpoint,
        methodResourceName
      }
    }
    return this;
  }

  withoutStageSettingsForCloudWatchMetrics() {
    const expectedAwsService = 'APIGateway';
    const expectedMethod = 'getStage';
    const mockedRequestToAws = ({ awsService, method, properties, stage, region }) => {
      if (awsService == 'APIGateway'
        && method == 'getStage'
        && properties.restApiId == this._restApiId
        && properties.stageName == this.service.provider.stage
        && region == this.service.provider.region) {
        return {
          methodSettings: {
          }
        };
      }
    };
    this._mockedRequestsToAws[mockedRequestKeyFor({ awsService: expectedAwsService, method: expectedMethod })] = mockedRequestToAws;
    return this;
  }

  withStageSettingsForCloudWatchMetrics({ loggingLevel, dataTraceEnabled, metricsEnabled } = {}) {
    const expectedAwsService = 'APIGateway';
    const expectedMethod = 'getStage';
    const mockedRequestToAws = ({ awsService, method, properties, stage, region }) => {
      if (awsService == 'APIGateway'
        && method == 'getStage'
        && properties.restApiId == this._restApiId
        && properties.stageName == this.service.provider.stage
        && region == this.service.provider.region) {
        return {
          methodSettings: {
            ['*/*']: {
              loggingLevel,
              dataTraceEnabled,
              metricsEnabled
            }
          }
        };
      }
    };
    this._mockedRequestsToAws[mockedRequestKeyFor({ awsService: expectedAwsService, method: expectedMethod })] = mockedRequestToAws;
    return this;
  }

  withProviderRestApiId(restApiId) {
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

  getMethodResourceForAdditionalEndpoint(additionalEndpoint) {
    let { methodResourceName } = this._additionalEndpointsToResourcesMapping[JSON.stringify(additionalEndpoint)];
    return this.service.provider.compiledCloudFormationTemplate.Resources[methodResourceName];
  }

  withRestApiId(restApiId) {
    this._restApiId = restApiId;
    const expectedAwsService = 'CloudFormation';
    const expectedMethod = 'describeStacks';
    const mockedRequestToAws = ({ awsService, method, properties, stage, region }) => {
      if (awsService == 'CloudFormation'
        && method == 'describeStacks'
        && properties.StackName == 'serverless-stack-name'
        && stage == this.service.provider.stage
        && region == this.service.provider.region) {
        const result = {
          Stacks: [{
            Outputs: [{
              OutputKey: 'RestApiIdForApigCaching',
              OutputValue: restApiId
            }]
          }]
        };
        return result;
      }
    };
    this._mockedRequestsToAws[mockedRequestKeyFor({ awsService: expectedAwsService, method: expectedMethod })] = mockedRequestToAws;
    return this;
  }

  getRequestsToAws() {
    return this._recordedAwsRequests;
  }
}

const clone = object => JSON.parse(JSON.stringify(object));

const createMethodResourceNameFor = (path, method) => {
  const pathElements = path.split('/');
  pathElements.push(method.toLowerCase());
  let gatewayResourceName = pathElements
    .map(element => {
      element = element.toLowerCase();
      element = element.replaceAll('+', '');
      element = element.replaceAll('_', '');
      element = element.replaceAll('.', '');
      element = element.replaceAll('-', 'Dash');
      if (element.startsWith('{')) {
        element = element.substring(element.indexOf('{') + 1, element.indexOf('}')) + "Var";
      }
      return element.charAt(0).toUpperCase() + element.slice(1);
    }).reduce((a, b) => a + b);

  gatewayResourceName = "ApiGatewayMethod" + gatewayResourceName;
  return gatewayResourceName;
}

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
      // if event is defined in shorthand
      let path, method;
      if (typeof (event.http) === 'string') {
        let parts = event.http.split(' ');
        method = parts[0];
        path = parts[1];
      }
      else {
        path = event.http.path;
        method = event.http.method;
      }
      methodResourceName = createMethodResourceNameFor(path, method);
      if (event.http.integration == 'lambda') {
        methodTemplate.Properties.Integration.Type = 'AWS_PROXY';
      } else {
        methodTemplate.Properties.Integration.Type = 'AWS';
      }
      Resources[methodResourceName] = methodTemplate;
    }
  }

  Resources[methodResourceName] = methodTemplate
  return { functionResourceName, methodResourceName }
}

const addAdditionalEndpointToCompiledCloudFormationTemplate = (additionalEndpoint, serverless) => {
  const { path, method } = additionalEndpoint;
  methodResourceName = createMethodResourceNameFor(path, method);

  let methodTemplate = clone(require('./templates/aws-api-gateway-method'));

  methodResourceName = createMethodResourceNameFor(path, method);

  let { Resources } = serverless.service.provider.compiledCloudFormationTemplate;
  Resources[methodResourceName] = methodTemplate
  return { additionalEndpoint, methodResourceName }
}

const mockedRequestKeyFor = ({ awsService, method }) => {
  return `${awsService}-${method}`;
}

const defaultMockedRequestToAWS = ({ awsService, method, properties, stage, region }) => {
  if (awsService == 'APIGateway'
    && method == 'getStage') {
    return {
      methodSettings: {
        ['*/*']: {
          loggingLevel: 'not set',
          dataTraceEnabled: 'not set',
          metricsEnabled: 'not set'
        }
      }
    };
  }
};

module.exports = Serverless;
