const given = require('../test/steps/given');
const when = require('../test/steps/when');
const ApiGatewayCachingSettings = require(`../src/ApiGatewayCachingSettings`);
const expect = require('chai').expect;

describe('Inheriting CloudWatch settings from stage', () => {
  const apiGatewayService = 'APIGateway', updateStageMethod = 'updateStage';
  describe('when some endpoints are configured to inherit CloudWatch settings from stage and some are not', () => {
    before(async () => {
      let restApiId = given.a_rest_api_id();
      let endpointWithInheritedCwSettings = given.a_serverless_function('get-my-cat')
        .withHttpEndpoint('get', '/', { inheritCloudWatchSettingsFromStage: true })
      let endpointWithoutInheritedCwSettings = given.a_serverless_function('get-cat-by-paw-id')
        .withHttpEndpoint('get', '/cat/{pawId}', { inheritCloudWatchSettingsFromStage: false })
      serverless = given.a_serverless_instance()
        .forStage('somestage')
        .withRestApiId(restApiId)
        .withApiGatewayCachingConfig({ endpointsInheritCloudWatchSettingsFromStage: true })
        .withFunction(endpointWithInheritedCwSettings)
        .withFunction(endpointWithoutInheritedCwSettings)
        .withStageSettingsForCloudWatchMetrics({ loggingLevel: 'WARN', dataTraceEnabled: false, metricsEnabled: true });
      settings = new ApiGatewayCachingSettings(serverless);

      await when.updating_stage_cache_settings(settings, serverless);

      requestsToAws = serverless.getRequestsToAws();
    });

    describe('the request sent to AWS SDK to update stage', () => {
      before(() => {
        apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
      });

      describe('for the endpoint which inherits CloudWatch settings from stage', () => {
        it('should set the value of logging/logLevel the same as the stage value of logging/logLevel', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1/GET/logging/loglevel',
            value: 'WARN'
          });
        });

        it('should set the value of logging/dataTrace the same as the stage value of logging/dataTraceEnabled', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1/GET/logging/dataTrace',
            value: 'false'
          });
        });

        it('should set the value of metrics/enabled the same as the stage value of metrics/enabled', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1/GET/metrics/enabled',
            value: 'true'
          });
        });
      });

      describe('for the endpoint which does not inherit CloudWatch settings from stage', () => {
        it('should not set the value of logging/logLevel', () => {
          let operation = apiGatewayRequest.properties.patchOperations
            .find(o => o.path == '/~1cat~1{pawId}/GET/logging/logLevel');
          expect(operation).to.not.exist;
        });

        it('should not set the value of logging/dataTrace', () => {
          let operation = apiGatewayRequest.properties.patchOperations
            .find(o => o.path == '/~1cat~1{pawId}/GET/logging/dataTrace');
          expect(operation).to.not.exist;
        });

        it('should not set the value of metrics/enabled', () => {
          let operation = apiGatewayRequest.properties.patchOperations
            .find(o => o.path == '/~1cat~1{pawId}/GET/metrics/enabled');
          expect(operation).to.not.exist;
        });
      });
    });
  });
});
