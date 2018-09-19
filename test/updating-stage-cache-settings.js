const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const teardown = require(`${APP_ROOT}/test/steps/teardown`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const updateStageCacheSettings = require(`${APP_ROOT}/src/stageCache`);
const UnauthorizedCacheControlHeaderStrategy = require(`${APP_ROOT}/src/UnauthorizedCacheControlHeaderStrategy`);
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

    describe('and one endpoint has caching settings', () => {
      let scenarios = [
        {
          description: 'with per-key cache invalidation authorization disabled',
          endpointCachingSettings: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: false
            }
          },
          expectedPatchForAuth: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/requireAuthorizationForCacheControl',
            value: 'false'
          }
        },
        {
          description: 'with per-key cache invalidation authorization enabled',
          endpointCachingSettings: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true
            }
          },
          expectedPatchForAuth: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/requireAuthorizationForCacheControl',
            value: 'true'
          },
          expectedPatchForUnauthorizedStrategy: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/unauthorizedCacheControlHeaderStrategy',
            value: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
          }
        },
        {
          description: 'with the strategy to ignore unauthorized cache invalidation requests',
          endpointCachingSettings: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true,
              handleUnauthorizedRequests: 'Ignore'
            }
          },
          expectedPatchForAuth: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/requireAuthorizationForCacheControl',
            value: 'true'
          },
          expectedPatchForUnauthorizedStrategy: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/unauthorizedCacheControlHeaderStrategy',
            value: UnauthorizedCacheControlHeaderStrategy.Ignore
          }
        },
        {
          description: 'with the strategy to ignore unauthorized cache invalidation requests with a warning header',
          endpointCachingSettings: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true,
              handleUnauthorizedRequests: 'IgnoreWithWarning'
            }
          },
          expectedPatchForAuth: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/requireAuthorizationForCacheControl',
            value: 'true'
          },
          expectedPatchForUnauthorizedStrategy: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/unauthorizedCacheControlHeaderStrategy',
            value: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
          }
        },
        {
          description: 'with the strategy to fail unauthorized cache invalidation requests',
          endpointCachingSettings: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true,
              handleUnauthorizedRequests: 'Fail'
            }
          },
          expectedPatchForAuth: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/requireAuthorizationForCacheControl',
            value: 'true'
          },
          expectedPatchForUnauthorizedStrategy: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/unauthorizedCacheControlHeaderStrategy',
            value: UnauthorizedCacheControlHeaderStrategy.Fail
          }
        },
        {
          description: 'without per-key cache invalidation settings',
          endpointCachingSettings: {
            enabled: true
          },
          // inherited from global settings
          expectedPatchForAuth: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/requireAuthorizationForCacheControl',
            value: 'true'
          },
          expectedPatchForUnauthorizedStrategy: {
            op: 'replace',
            path: '/~1personal~1cat/GET/caching/unauthorizedCacheControlHeaderStrategy',
            value: UnauthorizedCacheControlHeaderStrategy.Ignore
          }
        }
      ];

      for (let scenario of scenarios) {
        describe(scenario.description, () => {
          before(async () => {
            given.api_gateway_update_stage_is_mocked(r => recordedParams = r);

            let endpoint = given.a_serverless_function('get-my-cat')
              .withHttpEndpoint('get', '/personal/cat', scenario.endpointCachingSettings);
            serverless = given.a_serverless_instance()
              .withApiGatewayCachingConfig(true, '0.5', 60,
                { requireAuthorization: true, handleUnauthorizedRequests: 'Ignore' })
              .withFunction(endpoint)
              .forStage('somestage');
            settings = new ApiGatewayCachingSettings(serverless);

            restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

            await when_updating_stage_cache_settings(settings, serverless);
          });

          after(() => {
            teardown.unmock_aws_sdk();
          });

          it('should set whether the endpoint requires authorization for cache control', () => {
            expect(recordedParams.patchOperations).to.deep.include(scenario.expectedPatchForAuth);
          });

          if (scenario.expectedPatchForUnauthorizedStrategy) {
            it('should set the strategy for unauthorized requests to invalidate cache', () => {
              expect(recordedParams.patchOperations).to.deep.include(scenario.expectedPatchForUnauthorizedStrategy);
            });
          }
        });
      }
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
