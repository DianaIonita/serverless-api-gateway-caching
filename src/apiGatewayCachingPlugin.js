'use strict';

const ApiGatewayCachingSettings = require('./apiGatewayCachingSettings');
const addPathParametersCacheConfig = require('./pathParametersCache');
const updateStageCacheSettings = require('./stageCache');

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
    this.serverless.service.provider.compiledCloudFormationTemplate.Outputs.RestApiIdForApiGwCaching = {
      Description: 'Rest API Id',
      Value: restApiId,
    };

    return addPathParametersCacheConfig(this.settings, this.serverless);
  }

  updateStage() {
    if (!this.settings.cachingEnabled) {
      return;
    }
    serverless.cli.log(`[serverless-api-gateway-caching] Updating API Gateway cache settings.`);
    return updateStageCacheSettings(this.settings, this.serverless).then(() => {
      serverless.cli.log(`[serverless-api-gateway-caching] Done updating API Gateway cache settings.`);
    });
  }
}

module.exports = ApiGatewayCachingPlugin;
