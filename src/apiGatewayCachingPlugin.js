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

const configureApiGatewayCaching = async serverless => {
  //let restApiId = await getRestApiId(serverless);
  let restApiId = 'hg714gr6wl';

  AWS.config.update({
    region: serverless.service.provider.region,
  });

  const apiGateway = new AWS.APIGateway();
  let params = {
    restApiId,
    stageName: 'devdiana',
    patchOperations: [
      {
        op: 'replace',
        path: '/cacheClusterEnabled',
        value: 'true'
      },
      {
        op: 'replace',
        path: '/cacheClusterSize',
        value: '0.5'
      },
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
  console.log('Okay so far');

  // let template = {
  //   Resources: {
  //     ApiGatewayMethodCatsPawidVarGet: serverless.service.provider.compiledCloudFormationTemplate.Resources.ApiGatewayMethodCatsPawidVarGet
  //   }
  // };

  let method = serverless.service.provider.compiledCloudFormationTemplate.Resources.ApiGatewayMethodCatsPawidVarGet;
  method.Properties.RequestParameters = {
    "method.request.path.pawId": true,
    "method.request.header.Accept-Language": false
  };
  method.Properties.Integration.RequestParameters = {
    "integration.request.path.pawId": "method.request.path.pawId",
    "integration.request.header.Accept-Language": "method.request.header.Accept-Language"
  };
  method.Properties.Integration.CacheNamespace = "ApiGatewayMethodCatsPawidVarGetCacheNS";
  method.Properties.Integration.CacheKeyParameters = ["method.request.path.pawId", "method.request.header.Accept-Language"];

  // let params2 = {
  //   httpMethod: 'GET',
  //   restApiId,
  //   resourceId: '6b98bx', // TODO
  //   patchOperations: [
  //     // I tried this but then settled for referencing them in the serverless.yml under events/http/request/parameters/...
  //     // {
  //     //   op: 'replace',
  //     //   path: '/~1cats~1\{pawId\}/GET/requestParameters',
  //     //   value: '\{\"method.request.path.pawId\": \"true\",\"method.request.header.Accept-Language\": \"true\"\}'
  //     // },
  //     // {
  //     //   op: 'replace',
  //     //   path: '/~1cats~1/*/GET/requestParameters/method.request.path.pawId/caching/enabled',
  //     //   value: 'true'
  //     // },
  //     {
  //       op: 'replace',
  //       path: '/requestParameters',
  //       value: 'true'
  //     },
  //   ]
  // }

  // let result2 = await apiGateway.updateIntegration(params2).promise();
  // serverless.cli.log(`# Update Integration result: ${JSON.stringify(result2)}`);
  // console.log('Okay so far');

  // const templateBody = fs.readFileSync(`./node_modules/serverless-api-gateway-caching/src/cf.yml`, 'utf8');
  // let params2 = {
  //   StackName: `cat-api-devdiana`,
  //   TemplateBody: JSON.stringify(template)
  // }

  // const cloudformation = new AWS.CloudFormation();
  // let cfResponse = await cloudformation.updateStack(params2).promise();
  // console.log('Okay so far');
  // console.log(`Updating CloudFormation stack with Id ${cfResponse.StackId}...`);
  // let waitReq = {
  //   StackName: cfResponse.StackId
  // };
  // await cloudformation.waitFor('stackUpdateComplete', waitReq).promise();
  // console.log(`Done updating CloudFormation stack with Id ${cfResponse.StackId}`);
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

    for (let cacheKeyParameter of endpointSettings.cacheKeyParameters) {
      method.resource.Properties.RequestParameters[`method.${cacheKeyParameter.name}`] = cacheKeyParameter.required;
      method.resource.Properties.Integration.RequestParameters[`integration.${cacheKeyParameter.name}`] = `method.${cacheKeyParameter.name}`;
      method.resource.Properties.Integration.CacheKeyParameters.push(`method.${cacheKeyParameter.name}`);
    }
    method.resource.Properties.Integration.CacheNamespace = `${method.name}CacheNS`;
  }
}

const updateStageCacheSettings = async (settings, serverless) => {

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
