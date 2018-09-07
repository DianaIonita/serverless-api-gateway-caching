const APP_ROOT = '..';
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const expect = require('chai').expect;

describe('Creating settings', () => {
  describe('when the input is invalid', () => {
    it('should set caching to disabled', () => {
      let settings = new ApiGatewayCachingSettings();
      expect(settings.cachingEnabled).to.be.false;
    });
  });

  describe('when there are no settings for Api Gateway caching', () => {
    it('should set caching to disabled', () => {
      let serverless = {
        service: { custom: {} }
      }
      let settings = new ApiGatewayCachingSettings(serverless);
      expect(settings.cachingEnabled).to.be.false;
    });
  });

  describe('when there are settings defined for Api Gateway caching', () => {
    let settings;
    before(() => {
      let serverless = {
        service: {
          custom: {
            apiGatewayCaching: {
              enabled: true,
              clusterSize: '0.5',
              ttlInSeconds: 45
            }
          }
        }
      }
      settings = new ApiGatewayCachingSettings(serverless);
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
      // before(() => {
      //   serverless.service.functions = {

      //   }
      // })
    });
  });
});
