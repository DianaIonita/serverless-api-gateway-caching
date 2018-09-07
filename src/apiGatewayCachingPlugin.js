'use strict';

const AWS = require('aws-sdk');

// TODO async
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

  // let params2 = {
  //   httpMethod: 'GET',
  //   restApiId,
  //   resourceId: '6b98bx',
  //   patchOperations: [
  //     {
  //       op: 'replace',
  //       path: '/~1cats~1\{pawId\}/GET/requestParameters/method.request.path.pawId',
  //       value: 'true'
  //       //value: '\{\"method.request.path.pawId\": \"true\",\"method.request.header.Accept-Language\": \"true\"\}'
  //     }
  //   ]
  // }

  // let result2 = await apiGateway.updateIntegration(params2).promise();
  // serverless.cli.log(`# Update Integration result: ${JSON.stringify(result2)}`);
  console.log('Okay so far');
}

class ApiGatewayCachingPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:package:finalize': this.beforeDeploy.bind(this),
      // 'after:aws:deploy:finalize:cleanup': this.setApiGatewayCaching.bind(this),
    };
  }

  // TODO rename
  beforeDeploy() {
    let restApiId = {
      Ref: 'ApiGatewayRestApi',
    };
    
    // use the provided restApiId, if any
    if (this.serverless.service.provider.apiGateway && this.serverless.service.provider.apiGateway.restApiId) {
      restApiId = this.serverless.service.provider.apiGateway.restApiId
    }
    
    // TODO rename var
    this.serverless.service.provider.compiledCloudFormationTemplate.Outputs.MyRestApiId = {
      Description: 'Rest API Id',
      Value: restApiId,
    };
    
    return configureApiGatewayCaching(this.serverless);
  }

  // setApiGatewayCaching() {
  //   return configureApiGatewayCaching(this.serverless);
  // }
}

module.exports = ApiGatewayCachingPlugin;
