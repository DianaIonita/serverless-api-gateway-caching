const isEmpty = require('lodash.isempty');

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
  if (isEmpty(lambdaResource)) {
    throw new Error('Something has gone wrong');
  }
  return lambdaResource[0];
}

const getApiGatewayMethodFor = (functionName, stage, serverless) => {
  const fullFunctionName = `${serverless.service.service}-${stage}-${functionName}`;
  const lambdaFunctionResource = getResourceForLambdaFunctionNamed(fullFunctionName, serverless);

  // returns the first method found which depends on this lambda
  const methods = getResourcesByType('AWS::ApiGateway::Method', serverless);
  for (let method of methods) {
    let stringified = JSON.stringify(method);
    if (stringified.lastIndexOf(`"${lambdaFunctionResource.name}"`) != -1) {
      return method;
    }
  }
}

const addPathParametersCacheConfig = (settings, serverless) => {
  for (let endpointSettings of settings.endpointSettings) {
    if (!endpointSettings.cacheKeyParameters) {
      continue;
    }
    const method = getApiGatewayMethodFor(endpointSettings.functionName, settings.stage, serverless);
    if (!method.resource.Properties.Integration.CacheKeyParameters) {
      method.resource.Properties.Integration.CacheKeyParameters = [];
    }
    if (!method.resource.Properties.Integration.RequestParameters) {
      method.resource.Properties.Integration.RequestParameters = {}
    }

    for (let cacheKeyParameter of endpointSettings.cacheKeyParameters) {
      let existingValue = method.resource.Properties.RequestParameters[`method.${cacheKeyParameter.name}`];
      method.resource.Properties.RequestParameters[`method.${cacheKeyParameter.name}`] = (existingValue == null || existingValue == undefined) ? {} : existingValue;
      method.resource.Properties.Integration.RequestParameters[`integration.${cacheKeyParameter.name}`] = `method.${cacheKeyParameter.name}`;
      method.resource.Properties.Integration.CacheKeyParameters.push(`method.${cacheKeyParameter.name}`);
    }
    method.resource.Properties.Integration.CacheNamespace = `${method.name}CacheNS`;
  }
}

module.exports = addPathParametersCacheConfig;
