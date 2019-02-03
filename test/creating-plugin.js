'use strict';

const chai = require('chai');
const proxyquire = require('proxyquire');
const expect = chai.expect;

describe('Creating plugin', () => {
  describe('When updating the CloudFormation template', () => {
    let scenarios = [
      {
        description: 'there is no rest api',
        thereIsARestApi: false,
        expectedLogMessage: '[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.',
        expectedToOutputRestApiId: false,
        expectedToAddPathParametersCacheConfig: false
      },
      {
        description: 'there is a rest api and caching is enabled',
        cachingEnabled: true,
        thereIsARestApi: true,
        expectedLogMessage: undefined,
        expectedToOutputRestApiId: true,
        expectedToAddPathParametersCacheConfig: true,
      },
      {
        description: 'there is a rest api and caching is disabled',
        cachingEnabled: false,
        thereIsARestApi: true,
        expectedLogMessage: undefined,
        expectedToOutputRestApiId: true,
        expectedToAddPathParametersCacheConfig: false,
      }
    ];

    for (let scenario of scenarios) {
      describe(`and ${scenario.description}`, () => {
        let logCalledWith, outputRestApiIdCalled = false, addPathParametersCacheConfigCalled = false;
        const serverless = { cli: { log: (message) => { logCalledWith = message } } };
        const restApiIdStub = {
          restApiExists: () => scenario.thereIsARestApi,
          outputRestApiIdTo: () => outputRestApiIdCalled = true
        };
        const pathParametersCacheStub = {
          addPathParametersCacheConfig: () => addPathParametersCacheConfigCalled = true
        }
        const ApiGatewayCachingPlugin = proxyquire('../src/apiGatewayCachingPlugin', { './restApiId': restApiIdStub, './pathParametersCache': pathParametersCacheStub });

        before(() => {
          const plugin = new ApiGatewayCachingPlugin(serverless, {});
          plugin.settings = { cachingEnabled: scenario.cachingEnabled }
          plugin.updateCloudFormationTemplate();
        });

        it('should log a message', () => {
          expect(logCalledWith).to.equal(scenario.expectedLogMessage);
        });

        it(`is expected to output rest api id: ${scenario.expectedToOutputRestApiId}`, () => {
          expect(outputRestApiIdCalled).to.equal(scenario.expectedToOutputRestApiId);
        });

        it(`is expected to add path parameters to cache config: ${scenario.expectedToAddPathParametersCacheConfig}`, () => {
          expect(addPathParametersCacheConfigCalled).to.equal(scenario.expectedToAddPathParametersCacheConfig);
        });
      });
    }
  });

  describe('When updating the stage', () => {
    let scenarios = [
      {
        description: 'there is no rest api',
        thereIsARestApi: false,
        expectedLogMessage: '[serverless-api-gateway-caching] No Rest API found. Caching settings will not be updated.',
        expectedToUpdateStageCache: false,
        expectedToHaveSettings: false
      },
      {
        description: 'there is a rest api',
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
          outputRestApiIdTo: () => outputRestApiIdCalled = true
        };
        const stageCacheStub = () => updateStageCacheSettingsCalled = true;
        const ApiGatewayCachingPlugin = proxyquire('../src/apiGatewayCachingPlugin', { './restApiId': restApiIdStub, './stageCache': stageCacheStub });
        const plugin = new ApiGatewayCachingPlugin(serverless, {});

        before(() => {
          plugin.updateStage();
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
