const getResourcesByName = (name, serverless) => {
  let resourceKeys = Object.keys(serverless.service.provider.compiledCloudFormationTemplate.Resources);
  for (let resourceName of resourceKeys) {
    if (resourceName == name) {
      return serverless.service.provider.compiledCloudFormationTemplate.Resources[resourceName];
    }
  }
}

const applyCacheKeyParameterSettings = (settings, serverless) => {
  for (let endpointSettings of settings) {
    if (!endpointSettings.cacheKeyParameters) {
      continue;
    }
    const method = getResourcesByName(endpointSettings.gatewayResourceName, serverless);
    if (!method) {
      serverless.cli.log(`[serverless-api-gateway-caching] The method ${endpointSettings.gatewayResourceName} couldn't be found in the
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
        method.Properties.RequestParameters[`method.${cacheKeyParameter.name}`] = (existingValue == null || existingValue == undefined) ? false : existingValue;

        // without this check, endpoints 500 when using cache key parameters like "Authorization" or headers with the same characters in different casing (e.g. "origin" and "Origin")
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
          method.Properties.RequestParameters[cacheKeyParameter.mappedFrom] = (existingValue == null || existingValue == undefined) ? false : existingValue;
        }

        // in v1.8.0 "lambda" integration check was removed because setting cache key parameters seemed to work for both AWS_PROXY and AWS (lambda) integration
        // reconsider if this becomes an issue

        // if (method.Properties.Integration.Type !== 'AWS_PROXY') {
        method.Properties.Integration.RequestParameters[cacheKeyParameter.name] = cacheKeyParameter.mappedFrom;
        // }
        method.Properties.Integration.CacheKeyParameters.push(cacheKeyParameter.name)
      }
    }
    method.Properties.Integration.CacheNamespace = `${endpointSettings.gatewayResourceName}CacheNS`;
  }
}
const addCacheKeyParametersConfig = (settings, serverless) => {
  applyCacheKeyParameterSettings(settings.endpointSettings, serverless);
  applyCacheKeyParameterSettings(settings.additionalEndpointSettings, serverless);
}

module.exports = {
  addCacheKeyParametersConfig: addCacheKeyParametersConfig
}
