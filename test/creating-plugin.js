const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const ApiGatewayCachingPlugin = require('../src/ApiGatewayCachingPlugin');
const ApiGatewayCachingSettings = require('../src/ApiGatewayCachingSettings');
const expect = chai.expect;

chai.use(sinonChai);

describe('Creating plugin', () => {
  describe('when calling constructor', () => {
    const serverless = {};
    const options = {};
    const plugin = new ApiGatewayCachingPlugin(serverless, options);

    it('should set serverless field', () =>
      expect(plugin.serverless).to.equal(serverless));

    it('should set options field', () =>
      expect(plugin.options).to.equal(options));

    it('should set hooks[before:package:initialize]', () =>
      expect(
        expect(plugin.hooks['before:package:initialize']).to.be.a('function')
      ));

    it('should set hooks[before:package:finalize]', () =>
      expect(
        expect(plugin.hooks['before:package:finalize']).to.be.a('function')
      ));

    it('should set hooks[after:aws:deploy:finalize:cleanup]', () =>
      expect(
        expect(plugin.hooks['after:aws:deploy:finalize:cleanup']).to.be.a(
          'function'
        )
      ));
  });

  describe('When create settings', () => {
    const serverless = {};
    const options = {};
    const plugin = new ApiGatewayCachingPlugin(serverless, options);

    before(() => plugin.createSettings());

    it('should initialize settings', () =>
      expect(plugin.settings).to.eql(
        new ApiGatewayCachingSettings(serverless, options)
      ));
  });

  describe('When update CloudFormation template', () => {
    describe('and there is no a rest api', () => {
      const serverless = { cli: { log: sinon.stub() } };
      const options = {};
      const settings = {};
      const plugin = new ApiGatewayCachingPlugin(serverless, options);
      const restApiExists = sinon.stub().returns(false);
      const outputRestApiIdTo = sinon.stub();
      const pathParametersCache = {
        addPathParametersCacheConfig: sinon.stub()
      };

      before(() => {
        plugin.settings = settings;
        plugin.updateCloudFormationTemplate({
          restApiExists,
          outputRestApiIdTo,
          pathParametersCache
        });
      });

      it('should call restApiExists', () =>
        expect(restApiExists).to.be.calledWith(serverless));

      it('should call serverless cli log', () =>
        expect(serverless.cli.log).to.be.calledWith(
          `[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.`
        ));

      it('should not call outputRestApiIdTo', () =>
        expect(outputRestApiIdTo).to.not.be.called);

      it('should not call pathParametersCache.addPathParametersCacheConfig', () =>
        expect(pathParametersCache.addPathParametersCacheConfig).to.not.be
          .called);
    });

    describe('and there is a rest api', () => {
      const serverless = { cli: { log: sinon.stub() } };
      const options = {};
      const plugin = new ApiGatewayCachingPlugin(serverless, options);

      describe('and caching is disabled', () => {
        const settings = { cachingEnabled: false };
        const restApiExists = sinon.stub().returns(true);
        const outputRestApiIdTo = sinon.stub();
        const pathParametersCache = {
          addPathParametersCacheConfig: sinon.stub()
        };

        before(() => {
          plugin.settings = settings;
          plugin.updateCloudFormationTemplate({
            restApiExists,
            outputRestApiIdTo,
            pathParametersCache
          });
        });

        it('should call restApiExists', () =>
          expect(restApiExists).to.be.calledWith(serverless));

        it('should not call serverless cli log', () =>
          expect(serverless.cli.log).to.not.be.called);

        it('should call outputRestApiIdTo', () =>
          expect(outputRestApiIdTo).to.be.calledWith(serverless));

        it('should not call pathParametersCache.addPathParametersCacheConfig', () =>
          expect(pathParametersCache.addPathParametersCacheConfig).to.not.be
            .called);
      });

      describe('and caching is enabled', () => {
        const settings = { cachingEnabled: true };
        const restApiExists = sinon.stub().returns(true);
        const outputRestApiIdTo = sinon.stub();
        const pathParametersCache = {
          addPathParametersCacheConfig: sinon.stub()
        };

        before(() => {
          plugin.settings = settings;
          plugin.updateCloudFormationTemplate({
            restApiExists,
            outputRestApiIdTo,
            pathParametersCache
          });
        });

        it('should call restApiExists', () =>
          expect(restApiExists).to.be.calledWith(serverless));

        it('should not call serverless cli log', () =>
          expect(serverless.cli.log).to.not.be.called);

        it('should call outputRestApiIdTo', () =>
          expect(outputRestApiIdTo).to.be.calledWith(serverless));

        it('should call pathParametersCache.addPathParametersCacheConfig', () =>
          expect(
            pathParametersCache.addPathParametersCacheConfig
          ).to.be.calledWith(settings, serverless));
      });
    });
  });

  describe('When update stage', () => {
    describe('and there is no rest api', () => {
      const serverless = { cli: { log: sinon.stub() } };
      const options = {};
      const settings = {};
      const plugin = new ApiGatewayCachingPlugin(serverless, options);
      const restApiExists = sinon.stub().returns(false);
      const updateStageCacheSettings = sinon.stub().returns(false);

      before(() => {
        plugin.settings = settings;
        plugin.createSettings = sinon.stub();
        plugin.updateStage({ restApiExists, updateStageCacheSettings });
      });

      it('should call restApiExists', () =>
        expect(restApiExists).to.be.calledWith(serverless));

      it('should call serverless cli log', () =>
        expect(serverless.cli.log).to.be.calledWith(
          `[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.`
        ));

      it('should not call createSettings', () =>
        expect(plugin.createSettings).to.not.be.called);

      it('should not call updateStageCacheSettings', () =>
        expect(updateStageCacheSettings).to.not.be.called);
    });

    describe('and there is a rest api', () => {
      const options = {};
      const settings = {};

      describe('and there is not settings', () => {
        const serverless = { cli: { log: sinon.stub() } };
        const plugin = new ApiGatewayCachingPlugin(serverless, options);
        const restApiExists = sinon.stub().returns(true);
        const updateStageCacheSettings = sinon.stub();

        before(() => {
          plugin.createSettings = sinon.stub().callsFake(() => {
            plugin.settings = settings;
          });
          plugin.updateStage({ restApiExists, updateStageCacheSettings });
        });

        it('should call restApiExists', () =>
          expect(restApiExists).to.be.calledWith(serverless));

        it('should call serverless cli log', () =>
          expect(serverless.cli.log).to.not.be.called);

        it('should call createSettings', () =>
          expect(plugin.createSettings).to.be.called);

        it('should call updateStageCacheSettings', () =>
          expect(updateStageCacheSettings).to.be.calledWith(
            settings,
            serverless
          ));
      });

      describe('and there is settings', () => {
        const serverless = { cli: { log: sinon.stub() } };
        const plugin = new ApiGatewayCachingPlugin(serverless, options);
        const restApiExists = sinon.stub().returns(true);
        const updateStageCacheSettings = sinon.stub();

        before(() => {
          plugin.settings = settings;
          plugin.createSettings = sinon.stub();
          plugin.updateStage({ restApiExists, updateStageCacheSettings });
        });

        it('should call restApiExists', () =>
          expect(restApiExists).to.be.calledWith(serverless));

        it('should call serverless cli log', () =>
          expect(serverless.cli.log).to.not.be.called);

        it('should call createSettings', () =>
          expect(plugin.createSettings).to.not.be.called);

        it('should call updateStageCacheSettings', () =>
          expect(updateStageCacheSettings).to.be.calledWith(
            settings,
            serverless
          ));
      });
    });
  });
});
