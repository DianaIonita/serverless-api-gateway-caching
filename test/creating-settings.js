const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const UnauthorizedCacheControlHeaderStrategy = require(`${APP_ROOT}/src/UnauthorizedCacheControlHeaderStrategy`);
const expect = require('chai').expect;

describe('Creating settings', () => {
  let cacheSettings, serverless;

  let getCatByPawIdFunctionName = 'get-cat-by-paw-id';
  let listAllCatsFunctionName = 'list-all-cats';
  let getMyCatFunctionName = 'get-my-cat';

  describe('when the input is invalid', () => {
    it('should set caching to undefined', () => {
      cacheSettings = createSettingsFor();
      expect(cacheSettings.cachingEnabled).to.be.undefined;
    });
  });

  describe('when there are no settings for Api Gateway caching', () => {
    it('should set caching to undefined', () => {
      cacheSettings = createSettingsFor(given.a_serverless_instance());
      expect(cacheSettings.cachingEnabled).to.be.undefined;
    });
  });

  describe('when the cluster size is omitted from Api Gateway caching settings', () => {
    before(() => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true);

      cacheSettings = createSettingsFor(serverless);
    });

    it('should set the cache cluster size to the default', () => {
      expect(cacheSettings.cacheClusterSize).to.equal('0.5');
    });
  });

  describe('when the time to live is omitted from Api Gateway caching settings', () => {
    before(() => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true);

      cacheSettings = createSettingsFor(serverless);
    });

    it('should set the cache time to live to the default', () => {
      expect(cacheSettings.cacheTtlInSeconds).to.equal(3600);
    });
  });

  describe('when per-key invalidation settings are omitted from Api Gateway caching settings', () => {
    before(() => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true);

      cacheSettings = createSettingsFor(serverless);
    });

    it('should set that cache invalidation requires authorization', () => {
      expect(cacheSettings.perKeyInvalidation.requireAuthorization).to.be.true;
    });

    it('should set the strategy to ignore unauthorized invalidation requests with a warning', () => {
      expect(cacheSettings.perKeyInvalidation.handleUnauthorizedRequests)
        .to.equal(UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning);
    });
  });

  describe('when settings are defined for Api Gateway caching', () => {
    let scenarios = [
      {
        description: 'and per key cache invalidation does not require authorization',
        serverless: given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 45,
            { requireAuthorization: false }),
        expectedCacheSettings: {
          cachingEnabled: true,
          cacheClusterSize: '0.5',
          cacheTtlInSeconds: 45,
          perKeyInvalidation: {
            requireAuthorization: false
          }
        }
      },
      {
        description: 'and the strategy to handle unauthorized invalidation requests is to ignore',
        serverless: given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 45,
            { requireAuthorization: true, handleUnauthorizedRequests: 'Ignore' }),
        expectedCacheSettings: {
          cachingEnabled: true,
          cacheClusterSize: '0.5',
          cacheTtlInSeconds: 45,
          perKeyInvalidation: {
            requireAuthorization: true,
            handleUnauthorizedRequests: UnauthorizedCacheControlHeaderStrategy.Ignore
          }
        }
      },
      {
        description: 'and the strategy to handle unauthorized invalidation requests is to ignore with a warning',
        serverless: given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 45,
            { requireAuthorization: true, handleUnauthorizedRequests: 'IgnoreWithWarning' }),
        expectedCacheSettings: {
          cachingEnabled: true,
          cacheClusterSize: '0.5',
          cacheTtlInSeconds: 45,
          perKeyInvalidation: {
            requireAuthorization: true,
            handleUnauthorizedRequests: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
          }
        }
      },
      {
        description: 'and the strategy to handle unauthorized invalidation requests is to ignore with a warning',
        serverless: given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 45,
            { requireAuthorization: true, handleUnauthorizedRequests: 'IgnoreWithWarning' }),
        expectedCacheSettings: {
          cachingEnabled: true,
          cacheClusterSize: '0.5',
          cacheTtlInSeconds: 45,
          perKeyInvalidation: {
            requireAuthorization: true,
            handleUnauthorizedRequests: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
          }
        }
      },
      {
        description: 'and the strategy to handle unauthorized invalidation requests is to fail the request',
        serverless: given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 45,
            { requireAuthorization: true, handleUnauthorizedRequests: 'Fail' }),
        expectedCacheSettings: {
          cachingEnabled: true,
          cacheClusterSize: '0.5',
          cacheTtlInSeconds: 45,
          perKeyInvalidation: {
            requireAuthorization: true,
            handleUnauthorizedRequests: UnauthorizedCacheControlHeaderStrategy.Fail
          }
        }
      },
      {
        description: 'and the strategy to handle unauthorized invalidation requests is not set',
        serverless: given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '1', 45,
            { requireAuthorization: true }),
        expectedCacheSettings: {
          cachingEnabled: true,
          cacheClusterSize: '1',
          cacheTtlInSeconds: 45,
          perKeyInvalidation: {
            requireAuthorization: true,
            handleUnauthorizedRequests: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
          }
        }
      }
    ];

    for (let scenario of scenarios) {
      describe(scenario.description, () => {
        before(() => {
          serverless = given.a_serverless_instance()
            .withApiGatewayCachingConfig(true, '0.5', 45,
              { requireAuthorization: true, handleUnauthorizedRequests: 'Ignore' });

          cacheSettings = createSettingsFor(scenario.serverless);
        });

        it('should set whether caching is enabled', () => {
          expect(cacheSettings.cachingEnabled).to.deep.equal(scenario.expectedCacheSettings.cachingEnabled);
        });

        it('should set cache cluster size', () => {
          expect(cacheSettings.cacheClusterSize).to.deep.equal(scenario.expectedCacheSettings.cacheClusterSize);
        });

        it('should set cache time to live', () => {
          expect(cacheSettings.cacheTtlInSeconds).to.deep.equal(scenario.expectedCacheSettings.cacheTtlInSeconds);
        });

        it('should set per key invalidation settings correctly', () => {
          expect(cacheSettings.perKeyInvalidation).to.deep.equal(scenario.expectedCacheSettings.perKeyInvalidation);
        });
      });
    }
  });

  describe('when there are settings defined for Api Gateway caching', () => {
    before(() => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 45,
          { requireAuthorization: true, handleUnauthorizedRequests: 'Ignore' });

      cacheSettings = createSettingsFor(serverless);
    });

    describe('and there are functions', () => {
      describe('and none of them are http endpoints', () => {
        before(() => {
          serverless = given.a_serverless_instance()
            .withApiGatewayCachingConfig(true, '0.5', 45)
            .withFunction(given.a_serverless_function('schedule-cat-nap'))
            .withFunction(given.a_serverless_function('take-cat-to-vet'));

          cacheSettings = createSettingsFor(serverless);
        });

        it('should not have caching settings for non-http endpoints', () => {
          expect(cacheSettings.endpointSettings).to.be.empty;
        });
      });

      describe('and there are some http endpoints', () => {
        before(() => {
          let listCats = given.a_serverless_function(listAllCatsFunctionName)
            .withHttpEndpoint('get', '/cats');

          let getCatByPawIdCaching = { enabled: true, ttlInSeconds: 30 };
          let getCatByPawId = given.a_serverless_function(getCatByPawIdFunctionName)
            .withHttpEndpoint('get', '/cat/{pawId}', getCatByPawIdCaching)
            .withHttpEndpoint('delete', '/cat/{pawId}', getCatByPawIdCaching);

          let getMyCatCaching = { enabled: false };
          let getMyCat = given.a_serverless_function(getMyCatFunctionName)
            .withHttpEndpoint('get', '/cat/{pawId}', getMyCatCaching);

          serverless = given.a_serverless_instance()
            .withApiGatewayCachingConfig(true, '0.5', 45)
            .withFunction(given.a_serverless_function('schedule-cat-nap'))
            .withFunction(listCats)
            .withFunction(getCatByPawId)
            .withFunction(getMyCat);

          cacheSettings = createSettingsFor(serverless);
        });

        it('should create cache settings for all http endpoints', () => {
          expect(cacheSettings.endpointSettings).to.have.lengthOf(4);
        });

        describe('caching for http endpoint without cache settings defined', () => {
          let endpointSettings;
          before(() => {
            endpointSettings = cacheSettings.endpointSettings.find(e => e.functionName == listAllCatsFunctionName);
          });

          it('should default to false', () => {
            expect(endpointSettings.cachingEnabled).to.be.false;
          });
        });

        describe('caching for the http endpoint with cache settings disabled', () => {
          let endpointSettings;
          before(() => {
            endpointSettings = cacheSettings.endpointSettings.find(e => e.functionName == getMyCatFunctionName);
          });

          it('should be set to false', () => {
            expect(endpointSettings.cachingEnabled).to.be.false;
          });
        });

        describe('caching for the http endpoint with cache settings enabled', () => {
          let endpointSettings;
          before(() => {
            endpointSettings = cacheSettings.endpointSettings.find(e => e.functionName == getCatByPawIdFunctionName);
          });

          it('should be enabled', () => {
            expect(endpointSettings.cachingEnabled).to.be.true;
          });
        });
      });
    });
  });

  describe('when there are caching settings for an http endpoint', () => {
    let endpoint;
    describe('and caching is turned off globally', () => {
      before(() => {
        let caching = { enabled: true }
        endpoint = given.a_serverless_function(getCatByPawIdFunctionName)
          .withHttpEndpoint('get', '/cat/{pawId}', caching);
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(false)
          .withFunction(endpoint);

        cacheSettings = createSettingsFor(serverless);
      });

      it('caching should be disabled for the endpoint', () => {
        expect(cacheSettings.endpointSettings[0].cachingEnabled).to.be.false;
      });
    });

    describe('and caching is turned on globally', () => {
      before(() => {
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '1', 20,
            { requireAuthorization: true, handleUnauthorizedRequests: 'Ignore' });
      });

      describe('and only the fact that caching is enabled is specified', () => {
        before(() => {
          let caching = { enabled: true }
          endpoint = given.a_serverless_function(getCatByPawIdFunctionName)
            .withHttpEndpoint('get', '/cat/{pawId}', caching);
          serverless = serverless.withFunction(endpoint);

          cacheSettings = createSettingsFor(serverless);
        });

        it('should inherit time to live settings from global settings', () => {
          expect(cacheSettings.endpointSettings[0].cacheTtlInSeconds).to.equal(20);
        });

        it('should not set cache key parameter settings', () => {
          expect(cacheSettings.endpointSettings[0].cacheKeyParameters).to.not.exist;
        });
      });

      describe('and the time to live is specified', () => {
        before(() => {
          let caching = { enabled: true, ttlInSeconds: 67 }
          endpoint = given.a_serverless_function(getCatByPawIdFunctionName)
            .withHttpEndpoint('get', '/cat/{pawId}', caching);
          serverless = serverless.withFunction(endpoint);

          cacheSettings = createSettingsFor(serverless);
        });

        it('should set the correct time to live', () => {
          expect(cacheSettings.endpointSettings[0].cacheTtlInSeconds).to.equal(67);
        });
      });

      describe('and there are cache key parameters', () => {
        let caching;
        before(() => {
          caching = {
            enabled: true,
            cacheKeyParameters: [{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }]
          };
          endpoint = given.a_serverless_function(getCatByPawIdFunctionName)
            .withHttpEndpoint('get', '/cat/{pawId}', caching);
          serverless = serverless.withFunction(endpoint);

          cacheSettings = createSettingsFor(serverless);
        });

        it('should set cache key parameters', () => {
          expect(cacheSettings.endpointSettings[0].cacheKeyParameters)
            .to.deep.equal([{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }]);
        });
      });

      let scenarios = [
        {
          description: 'and it is configured to handle unauthorized invalidation requests by ignoring them with a warning',
          caching: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true,
              handleUnauthorizedRequests: 'IgnoreWithWarning'
            }
          },
          expectedCacheInvalidationRequiresAuthorization: true,
          expectedCacheInvalidationStrategy: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
        },
        {
          description: 'and it is configured to handle unauthorized invalidation requests by ignoring them',
          caching: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true,
              handleUnauthorizedRequests: 'Ignore'
            }
          },
          expectedCacheInvalidationRequiresAuthorization: true,
          expectedCacheInvalidationStrategy: UnauthorizedCacheControlHeaderStrategy.Ignore
        },
        {
          description: 'and it is configured to handle unauthorized invalidation requests by failing the request',
          caching: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true,
              handleUnauthorizedRequests: 'Fail'
            }
          },
          expectedCacheInvalidationRequiresAuthorization: true,
          expectedCacheInvalidationStrategy: UnauthorizedCacheControlHeaderStrategy.Fail
        },
        {
          description: 'and the strategy for handling unauthorized invalidation requests is not defined',
          caching: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: true
            }
          },
          expectedCacheInvalidationRequiresAuthorization: true,
          expectedCacheInvalidationStrategy: UnauthorizedCacheControlHeaderStrategy.IgnoreWithWarning
        },
        {
          description: 'and it is configured to not require cache control authorization',
          caching: {
            enabled: true,
            perKeyInvalidation: {
              requireAuthorization: false
            }
          },
          expectedCacheInvalidationRequiresAuthorization: false,
          expectedCacheInvalidationStrategy: undefined
        },
        {
          description: 'and cache control authorization is not configured',
          caching: {
            enabled: true
          },
          // defaults to global settings
          expectedCacheInvalidationRequiresAuthorization: true,
          expectedCacheInvalidationStrategy: UnauthorizedCacheControlHeaderStrategy.Ignore
        }
      ];

      for (let scenario of scenarios) {
        describe(scenario.description, () => {
          before(() => {
            endpoint = given.a_serverless_function(getCatByPawIdFunctionName)
              .withHttpEndpoint('get', '/cat/{pawId}', scenario.caching);
            serverless = serverless.withFunction(endpoint);

            cacheSettings = createSettingsFor(serverless);
          });

          it('should set per-key cache invalidation authorization', () => {
            expect(cacheSettings.endpointSettings[0].perKeyInvalidation.requireAuthorization)
              .to.equal(scenario.expectedCacheInvalidationRequiresAuthorization)
          });

          it('should set the strategy to handle unauthorized cache invalidation requests', () => {
            expect(cacheSettings.endpointSettings[0].perKeyInvalidation.handleUnauthorizedRequests)
              .to.equal(scenario.expectedCacheInvalidationStrategy);
          });
        });
      }
    });
  });

  describe('when there are command line options for the deployment', () => {
    let options;
    before(() => {
      serverless = given.a_serverless_instance()
        .forStage('devstage')
        .forRegion('eu-west-1')
        .withApiGatewayCachingConfig(true, '0.5', 45);
    });

    describe('and they do not specify the stage', () => {
      before(() => {
        options = {}

        cacheSettings = createSettingsFor(serverless, options);
      });

      it('should use the provider stage', () => {
        expect(cacheSettings.stage).to.equal('devstage');
      });
    });

    describe('and they specify the stage', () => {
      before(() => {
        options = { stage: 'anotherstage' }

        cacheSettings = createSettingsFor(serverless, options);
      });

      it('should use the stage from command line', () => {
        expect(cacheSettings.stage).to.equal('anotherstage');
      });
    });

    describe('and they do not specify the region', () => {
      before(() => {
        options = {}

        cacheSettings = createSettingsFor(serverless, options);
      });

      it('should use the provider region', () => {
        expect(cacheSettings.region).to.equal('eu-west-1');
      });
    });

    describe('and they specify the region', () => {
      before(() => {
        options = { region: 'someotherregion' }

        cacheSettings = createSettingsFor(serverless, options);
      });

      it('should use the region from command line', () => {
        expect(cacheSettings.region).to.equal('someotherregion');
      });
    });
  });

  describe('when a http endpoint is defined in shorthand', () => {
    describe(`and caching is turned on globally`, () => {
      before(() => {
        endpoint = given.a_serverless_function('list-cats')
          .withHttpEndpointInShorthand('get /cats');
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true)
          .withFunction(endpoint);

        cacheSettings = createSettingsFor(serverless);
      });

      it('settings should contain the endpoint method', () => {
        expect(cacheSettings.endpointSettings[0].method).to.equal('get');
      });

      it('settings should contain the endpoint path', () => {
        expect(cacheSettings.endpointSettings[0].path).to.equal('/cats');
      });

      it('caching should not be enabled for the http endpoint', () => {
        expect(cacheSettings.endpointSettings[0].cachingEnabled).to.be.false;
      });
    });
  });
});

const createSettingsFor = (serverless, options) => {
  return new ApiGatewayCachingSettings(serverless, options);
}
