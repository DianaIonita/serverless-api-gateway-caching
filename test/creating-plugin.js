'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const expect = chai.expect;

describe('Creating plugin', () => {
  describe('When updating the CloudFormation template', () => {
    let scenarios = [
      {
        description: 'there is no REST API',
        thereIsARestApi: false,
        expectedLogMessage: '[serverless-api-gateway-caching] No REST API found. Caching settings will not be updated.',
        expectedToOutputRestApiId: false,
        expectedToAddCacheKeyParametersConfig: false
      },
      {
        description: 'there is a REST API and caching is enabled',
        cachingEnabled: true,
        thereIsARestApi: true,
        expectedLogMessage: undefined,
        expectedToOutputRestApiId: true,
        expectedToAddCacheKeyParametersConfig: true,
      },
      {
        description: 'there is a REST API and caching is disabled',
        cachingEnabled: false,
        thereIsARestApi: true,
        expectedLogMessage: undefined,
        expectedToOutputRestApiId: true,
        expectedToAddCacheKeyParametersConfig: false,
      }
    ];

    for (let scenario of scenarios) {
      describe(`and ${scenario.description}`, () => {
        let logCalledWith, outputRestApiIdCalled = false, addCacheKeyParametersConfigCalled = false;
        const serverless = { cli: { log: (message) => { logCalledWith = message } } };
        const restApiIdStub = {
          restApiExists: () => scenario.thereIsARestApi,
          outputRestApiIdTo: () => outputRestApiIdCalled = true
        };
        const cacheKeyParametersStub = {
          addCacheKeyParametersConfig: () => addCacheKeyParametersConfigCalled = true
        }
        const ApiGatewayCachingPlugin = proxyquire('../src/apiGatewayCachingPlugin', { './restApiId': restApiIdStub, './cacheKeyParameters': cacheKeyParametersStub });

        before(() => {
          const plugin = new ApiGatewayCachingPlugin(serverless, {});
          plugin.settings = { cachingEnabled: scenario.cachingEnabled }
          plugin.updateCloudFormationTemplate();
        });

        it('should log a message', () => {
          expect(logCalledWith).to.equal(scenario.expectedLogMessage);
        });

        it(`is expected to output REST API ID: ${scenario.expectedToOutputRestApiId}`, () => {
          expect(outputRestApiIdCalled).to.equal(scenario.expectedToOutputRestApiId);
        });

        it(`is expected to add path parameters to cache config: ${scenario.expectedToAddCacheKeyParametersConfig}`, () => {
          expect(addCacheKeyParametersConfigCalled).to.equal(scenario.expectedToAddCacheKeyParametersConfig);
        });
      });
    }
  });

  describe('When updating the stage', () => {
    let scenarios = [
      {
        description: 'there is no REST API',
        thereIsARestApi: false,
        expectedLogMessage: '[serverless-api-gateway-caching] No REST API found. Caching settings will not be updated.',
        expectedToUpdateStageCache: false,
        expectedToHaveSettings: true
      },
      {
        description: 'there is a REST API',
        thereIsARestApi: true,
        expectedLogMessage: undefined,
        expectedToUpdateStageCache: true,
        expectedToHaveSettings: true
      }
    ];

    for (let scenario of scenarios) {
      describe(`and ${scenario.description}`, () => {
        let logCalledWith, updateStageCacheSettingsCalled = false;
        const serverless = { cli: { log: (message) => { logCalledWith = message } } };
        const restApiIdStub = {
          restApiExists: () => scenario.thereIsARestApi,
          outputRestApiIdTo: () => {}
        };
        const stageCacheStub = {
          updateStageCacheSettings: () => updateStageCacheSettingsCalled = true
        };
        const ApiGatewayCachingPlugin = proxyquire('../src/apiGatewayCachingPlugin', { './restApiId': restApiIdStub, './stageCache': stageCacheStub });
        const plugin = new ApiGatewayCachingPlugin(serverless, {});

        before(async () => {
          await plugin.updateStage();
        });

        it('should log a message', () => {
          expect(logCalledWith).to.equal(scenario.expectedLogMessage);
        });

        it(`is expected to have settings: ${scenario.expectedToHaveSettings}`, () => {
          if (scenario.expectedToHaveSettings) {
            expect(plugin.settings).to.exist;
          } else {
            expect(plugin.settings).to.not.exist;
          }
        });

        it(`is expected to update stage cache: ${scenario.expectedToUpdateStageCache}`, () => {
          expect(updateStageCacheSettingsCalled).to.equal(scenario.expectedToUpdateStageCache);
        });
      });
    }
  });
});
