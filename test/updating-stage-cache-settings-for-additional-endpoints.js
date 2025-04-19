const given = require('../test/steps/given');
const when = require('../test/steps/when');
const ApiGatewayCachingSettings = require('../src/ApiGatewayCachingSettings');
const { updateStageCacheSettings } = require('../src/stageCache');
const expect = require('chai').expect;

describe('Updating stage cache settings for additional endpoints defined as CloudFormation', () => {
  let serverless, settings, requestsToAws, apiGatewayRequest;
  const apiGatewayService = 'APIGateway', updateStageMethod = 'updateStage';

  // Described in https://github.com/DianaIonita/serverless-api-gateway-caching/pull/68
  describe('When API Gateway caching is enabled', () => {

    describe('and there are additionalEndpoints configured for HTTP endpoints defined as CloudFormation', () => {
      before(async () => {
        const additionalEndpoints = [
          given.an_additional_endpoint({
            method: 'GET', path: '/items',
            caching: { enabled: true, ttlInSeconds: 120 }
          }),
          given.an_additional_endpoint({
            method: 'POST', path: '/blue-items',
            caching: { enabled: false }
          })];

        restApiId = given.a_rest_api_id();
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig()
          .withAdditionalEndpoints(additionalEndpoints)
          .withRestApiId(restApiId)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        await when.updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the REST API ID', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        it('should specify exactly twelve patch operations', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.have.lengthOf(12);
        });

        it('should enable caching', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterEnabled',
            value: 'true'
          });
        });

        it('should set the cache cluster size', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/cacheClusterSize',
            value: '0.5'
          });
        });

        it('should set the cache encryption', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/*/*/caching/dataEncrypted',
            value: 'false'
          });
        });

        it('should set the cache ttlInSeconds', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/*/*/caching/ttlInSeconds',
            value: '45'
          });
        });
      });

      describe('for the endpoint with caching enabled', () => {
        it('should enable caching', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1items/GET/caching/enabled',
            value: 'true'
          });
        });

        it('should set the correct cache time to live', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1items/GET/caching/ttlInSeconds',
            value: '120'
          });
        });

        it('should specify whether data is encrypted', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1items/GET/caching/dataEncrypted',
            value: 'false'
          });
        });
      });

      describe('for each endpoint with caching disabled', () => {
        it('should disable caching', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.deep.include({
            op: 'replace',
            path: '/~1blue-items/POST/caching/enabled',
            value: 'false'
          });
        });
      });
    });
  });
});
