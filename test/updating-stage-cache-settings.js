const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const teardown = require(`${APP_ROOT}/test/steps/teardown`);
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
    let restApiId;
    before(async () => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(false)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);
    });

    after(() => {
      teardown.unmock_aws_sdk();
    });

    describe('the request sent to AWS SDK to update stage', () => {
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
    let restApiId;

    describe('and there are no endpoints for which to enable caching', () => {
      before(async () => {
        given.api_gateway_update_stage_is_mocked(r => recordedParams = r);
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 60)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);
      });

      after(() => {
        teardown.unmock_aws_sdk();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        it('should contain the Rest Api Id', () => {
          expect(recordedParams.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(recordedParams.stageName).to.equal('somestage');
        });

        it('should specify exactly two patch operations', () => {
          expect(recordedParams.patchOperations).to.have.lengthOf(2);
        })

        it('should enable caching', () => {
          expect(recordedParams.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterEnabled',
            value: 'true'
          });
        });

        it('should set the cache cluster size', () => {
          expect(recordedParams.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterSize',
            value: '0.5'
          });
        });

        it('should log a warning message that no endpoints are being cached', () => {
          expect(serverless._logMessages).to
            .include('[serverless-api-gateway-caching] [WARNING] API Gateway caching is enabled but none of the endpoints have caching enabled');
        });
      });
    });

    describe('and there are some endpoints with caching enabled', () => {
      before(async () => {
        given.api_gateway_update_stage_is_mocked(r => recordedParams = r);

        let endpointWithoutCaching = given.a_serverless_function('get-my-cat')
          .withHttpEndpoint('get', '/personal/cat', { enabled: false });
        let endpointWithCaching = given.a_serverless_function('get-cat-by-paw-id')
          .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, ttlInSeconds: 45 });
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 60)
          .withFunction(endpointWithCaching)
          .withFunction(endpointWithoutCaching)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);
      });

      after(() => {
        teardown.unmock_aws_sdk();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        it('should contain the Rest Api Id', () => {
          expect(recordedParams.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(recordedParams.stageName).to.equal('somestage');
        });

        it('should enable caching', () => {
          expect(recordedParams.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterEnabled',
            value: 'true'
          });
        });

        it('should set the cache cluster size', () => {
          expect(recordedParams.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterSize',
            value: '0.5'
          });
        });

        describe('for the endpoint with caching enabled', () => {
          it('should enable caching', () => {
            expect(recordedParams.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/enabled',
              value: 'true'
            });
          });

          it('should set the correct cache time to live', () => {
            expect(recordedParams.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/ttlInSeconds',
              value: '45'
            });
          });
        });

        describe('for each endpoint with caching disabled', () => {
          it('should disable caching', () => {
            expect(recordedParams.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1personal~1cat/GET/caching/enabled',
              value: 'false'
            });
          });

          it('should not set the cache time to live', () => {
            let ttlOperation = recordedParams.patchOperations
              .find(o => o.path == '/~personal~1cat/GET/caching/ttlInSeconds');
            expect(ttlOperation).to.not.exist;
          });
        });
      });
    });
  });

  describe('When an endpoint with http method `any` has caching enabled', () => {
    before(async () => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);

      let endpointWithCaching = given.a_serverless_function('do-anything-to-cat')
        .withHttpEndpoint('any', '/cat', { enabled: true, ttlInSeconds: 45 });

      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 60)
        .withFunction(endpointWithCaching)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);
    });

    after(() => {
      teardown.unmock_aws_sdk();
    });

    it('should enable caching for the GET method', () => {
      expect(recordedParams.patchOperations).to.deep.include({
        op: 'replace',
        path: '/~1cat/GET/caching/enabled',
        value: 'true'
      });
    });

    it('should set the correct time to live for the GET method cache', () => {
      expect(recordedParams.patchOperations).to.deep.include({
        op: 'replace',
        path: '/~1cat/GET/caching/ttlInSeconds',
        value: '45'
      });
    });

    let otherMethods = ['DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
    for (let method of otherMethods) {
      it(`should disable caching for the ${method} method`, () => {
        expect(recordedParams.patchOperations).to.deep.include({
          op: 'replace',
          path: `/~1cat/${method}/caching/enabled`,
          value: 'false'
        });
      });
    }
  });

  describe('When an endpoint with http method `any` has caching disabled', () => {
    before(async () => {
      given.api_gateway_update_stage_is_mocked(r => recordedParams = r);

      let endpointWithoutCaching = given.a_serverless_function('do-anything-to-cat')
        .withHttpEndpoint('any', '/cat', { enabled: false });

      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 60)
        .withFunction(endpointWithoutCaching)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);
    });

    after(() => {
      teardown.unmock_aws_sdk();
    });

    let allMethods = ['GET', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
    for (let method of allMethods) {
      it(`should disable caching for the ${method} method`, () => {
        expect(recordedParams.patchOperations).to.deep.include({
          op: 'replace',
          path: `/~1cat/${method}/caching/enabled`,
          value: 'false'
        });
      });
    }
  });
});

const when_updating_stage_cache_settings = async (settings, serverless) => {
  return await updateStageCacheSettings(settings, serverless);
}
