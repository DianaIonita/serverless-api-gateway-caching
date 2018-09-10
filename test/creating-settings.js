const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
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

  describe('when there are settings defined for Api Gateway caching', () => {
    before(() => {
      serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 45);

      cacheSettings = createSettingsFor(serverless);
    });

    it('should set caching enabled', () => {
      expect(cacheSettings.cachingEnabled).to.be.true;
    });

    it('should set cluster size', () => {
      expect(cacheSettings.cacheClusterSize).to.equal('0.5');
    });

    it('should set time to live', () => {
      expect(cacheSettings.cacheTtlInSeconds).to.equal(45);
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
            .withHttpEndpoint('get', '/cat/{pawId}', getCatByPawIdCaching);

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
          expect(cacheSettings.endpointSettings).to.have.lengthOf(3);
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
          .withApiGatewayCachingConfig(true, '1', 20);
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
            cacheKeyParameters: [
              { name: 'request.path.pawId', required: true },
              { name: 'request.header.Accept-Language', required: false }]
          };
          endpoint = given.a_serverless_function(getCatByPawIdFunctionName)
            .withHttpEndpoint('get', '/cat/{pawId}', caching);
          serverless = serverless.withFunction(endpoint);

          cacheSettings = createSettingsFor(serverless);
        });

        it('should set cache key parameters', () => {
          expect(cacheSettings.endpointSettings[0].cacheKeyParameters).to.deep.equal(caching.cacheKeyParameters);
        });
      });
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
});

const createSettingsFor = (serverless, options) => {
  return new ApiGatewayCachingSettings(serverless, options);
}
