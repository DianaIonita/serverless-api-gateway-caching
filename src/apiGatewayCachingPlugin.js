'use strict';

const ApiGatewayCachingSettings = require('./ApiGatewayCachingSettings');
const pathParametersCache = require('./pathParametersCache');
const updateStageCacheSettings = require('./stageCache');
const { restApiExists, outputRestApiIdTo } = require('./restApiId');

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
    this.thereIsARestApi = restApiExists(this.serverless);
    if (!this.thereIsARestApi) {
      this.serverless.cli.log(`[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.`);
      return;
    }

    outputRestApiIdTo(this.serverless);

    // if caching is not defined or disabled
    if (!this.settings.cachingEnabled) {
      return;
    }

    return pathParametersCache.addPathParametersCacheConfig(this.settings, this.serverless);
  }

  updateStage() {
    this.thereIsARestApi = restApiExists(this.serverless);
    if (!this.thereIsARestApi) {
      this.serverless.cli.log(`[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.`);
      return;
    }

    if (!this.settings) {
      this.createSettings()
    }

    return updateStageCacheSettings(this.settings, this.serverless);
  }
}

module.exports = ApiGatewayCachingPlugin;
