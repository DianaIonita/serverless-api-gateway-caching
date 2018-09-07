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

class ApiGatewayCachingPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:package:initialize': this.beforePackageInitialize.bind(this),
      // 'before:package:finalize': this.beforeDeploy.bind(this),
      // 'after:aws:deploy:finalize:cleanup': this.setApiGatewayCaching.bind(this),
    };
  }

  // TODO rename
  beforePackageInitialize() {
    this.settings = new ApiGatewayCachingSettings(this.serverless);
    // let restApiId = {
    //   Ref: 'ApiGatewayRestApi',
    // };

    // // use the provided restApiId, if any
    // if (this.serverless.service.provider.apiGateway && this.serverless.service.provider.apiGateway.restApiId) {
    //   restApiId = this.serverless.service.provider.apiGateway.restApiId
    // }

    // // TODO rename var
    // this.serverless.service.provider.compiledCloudFormationTemplate.Outputs.MyRestApiId = {
    //   Description: 'Rest API Id',
    //   Value: restApiId,
    // };
  }

  beforePackageFinalize() {
    if (!this.settings.cachingEnabled) {
      return;
    }
    return configureApiGatewayCaching(this.serverless);
  }

  // setApiGatewayCaching() {
  //   return configureApiGatewayCaching(this.serverless);
  // }
}

module.exports = ApiGatewayCachingPlugin;
