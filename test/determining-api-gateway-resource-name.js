const given = require('../test/steps/given');
const expect = require('chai').expect;
const ApiGatewayCachingSettings = require('../src/ApiGatewayCachingSettings');

describe('Determining API Gateway resource names', () => {
  const serviceName = 'cat-api';
  const functionName = 'get-cat-by-paw-id';

  const scenarios = [
    {
      path: '/',
      method: 'GET',
      expectedGatewayResourceName: 'ApiGatewayMethodGet'
    },
    {
      path: '/',
      method: 'POST',
      expectedGatewayResourceName: 'ApiGatewayMethodPost'
    },
    {
      path: '/cat/{pawId}',
      method: 'GET',
      expectedGatewayResourceName: 'ApiGatewayMethodCatPawidVarGet'
    },
    {
      path: '/{id}',
      method: 'PATCH',
      expectedGatewayResourceName: 'ApiGatewayMethodIdVarPatch'
    }
  ];
  for (const scenario of scenarios) {


    describe('when a base path is not specified', () => {
      before(() => {
        const endpoint = given
          .a_serverless_function(functionName)
          .withHttpEndpoint(scenario.method, scenario.path, { enabled: true });

        const serverless = given
          .a_serverless_instance(serviceName)
          .withApiGatewayCachingConfig({ enabled: true })
          .withFunction(endpoint);

        settings = new ApiGatewayCachingSettings(serverless);
      });

      it('determines the resource name based on endpoint path and method', () => {
        expect(gatewayResourceNameOf(functionName, settings)).to.equal(scenario.expectedGatewayResourceName);
      });
    });

    describe('when a base path is specified', () => {
      before(() => {
        const endpoint = given
          .a_serverless_function(functionName)
          .withHttpEndpoint(scenario.method, scenario.path, { enabled: true });

        const serverless = given
          .a_serverless_instance(serviceName)
          .withApiGatewayCachingConfig({ enabled: true, basePath: '/animals' })
          .withFunction(endpoint);

        settings = new ApiGatewayCachingSettings(serverless);
      });

      it('is not included in the API Gateway resource name', () => {
        expect(gatewayResourceNameOf(functionName, settings)).to.equal(scenario.expectedGatewayResourceName);
      });
    });
  }
});

const gatewayResourceNameOf = (functionName, settings) => {
  return settings
    .endpointSettings
    .find(x => x.functionName === functionName)
    .gatewayResourceName;
}
