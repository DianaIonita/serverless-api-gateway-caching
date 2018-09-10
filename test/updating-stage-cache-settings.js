const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const updateStageCacheSettings = require(`${APP_ROOT}/src/stageCache`);
const expect = require('chai').expect;

describe('Updating stage cache settings', () => {
  let serverless, settings;

  describe('When api gateway caching is not specified as a setting', () => {
    let recordedParams;
    before(() => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);
      serverless = given.a_serverless_instance();
    });
    it.skip('should not make calls to the AWS SDK');
  });

  describe('When api gateway caching is disabled', () => {
    let recordedParams;
    before(() => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(false);
    });

    it.only('should disable caching', () => {

    });
  });

  describe('When api gateway caching is enabled', () => {
    describe('and there are no endpoints for which to enable caching', () => {
      it('should enable stage-level caching');
      it('should set the correct cache cluster size');
      it('should set the correct cache time to live');
      it('should log a warning message that no endpoints are being cached');
    });

    describe('and there are some endpoints with caching enabled', () => {
      it('should enable stage-level caching');
      it('should set the correct cache cluster size');
      it('should set the correct cache time to live');

      describe('for each endpoint with caching enabled', () => {
        it('should enable caching');

        it('should set the correct cache time to live')
      });

      describe('for each endpoint with caching disabled', () => {
        it('should disable caching');
      });
    });
  });
});

const when_updating_stage_cache_settings = async (settings, serverless) => {
  return await updateStageCacheSettings(settings, serverless);
}
