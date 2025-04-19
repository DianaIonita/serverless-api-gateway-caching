const given = require('../test/steps/given');
const when = require('../test/steps/when');
const ApiGatewayCachingSettings = require('../src/ApiGatewayCachingSettings');
const UnauthorizedCacheControlHeaderStrategy = require('../src/UnauthorizedCacheControlHeaderStrategy');
const chai = require('chai');
const sinon = require('sinon');
const expect = require('chai').expect;

const { applyUpdateStageForChunk } = require('../src/stageCache');

// Use a before block to asynchronously load and configure chai-as-promised
before(async () => {
  const chaiAsPromised = await import('chai-as-promised');
  chai.use(chaiAsPromised.default); // Use .default when importing ESM dynamically
});

describe('Updating stage cache settings', () => {
  let serverless, settings, requestsToAws, apiGatewayRequest;
  const apiGatewayService = 'APIGateway', updateStageMethod = 'updateStage';

  describe('When api gateway caching is not specified as a setting', () => {
    before(async () => {
      serverless = given.a_serverless_instance();
      settings = new ApiGatewayCachingSettings(serverless);
      await when.updating_stage_cache_settings(settings, serverless);

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
        .withApiGatewayCachingConfig({ cachingEnabled: false })
        .forRegion('someregion')
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when.updating_stage_cache_settings(settings, serverless);

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

      it('should contain the REST API ID', () => {
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

  describe('When api gateway caching is enabled and the api gateway is shared', () => {
    let restApiId;

    describe('and there are no endpoints for which to enable caching', () => {
      before(async () => {
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig({ apiGatewayIsShared: true })
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when.updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      it('should not make calls the AWS SDK to update the stage', () => {
        expect(requestsToAws.filter(a => a.method == 'updateStage')).to.be.empty;
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
          .withApiGatewayCachingConfig({ ttlInSeconds: 60, apiGatewayIsShared: true })
          .withFunction(endpointWithCaching)
          .withFunction(endpointWithoutCaching)
          .forStage('somestage');

        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when.updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        const noOperationsAreExpectedForPath = (path) => () => {
          const foundItems = apiGatewayRequest.properties.patchOperations.filter((item => item.path === path))
          expect(foundItems.length).to.equal(0);
        }

        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the REST API ID', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        it('should leave caching untouched', noOperationsAreExpectedForPath('/cacheClusterEnabled'));

        it('should leave the cache cluster size untouched', noOperationsAreExpectedForPath('/cacheClusterSize'));

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

    describe('and there is a basePath configured', () => {
      before(async () => {
        let endpointWithCaching = given.a_serverless_function('get-cat-by-paw-id')
          .withHttpEndpoint('delete', '/cat/{pawId}', { enabled: true, ttlInSeconds: 45 });
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig({ ttlInSeconds: 60, apiGatewayIsShared: true, basePath: '/animals' })
          .withFunction(endpointWithCaching)
          .forStage('somestage');

        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when.updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the REST API ID', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        describe('for the endpoint with caching enabled', () => {
          it('includes the base path', () => {
            expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
              op: 'replace',
              path: '/~1animals~1cat~1{pawId}/DELETE/caching/enabled',
              value: 'true'
            });
          });
        });
      });
    });
  });

  describe('When api gateway caching is enabled', () => {
    let restApiId;

    describe('and there are no endpoints for which to enable caching', () => {
      before(async () => {
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig()
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when.updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the REST API ID', () => {
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
            value: '45'
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
          .withApiGatewayCachingConfig({ ttlInSeconds: 60 })
          .withFunction(endpointWithCaching)
          .withFunction(endpointWithoutCaching)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when.updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the REST API ID', () => {
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
              .withApiGatewayCachingConfig({ ttlInSeconds: 60, perKeyInvalidation: { requireAuthorization: true, handleUnauthorizedRequests: 'Ignore' } })
              .withFunction(endpoint)
              .forStage('somestage');
            settings = new ApiGatewayCachingSettings(serverless);

            restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

            await when.updating_stage_cache_settings(settings, serverless);

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
        .withApiGatewayCachingConfig({ ttlInSeconds: 60 })
        .withFunction(endpointWithCaching)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when.updating_stage_cache_settings(settings, serverless);

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
        .withApiGatewayCachingConfig({ ttlInSeconds: 60 })
        .withFunction(endpointWithoutCaching)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when.updating_stage_cache_settings(settings, serverless);

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
        .withApiGatewayCachingConfig()
        .withFunction(endpoint)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when.updating_stage_cache_settings(settings, serverless);

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

  describe('when an http endpoint path is empty', () => {
    before(async () => {
      let endpoint = given.a_serverless_function('list-cats')
        .withHttpEndpoint('get', '', { enabled: true });

      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig()
        .withFunction(endpoint)
        .forStage('somestage');
      settings = new ApiGatewayCachingSettings(serverless);

      restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

      await when.updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
      apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
    });

    it(`should enable caching for the endpoint`, () => {
      expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
        op: 'replace',
        path: `/~1/GET/caching/enabled`,
        value: 'true'
      });
    });
  });

  // https://github.com/DianaIonita/serverless-api-gateway-caching/issues/46
  describe('When there are over twenty two http endpoints defined', () => {
    let requestsToAwsToUpdateStage, restApiId, expectedStageName;
    before(async () => {
      let endpoints = given.endpoints_with_caching_enabled(23);

      expectedStageName = 'somestage';
      restApiId = given.a_rest_api_id();
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig({ endpointsInheritCloudWatchSettingsFromStage: false })
        .withRestApiId(restApiId)
        .forStage(expectedStageName);
      for (let endpoint of endpoints) {
        serverless = serverless.withFunction(endpoint)
      }

      settings = new ApiGatewayCachingSettings(serverless);

      await when.updating_stage_cache_settings(settings, serverless);

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

      it('should specify the REST API ID', () => {
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

  describe('applyUpdateStageForChunk function', () => {
    let serverless;
    let clock;
    const stage = 'test-stage';
    const region = 'eu-west-1';
    const chunk = {
      restApiId: 'test-api-id',
      stageName: stage,
      patchOperations: [{ op: 'replace', path: '/cacheClusterEnabled', value: 'true' }]
    };

    beforeEach(() => {
      serverless = given.a_serverless_instance()
        .forStage(stage)
        .forRegion(region);
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
      sinon.restore();
    });

    it('should call aws.request once on success', async () => {
      const requestStub = sinon.stub(serverless.providers.aws, 'request').resolves();

      await applyUpdateStageForChunk(chunk, serverless, stage, region);

      expect(requestStub.calledOnce).to.be.true;
      expect(requestStub.getCall(0).args[0]).to.equal('APIGateway');
      expect(requestStub.getCall(0).args[1]).to.equal('updateStage');
      expect(requestStub.getCall(0).args[2]).to.deep.equal(chunk);
      expect(requestStub.getCall(0).args[3]).to.equal(stage);
      expect(requestStub.getCall(0).args[4]).to.equal(region);
      expect(serverless._logMessages).to.include('[serverless-api-gateway-caching] Updating API Gateway cache settings. Attempt 1.');
    });

    it('should retry on ConflictException and succeed on the second attempt', async () => {
      const conflictError = new Error('A previous change is still in progress');
      conflictError.code = 'ConflictException';

      // Mock AWS request: fail first, succeed second
      const requestStub = sinon.stub(serverless.providers.aws, 'request');
      requestStub.onFirstCall().rejects(conflictError);
      requestStub.onSecondCall().resolves();

      const promise = applyUpdateStageForChunk(chunk, serverless, stage, region);

      // Advance clock to trigger the retry timeout
      await clock.tickAsync(1000); // Advance past the first delay (500 * 2^1)

      await promise; // Wait for the function to complete

      expect(requestStub.calledTwice).to.be.true;
      expect(serverless._logMessages).to.include('[serverless-api-gateway-caching] Updating API Gateway cache settings. Attempt 1.');
      expect(serverless._logMessages).to.include('[serverless-api-gateway-caching] Retrying (1/10) after 1000ms due to error: A previous change is still in progress');
      expect(serverless._logMessages).to.include('[serverless-api-gateway-caching] Updating API Gateway cache settings. Attempt 2.');
    });

    it('should fail after max retries on persistent ConflictException', async () => {
      const conflictError = new Error('A previous change is still in progress');
      conflictError.code = 'ConflictException';
      const maxRetries = 10; // As defined in the function

      // Mock AWS request to always fail with ConflictException
      const requestStub = sinon.stub(serverless.providers.aws, 'request').rejects(conflictError);

      const promise = applyUpdateStageForChunk(chunk, serverless, stage, region);

      // Advance clock past all retry delays
      for (let i = 1; i <= maxRetries; i++) {
        await clock.tickAsync(500 * (2 ** i) + 10); // Ensure delay is passed
      }

      // Assert the promise rejects with the correct error
      await expect(promise).to.be.rejectedWith(`Failed to update API Gateway cache settings after ${maxRetries} retries: ${conflictError.message}`);
      expect(requestStub.callCount).to.equal(maxRetries);
      expect(serverless._logMessages).to.include(`[serverless-api-gateway-caching] Maximum retries (${maxRetries}) reached. Failed to update API Gateway cache settings.`);
    });

    it('should fail immediately on non-retryable error', async () => {
      const otherError = new Error('Some other API Gateway error');
      otherError.code = 'BadRequestException'; // Example non-retryable code

      // Mock AWS request to fail with a non-retryable error
      const requestStub = sinon.stub(serverless.providers.aws, 'request').rejects(otherError);
      const errorSpy = sinon.spy(console, 'error'); // Spy on console.error

      const promise = applyUpdateStageForChunk(chunk, serverless, stage, region);

      // Assert the promise rejects immediately
      await expect(promise).to.be.rejectedWith(`Failed to update API Gateway cache settings: ${otherError.message}`);
      expect(requestStub.calledOnce).to.be.true; // Should not retry
      expect(errorSpy.calledWith('[serverless-api-gateway-caching] Non-retryable error during update:', otherError)).to.be.true;
      errorSpy.restore(); // Restore the spy
    });
  });
});
