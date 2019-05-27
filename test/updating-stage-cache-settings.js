const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const updateStageCacheSettings = require(`${APP_ROOT}/src/stageCache`);
const UnauthorizedCacheControlHeaderStrategy = require(`${APP_ROOT}/src/UnauthorizedCacheControlHeaderStrategy`);
const expect = require('chai').expect;

describe('Updating stage cache settings', () => {
  let serverless, settings, requestsToAws, apiGatewayRequest;
  const apiGatewayService = 'APIGateway', updateStageMethod = 'updateStage';

  describe('When api gateway caching is not specified as a setting', () => {
    before(async () => {
      serverless = given.a_serverless_instance();
      settings = new ApiGatewayCachingSettings(serverless);
      await when_updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
    });

    it('should not make calls to the AWS SDK', () => {
      expect(requestsToAws).to.be.empty;
    });
  });

  describe('When api gateway caching is disabled', () => {
    let restApiId;
    before(async () => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(false)
        .forRegion('someregion')
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
    });

    it('should send a single request to AWS SDK to update stage', () => {
      request = requestsToAws.filter(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
      expect(request).to.have.lengthOf(1);
    });

    describe('the request sent to AWS SDK to update stage', () => {
      before(() => {
        apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
      });

      it('should contain the stage', () => {
        expect(apiGatewayRequest.stage).to.equal('somestage');
      });

      it('should contain the region', () => {
        expect(apiGatewayRequest.region).to.equal('someregion');
      });

      it('should contain the Rest Api Id', () => {
        expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
      });

      it('should contain the stage name', () => {
        expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
      });

      it('should disable caching', () => {
        expect(apiGatewayRequest.properties.patchOperations).to.have.lengthOf(1);
        let patch = apiGatewayRequest.properties.patchOperations[0];
        expect(patch).to.deep.equal({
          op: 'replace',
          path: '/cacheClusterEnabled',
          value: 'false'
        });
      });
    });
  });

  describe('When api gateway caching is true but api gateway is shared', () => {
    let restApiId;

    describe('and there are no endpoints for which to enable caching', () => {
      before(async () => {
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(undefined, undefined, undefined, undefined, undefined, true)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      it('should not make calls to the AWS SDK', () => {
        expect(requestsToAws).to.be.empty;
      });
    });

    describe('and there are some endpoints with caching enabled', () => {
      before(async () => {
        let endpointWithoutCaching = given.a_serverless_function('get-my-cat')
          .withHttpEndpoint('get', '/personal/cat', { enabled: false })
          .withHttpEndpoint('get', '/personal/cat/{catId}', { enabled: false });
        let endpointWithCaching = given.a_serverless_function('get-cat-by-paw-id')
          .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, ttlInSeconds: 45, dataEncrypted: true })
          .withHttpEndpoint('delete', '/cat/{pawId}', { enabled: true, ttlInSeconds: 45 });
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 60, undefined, false, true)
          .withFunction(endpointWithCaching)
          .withFunction(endpointWithoutCaching)
          .forStage('somestage');

        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        const noOperationAreExpectedForPath = (path) => () => {
          const foundItems = apiGatewayRequest.properties.patchOperations.filter((item => item.path === path))
          expect(foundItems.length).to.equal(0);
        }

        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the Rest Api Id', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        it('should leave caching untouched', noOperationAreExpectedForPath ('/cacheClusterEnabled'));

        it('should leave the cache cluster size untouched', noOperationAreExpectedForPath ('/cacheClusterSize'));
        
        describe('for the endpoint with caching enabled', () => {
          it('should enable caching', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/enabled',
              value: 'true'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/DELETE/caching/enabled',
              value: 'true'
            });
          });

          it('should set the correct cache time to live', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/ttlInSeconds',
              value: '45'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/DELETE/caching/ttlInSeconds',
              value: '45'
            });
          });

          it('should configure data encryption where enabled', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/dataEncrypted',
              value: 'true'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/DELETE/caching/dataEncrypted',
              value: 'false'
            });
          });
        });

        describe('for each endpoint with caching disabled', () => {
          it('should disable caching', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1personal~1cat/GET/caching/enabled',
              value: 'false'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1personal~1cat~1{catId}/GET/caching/enabled',
              value: 'false'
            });
          });

          it('should not set the cache time to live', () => {
            let ttlOperation = apiGatewayRequest.properties.patchOperations
              .find(o => o.path == '/~personal~1cat/GET/caching/ttlInSeconds' ||
                o.path == '/~personal~1cat~1{catId}/GET/caching/ttlInSeconds');
            expect(ttlOperation).to.not.exist;
          });

          it('should not configure data encryption', () => {
            let dataEncryptionOperation = apiGatewayRequest.properties.patchOperations
              .find(o => o.path == '/~personal~1cat/GET/caching/dataEncryption' ||
                o.path == '/~personal~1cat~1{catId}/GET/caching/dataEncryption');
            expect(dataEncryptionOperation).to.not.exist;
          });
        });
      });
    });

  })

  describe('When api gateway caching is enabled', () => {
    let restApiId;

    describe('and there are no endpoints for which to enable caching', () => {
      before(async () => {
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 60)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the Rest Api Id', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        it('should specify exactly four patch operations', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.have.lengthOf(4);
        })

        it('should enable caching', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterEnabled',
            value: 'true'
          });
        });

        it('should set the cache cluster size', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterSize',
            value: '0.5'
          });
        });

        it('should set the cache encryption', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/*/*/caching/dataEncrypted',
            value: 'false'
          });
        });

        it('should set the cache ttlInSeconds', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/*/*/caching/ttlInSeconds',
            value: '60'
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
        let endpointWithoutCaching = given.a_serverless_function('get-my-cat')
          .withHttpEndpoint('get', '/personal/cat', { enabled: false })
          .withHttpEndpoint('get', '/personal/cat/{catId}', { enabled: false });
        let endpointWithCaching = given.a_serverless_function('get-cat-by-paw-id')
          .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, ttlInSeconds: 45, dataEncrypted: true })
          .withHttpEndpoint('delete', '/cat/{pawId}', { enabled: true, ttlInSeconds: 45 });
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 60)
          .withFunction(endpointWithCaching)
          .withFunction(endpointWithoutCaching)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the Rest Api Id', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        it('should enable caching', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterEnabled',
            value: 'true'
          });
        });

        it('should set the cache cluster size', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterSize',
            value: '0.5'
          });
        });

        describe('for the endpoint with caching enabled', () => {
          it('should enable caching', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/enabled',
              value: 'true'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/DELETE/caching/enabled',
              value: 'true'
            });
          });

          it('should set the correct cache time to live', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/ttlInSeconds',
              value: '45'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/DELETE/caching/ttlInSeconds',
              value: '45'
            });
          });

          it('should configure data encryption where enabled', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/GET/caching/dataEncrypted',
              value: 'true'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1cat~1{pawId}/DELETE/caching/dataEncrypted',
              value: 'false'
            });
          });
        });

        describe('for each endpoint with caching disabled', () => {
          it('should disable caching', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1personal~1cat/GET/caching/enabled',
              value: 'false'
            });
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1personal~1cat~1{catId}/GET/caching/enabled',
              value: 'false'
            });
          });

          it('should not set the cache time to live', () => {
            let ttlOperation = apiGatewayRequest.properties.patchOperations
              .find(o => o.path == '/~personal~1cat/GET/caching/ttlInSeconds' ||
                o.path == '/~personal~1cat~1{catId}/GET/caching/ttlInSeconds');
            expect(ttlOperation).to.not.exist;
          });

          it('should not configure data encryption', () => {
            let dataEncryptionOperation = apiGatewayRequest.properties.patchOperations
              .find(o => o.path == '/~personal~1cat/GET/caching/dataEncryption' ||
                o.path == '/~personal~1cat~1{catId}/GET/caching/dataEncryption');
            expect(dataEncryptionOperation).to.not.exist;
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

            requestsToAws = serverless.getRequestsToAws();
            apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
          });

          it('should set whether the endpoint requires authorization for cache control', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include(scenario.expectedPatchForAuth);
          });

          if (scenario.expectedPatchForUnauthorizedStrategy) {
            it('should set the strategy for unauthorized requests to invalidate cache', () => {
              expect(apiGatewayRequest.properties.patchOperations).to.deep.include(scenario.expectedPatchForUnauthorizedStrategy);
            });
          }
        });
      }
    });
  });

  describe('When an endpoint with http method `any` has caching enabled', () => {
    before(async () => {
      let endpointWithCaching = given.a_serverless_function('do-anything-to-cat')
        .withHttpEndpoint('any', '/cat', { enabled: true, ttlInSeconds: 45 });

      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 60)
        .withFunction(endpointWithCaching)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
      apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
    });

    it('should enable caching for the GET method', () => {
      expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
        op: 'replace',
        path: '/~1cat/GET/caching/enabled',
        value: 'true'
      });
    });

    it('should set the correct time to live for the GET method cache', () => {
      expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
        op: 'replace',
        path: '/~1cat/GET/caching/ttlInSeconds',
        value: '45'
      });
    });

    let otherMethods = ['DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
    for (let method of otherMethods) {
      it(`should disable caching for the ${method} method`, () => {
        expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
          op: 'replace',
          path: `/~1cat/${method}/caching/enabled`,
          value: 'false'
        });
      });
    }
  });

  describe('When an endpoint with http method `any` has caching disabled', () => {
    before(async () => {
      let endpointWithoutCaching = given.a_serverless_function('do-anything-to-cat')
        .withHttpEndpoint('any', '/cat', { enabled: false });

      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 60)
        .withFunction(endpointWithoutCaching)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
      apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
    });

    let allMethods = ['GET', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'];
    for (let method of allMethods) {
      it(`should disable caching for the ${method} method`, () => {
        expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
          op: 'replace',
          path: `/~1cat/${method}/caching/enabled`,
          value: 'false'
        });
      });
    }
  });

  describe('When an http endpoint is defined in shorthand', () => {
    before(async () => {
      let endpoint = given.a_serverless_function('list-cats')
        .withHttpEndpointInShorthand('get /cats');

      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true)
        .withFunction(endpoint)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
      apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
    });

    it(`should disable caching for the endpoint`, () => {
      expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
        op: 'replace',
        path: `/~1cats/GET/caching/enabled`,
        value: 'false'
      });
    });
  });

  // https://github.com/DianaIonita/serverless-api-gateway-caching/issues/46
  describe('When there are over twenty two http endpoints defined', () => {
    let requestsToAwsToUpdateStage, restApiId, expectedStageName;
    before(async () => {
      let endpoints = given.endpoints_with_caching_enabled(23);

      expectedStageName = 'somestage';
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 60)
        .forStage(expectedStageName);
      for (let endpoint of endpoints) {
        serverless = serverless.withFunction(endpoint)
      }

      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when_updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
      requestsToAwsToUpdateStage = requestsToAws.filter(r => r.method == 'updateStage');
    });

    it('should send two requests to update stage', () => {
      expect(requestsToAwsToUpdateStage).to.have.lengthOf(2);
    });

    describe('each request to update stage', () => {
      let firstRequestToUpdateStage, secondRequestToUpdateStage;
      before(() => {
        firstRequestToUpdateStage = requestsToAwsToUpdateStage[0];
        secondRequestToUpdateStage = requestsToAwsToUpdateStage[1];
      });

      it('should specify the Rest Api Id', () => {
        expect(firstRequestToUpdateStage.properties.restApiId).to.equal(restApiId);
        expect(secondRequestToUpdateStage.properties.restApiId).to.equal(restApiId);
      });

      it('should specify the stage name', () => {
        expect(firstRequestToUpdateStage.properties.stageName).to.equal(expectedStageName);
        expect(secondRequestToUpdateStage.properties.stageName).to.equal(expectedStageName);
      });

      it('should not contain more than 80 patch operations', () => {
        expect(firstRequestToUpdateStage.properties.patchOperations).to.have.length.at.most(80);
        expect(secondRequestToUpdateStage.properties.patchOperations).to.have.length.at.most(80);
      });
    });
  });
});

const when_updating_stage_cache_settings = async (settings, serverless) => {
  return await updateStageCacheSettings(settings, serverless);
}
