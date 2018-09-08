const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const expect = require('chai').expect;

describe('Creating settings', () => {
  let cacheSettings, serverless;

  describe('when the input is invalid', () => {
    it('should set caching to disabled', () => {
      cacheSettings = createSettingsFor();
      expect(cacheSettings.cachingEnabled).to.be.false;
    });
  });

  describe('when there are no settings for Api Gateway caching', () => {
    it('should set caching to disabled', () => {
      cacheSettings = createSettingsFor(given.a_serverless_instance());
      expect(cacheSettings.cachingEnabled).to.be.false;
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
          let listCats = given.a_serverless_function('list-all-cats')
            .withHttpEndpoint('get', '/cats');

          let getCatByPawIdCaching = { enabled: true, ttlInSeconds: 30 };
          let getCatByPawId = given.a_serverless_function('get-cat-by-paw-id')
            .withHttpEndpoint('get', '/cat/{pawId}', getCatByPawIdCaching);

          serverless = given.a_serverless_instance()
            .withApiGatewayCachingConfig(true, '0.5', 45)
            .withFunction(given.a_serverless_function('schedule-cat-nap'))
            .withFunction(listCats)
            .withFunction(getCatByPawId);

          cacheSettings = createSettingsFor(serverless);
        });

        it.only('should create cache settings for all http endpoints', () => {
          expect(cacheSettings.endpointSettings).to.have.lengthOf(2);
        });
      });
    });
  });
});

const createSettingsFor = serverless => {
  return new ApiGatewayCachingSettings(serverless);
}
