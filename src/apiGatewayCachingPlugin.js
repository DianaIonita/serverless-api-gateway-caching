'use strict';

const ApiGatewayCachingSettings = require('./ApiGatewayCachingSettings');
const addPathParametersCacheConfig = require('./pathParametersCache');
const updateStageCacheSettings = require('./stageCache');
const { outputRestApiIdTo } = require('./restApiId');

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
    this.settings = new ApiGatewayCachingSettings(this.serverless, this.options);
  }

  updateCloudFormationTemplate() {
    this.thereIsARestApi = this.restApiExists();
    if (!this.thereIsARestApi) {
      this.serverless.cli.log(`[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.`);
      return;
    }

    outputRestApiIdTo(this.serverless);

    // if caching is not defined or disabled
    if (!this.settings.cachingEnabled) {
      return;
    }

    return addPathParametersCacheConfig(this.settings, this.serverless);
  }

  updateStage() {
    if (!this.thereIsARestApi) {
      this.serverless.cli.log(`[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.`);
      return;
    }
    return updateStageCacheSettings(this.settings, this.serverless);
  }

  restApiExists() {
    let resource = this.serverless.service.provider.compiledCloudFormationTemplate.Resources['ApiGatewayRestApi'];
    if (resource) {
      return true;
    }
    return false;
  }
}

module.exports = ApiGatewayCachingPlugin;
