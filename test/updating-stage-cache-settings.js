const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const updateStageCacheSettings = require(`${APP_ROOT}/src/stageCache`);
const expect = require('chai').expect;

describe('Updating stage cache settings', () => {
  let serverless, settings, recordedParams;

  describe('When api gateway caching is not specified as a setting', () => {
    before(async () => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);
      serverless = given.a_serverless_instance();
      settings = new ApiGatewayCachingSettings(serverless);
      await when_updating_stage_cache_settings(settings, serverless);
    });

    it('should not make calls to the AWS SDK', () => {
      expect(recordedParams).to.not.exist;
    });
  });

  describe('When api gateway caching is disabled', () => {
    let recordedParams, restApiId;
    before(async () => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(false)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);
    });

    describe.only('the request sent to AWS SDK to update stage', () => {
      it('should contain the Rest Api Id', () => {
        expect(recordedParams.restApiId).to.equal(restApiId);
      });

      it('should contain the stage name', () => {
        expect(recordedParams.stageName).to.equal('somestage');
      });

      it('should disable caching', () => {
        expect(recordedParams.patchOperations).to.have.lengthOf(1);
        let patch = recordedParams.patchOperations[0];
        expect(patch).to.deep.equal({
          op: 'replace',
          path: '/cacheClusterEnabled',
          value: 'false'
        });
      });
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
