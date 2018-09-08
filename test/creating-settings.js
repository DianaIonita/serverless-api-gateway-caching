const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const expect = require('chai').expect;

describe('Creating settings', () => {
  describe('when the input is invalid', () => {
    it('should set caching to disabled', () => {
      let settings = createSettingsFor();
      expect(settings.cachingEnabled).to.be.false;
    });
  });

  describe('when there are no settings for Api Gateway caching', () => {
    it('should set caching to disabled', () => {
      let settings = createSettingsFor(given.a_serverless_instance());
      expect(settings.cachingEnabled).to.be.false;
    });
  });

  describe('when there are settings defined for Api Gateway caching', () => {
    let settings;
    before(() => {
      let serverless = given.a_serverless_instance()
        .withApiGatewayCachingConfig(true, '0.5', 45);

      settings = createSettingsFor(serverless);
    });

    it('should set caching enabled', () => {
      expect(settings.cachingEnabled).to.be.true;
    });

    it('should set cluster size', () => {
      expect(settings.cacheClusterSize).to.equal('0.5');
    });

    it('should set time to live', () => {
      expect(settings.cacheTtlInSeconds).to.equal(45);
    });

    describe('and there are some http endpoints', () => {
      before(() => {
        serverless.service.functions = {
          'list-cats': {
            events: [{
              http: {
                path: '/cats',
                method: 'get'
              }
            }]
          }
        }
      });
    });
  });
});

const createSettingsFor = serverless => {
  return new ApiGatewayCachingSettings(serverless);
}
