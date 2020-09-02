const split = require('lodash.split');

const getResourcesByName = (name, serverless) => {
  let resourceKeys = Object.keys(serverless.service.provider.compiledCloudFormationTemplate.Resources);
  for (let resourceName of resourceKeys) {
    if (resourceName == name) {
      return serverless.service.provider.compiledCloudFormationTemplate.Resources[resourceName];
    }
  }
}

const getApiGatewayMethodNameFor = (path, httpMethod) => {
  const pathElements = split(path, '/');
  pathElements.push(httpMethod.toLowerCase());
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
      //capitalize first letter
      return element.charAt(0).toUpperCase() + element.slice(1);
    }).reduce((a, b) => a + b);

  gatewayResourceName = "ApiGatewayMethod" + gatewayResourceName;
  return gatewayResourceName;
}

const addPathParametersCacheConfig = (settings, serverless) => {
  for (let endpointSettings of settings.endpointSettings) {
    if (!endpointSettings.cacheKeyParameters) {
      continue;
    }
    const resourceName = getApiGatewayMethodNameFor(endpointSettings.path, endpointSettings.method);
    const method = getResourcesByName(resourceName, serverless);
    if (!method) {
      serverless.cli.log(`[serverless-api-gateway-caching] The method ${resourceName} couldn't be found in the
                           compiled CloudFormation template. Caching settings will not be updated for this endpoint.`);
      continue;
    }
    if (!method.Properties.Integration.CacheKeyParameters) {
      method.Properties.Integration.CacheKeyParameters = [];
    }
    if (!method.Properties.Integration.RequestParameters) {
      method.Properties.Integration.RequestParameters = {}
    }

    for (let cacheKeyParameter of endpointSettings.cacheKeyParameters) {
      if (!cacheKeyParameter.mappedFrom) {
        let existingValue = method.Properties.RequestParameters[`method.${cacheKeyParameter.name}`];
        method.Properties.RequestParameters[`method.${cacheKeyParameter.name}`] = (existingValue == null || existingValue == undefined) ? {} : existingValue;

        if (method.Properties.Integration.Type !== 'AWS_PROXY') {
          method.Properties.Integration.RequestParameters[`integration.${cacheKeyParameter.name}`] = `method.${cacheKeyParameter.name}`;
        }

        method.Properties.Integration.CacheKeyParameters.push(`method.${cacheKeyParameter.name}`);
      } else {
        let existingValue = method.Properties.RequestParameters[cacheKeyParameter.mappedFrom];
        if (
          cacheKeyParameter.mappedFrom.includes('method.request.querystring') ||
          cacheKeyParameter.mappedFrom.includes('method.request.header') ||
          cacheKeyParameter.mappedFrom.includes('method.request.path')
        ) {
          method.Properties.RequestParameters[cacheKeyParameter.mappedFrom] = (existingValue == null || existingValue == undefined) ? {} : existingValue;
        }
        if (method.Properties.Integration.Type !== 'AWS_PROXY') {
          method.Properties.Integration.RequestParameters[cacheKeyParameter.name] = cacheKeyParameter.mappedFrom;
        }
        method.Properties.Integration.CacheKeyParameters.push(cacheKeyParameter.name)
      }
    }
    method.Properties.Integration.CacheNamespace = `${resourceName}CacheNS`;
  }
}

module.exports = {
  addPathParametersCacheConfig: addPathParametersCacheConfig,
  getApiGatewayMethodNameFor: getApiGatewayMethodNameFor
}
