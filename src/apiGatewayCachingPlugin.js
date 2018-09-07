'use strict';

const AWS = require('aws-sdk');
const ApiGatewayCachingSettings = require('./apiGatewayCachingSettings');

const getRestApiId = async serverless => {
  const stackName = serverless.providers.aws.naming.getStackName(serverless.service.provider.stage);

  let stack = await serverless.providers.aws.request('CloudFormation', 'describeStacks', { StackName: stackName },
    serverless.service.provider.stage,
    serverless.service.provider.region
  );

  return stack.Stacks[0].Outputs
    .filter(output => output.OutputKey === 'MyRestApiId')
    .map(output => output.OutputValue)[0];
}

const getResourcesByType = (type, serverless) => {
  let result = []
  let resourceKeys = Object.keys(serverless.service.provider.compiledCloudFormationTemplate.Resources);
  for (let resourceName of resourceKeys) {
    let resource = serverless.service.provider.compiledCloudFormationTemplate.Resources[resourceName];
    if (resource.Type == type) {
      result.push({ name: resourceName, resource });
    }
  }
  return result;
}

const getResourceForLambdaFunctionNamed = (fullFunctionName, serverless) => {
  let lambdaResource = getResourcesByType('AWS::Lambda::Function', serverless).filter(r => r.resource.Properties.FunctionName == fullFunctionName);
  // TODO check empty
  if (!lambdaResource || lambdaResource.length == 0) {
    throw new Error('Something has gone wrong');
  }
  return lambdaResource[0];
}

const getApiGatewayMethodFor = (functionName, serverless) => {
  const fullFunctionName = `${serverless.service.service}-${serverless.service.custom.stage}-${functionName}`;
  const lambdaFunctionResource = getResourceForLambdaFunctionNamed(fullFunctionName, serverless);

  // returns the first method found which depends on this lambda
  const methods = getResourcesByType('AWS::ApiGateway::Method', serverless);
  for (let method of methods) {
    let stringified = JSON.stringify(method);
    if (stringified.lastIndexOf(lambdaFunctionResource.name) != -1) {
      return method;
    }
  }
}

const updateCompiledTemplateWithCaching = (settings, serverless) => {
  for (let endpointSettings of settings.endpointSettings) {
    if (!endpointSettings.cacheKeyParameters) {
      continue;
    }
    const method = getApiGatewayMethodFor(endpointSettings.functionName, serverless);
    if (!method.resource.Properties.Integration.CacheKeyParameters) {
      method.resource.Properties.Integration.CacheKeyParameters = [];
    }
    if (!method.resource.Properties.Integration.RequestParameters) {
      method.resource.Properties.Integration.RequestParameters = {}
    }

    for (let cacheKeyParameter of endpointSettings.cacheKeyParameters) {
      method.resource.Properties.RequestParameters[`method.${cacheKeyParameter.name}`] = cacheKeyParameter.required;
      method.resource.Properties.Integration.RequestParameters[`integration.${cacheKeyParameter.name}`] = `method.${cacheKeyParameter.name}`;
      method.resource.Properties.Integration.CacheKeyParameters.push(`method.${cacheKeyParameter.name}`);
    }
    method.resource.Properties.Integration.CacheNamespace = `${method.name}CacheNS`;
  }
}

const createPatchForStage = (settings) => {
  return [
    {
      op: 'replace',
      path: '/cacheClusterEnabled',
      value: `${settings.cachingEnabled}`
    },
    {
      op: 'replace',
      path: '/cacheClusterSize',
      value: `${settings.cacheClusterSize}`
    }
  ]
}

const createPatchForEndpoint = (settings, endpointSettings, serverless) => {

}

const updateStageCacheSettings = async (settings, serverless) => {
  let restApiId = await getRestApiId(serverless);

  AWS.config.update({
    region: serverless.service.custom.region,
  });

  let patchOps = [createPatchForStage(settings)];
  for (let endpointSettings of settings.endpointSettings) {
    let endpointPatch = createPatchForEndpoint(settings, endpointSettings, serverless);
    patchOps = patchOps.concat(endpointPatch);
  }
  const apiGateway = new AWS.APIGateway();
  let params = {
    restApiId,
    stageName: serverless.service.custom.stage,
    patchOperations: [
      // {
      //   op: 'replace',
      //   path: '/cacheClusterEnabled',
      //   value: 'true'
      // },
      // {
      //   op: 'replace',
      //   path: '/cacheClusterSize',
      //   value: '0.5'
      // },
      {
        op: 'replace',
        path: '/cats/GET/caching/enabled',
        value: 'true'
      },
      {
        op: 'replace',
        path: '/cats/GET/caching/ttlInSeconds',
        value: '10'
      },
      {
        op: 'replace',
        path: '/~1cats~1\{pawId\}/GET/caching/enabled',
        value: 'true'
      },
      {
        op: 'replace',
        path: '/~1cats~1\{pawId\}/GET/caching/ttlInSeconds',
        value: '15'
      }
    ]
  }
  let result = await apiGateway.updateStage(params).promise();
  serverless.cli.log(`# Update Stage result: ${JSON.stringify(result)}`);
}

class ApiGatewayCachingPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:package:initialize': this.createSettings.bind(this),
      'before:package:finalize': this.updateCloudFormationTemplate.bind(this),
      'after:aws:deploy:finalize:cleanup': this.updateStage.bind(this),
    };
  }

  // TODO rename
  createSettings() {
    this.settings = new ApiGatewayCachingSettings(this.serverless);
  }

  updateCloudFormationTemplate() {
    if (!this.settings.cachingEnabled) {
      return;
    }

    let restApiId = {
      Ref: 'ApiGatewayRestApi',
    };
    if (this.serverless.service.provider.apiGateway && this.serverless.service.provider.apiGateway.restApiId) {
      restApiId = this.serverless.service.provider.apiGateway.restApiId
    }
    // TODO rename var
    this.serverless.service.provider.compiledCloudFormationTemplate.Outputs.MyRestApiId = {
      Description: 'Rest API Id',
      Value: restApiId,
    };

    return updateCompiledTemplateWithCaching(this.settings, this.serverless);
  }

  updateStage() {
    if (!this.settings.cachingEnabled) {
      return;
    }

    return updateStageCacheSettings(this.settings, this.serverless);
  }
}

module.exports = ApiGatewayCachingPlugin;
