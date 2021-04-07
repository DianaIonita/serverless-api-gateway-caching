const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const expect = require('chai').expect;
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);

describe('Configuring a default base path', () => {
  const serviceName = 'cat-api';
  const endpointPath = '/cat/{pawId}';
  const functionName = 'get-cat-by-paw-id';

  describe('when a base path is specified', () => {
    const scenarios = [
      {
        description: 'does not start with a forward slash',
        basePath: 'animals'
      },
      {
        description: 'starts with a forward slash',
        basePath: '/animals'
      },
      {
        description: 'has a trailing slash',
        basePath: 'animals/'
      }
    ];
    let settings;
    
    for (scenario of scenarios) {
      describe(`and ${scenario.description}`, () => {
        before(() => {
          const endpoint = given
            .a_serverless_function(functionName)
            .withHttpEndpoint('get', endpointPath, { enabled: true });
            
          const serverless = given
            .a_serverless_instance(serviceName)
            .withApiGatewayCachingConfig({ basePath: scenario.basePath })
            .withFunction(endpoint);
    
          settings = new ApiGatewayCachingSettings(serverless);
        });
    
        it('should be prepended to each endpoint and form a valid path', () => {
          expect(path_of(functionName, settings)).to.equal(`/animals${endpointPath}`);
        });
      });
    }
  });

  describe('when no base path is specified', () => {
    before(() => {
      const endpoint = given
        .a_serverless_function(functionName)
        .withHttpEndpoint('get', endpointPath, { enabled: true });
      
      const serverless = given
        .a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig()
        .withFunction(endpoint);

        settings = new ApiGatewayCachingSettings(serverless);
    });

    it('should just use the endpoint path', () => {      
      expect(path_of(functionName, settings)).to.equal(endpointPath);
    });
  });
});

const path_of = (functionName, settings) => {
    return settings
      .endpointSettings
      .find(x => x.functionName === functionName)
      .path;
}
