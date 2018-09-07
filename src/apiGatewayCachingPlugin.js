'use strict';

// TODO async
const getRestApiId = (serverless) => {
  const stackName = serverless.providers.aws.naming.getStackName(serverless.service.provider.stage);
  return serverless.providers.aws.request('CloudFormation', 'describeStacks', { StackName: stackName },
    serverless.service.provider.stage,
    serverless.service.provider.region
  ).then((result) => {
    return result.Stacks[0].Outputs
      .filter(output => output.OutputKey === 'MyRestApiId')
      .map(output => output.OutputValue)[0];
  });
}

const configureApiGatewayCaching = async serverless => {
  let id = await getRestApiId(serverless);
  serverless.cli.log(`# After Deploy # Rest Api Id: ${id}`);
}

class ApiGatewayCachingPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:package:finalize': this.beforeDeploy.bind(this),
      'after:aws:deploy:finalize:cleanup': this.setApiGatewayCaching.bind(this),
    };
  }

  // TODO rename
  beforeDeploy() {
    let restApiId = {
      Ref: 'ApiGatewayRestApi',
    };

    // Use the provider API gateway if one has been provided.
    if (this.serverless.service.provider.apiGateway && this.serverless.service.provider.apiGateway.restApiId) {
      restApiId = this.serverless.service.provider.apiGateway.restApiId
    }

    this.serverless.service.provider.compiledCloudFormationTemplate.Outputs.MyRestApiId = {
      Description: 'Rest API Id',
      Value: restApiId,
    };
  }

  setApiGatewayCaching() {
    return configureApiGatewayCaching(this.serverless);
  }
}

module.exports = ApiGatewayCachingPlugin;
