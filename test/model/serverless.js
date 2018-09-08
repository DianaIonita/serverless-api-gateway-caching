class Serverless {
  constructor() {
    this.service = {
      custom: {}
    }
  }

  withApiGatewayCachingConfig(cachingEnabled, clusterSize, ttlInSeconds) {
    this.service.custom.apiGatewayCaching = {
      enabled: cachingEnabled,
      clusterSize,
      ttlInSeconds
    };

    return this;
  }
}

module.exports = Serverless;
