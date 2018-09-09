const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const addPathParametersCacheConfig = require(`${APP_ROOT}/src/pathParametersCache`);
const expect = require('chai').expect;

describe('Configuring path parameter caching', () => {
  let serverless, cacheSettings;

  describe('when there are no endpoints', () => {
    before(() => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 45);
      cacheSettings = new ApiGatewayCachingSettings(serverless);
    });

    it('should do nothing to the serverless instance', () => {
      let stringified = JSON.stringify(serverless);
      when_configuring_path_parameters(cacheSettings, serverless);
      let stringifiedAfter = JSON.stringify(serverless);
      expect(stringified).to.equal(stringifiedAfter);
    });
  });

  describe('when there are no endpoints with cache key parameters', () => {
    before(() => {
      let endpoint = given.a_serverless_function('get-cat-by-paw-id')
        .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true });
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .withFunction(endpoint);
      cacheSettings = new ApiGatewayCachingSettings(serverless);
    });

    it('should do nothing to the serverless instance', () => {
      let stringified = JSON.stringify(serverless);
      when_configuring_path_parameters(cacheSettings, serverless);
      let stringifiedAfter = JSON.stringify(serverless);
      expect(stringified).to.equal(stringifiedAfter);
    });
  });

  describe('when an endpoint has cache key parameters', () => {
    let cacheKeyParameters;
    before(() => {
      cacheKeyParameters = [
        { name: 'request.path.pawId', required: true },
        { name: 'request.header.Accept-Language', required: false }];
      let endpoint = given.a_serverless_function('get-cat-by-paw-id')
        .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, cacheKeyParameters });
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .withFunction(endpoint);
      cacheSettings = new ApiGatewayCachingSettings(serverless);

      when_configuring_path_parameters(cacheSettings, serverless);
    });

    it.only('should work', () => {
      expect(true).to.be.false;
    });
  });
});

const when_configuring_path_parameters = (settings, serverless) => {
  return addPathParametersCacheConfig(settings, serverless);
}
