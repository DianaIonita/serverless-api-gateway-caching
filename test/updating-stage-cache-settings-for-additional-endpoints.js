const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const updateStageCacheSettings = require(`${APP_ROOT}/src/stageCache`);
const UnauthorizedCacheControlHeaderStrategy = require(`${APP_ROOT}/src/UnauthorizedCacheControlHeaderStrategy`);
const expect = require('chai').expect;

describe('Updating stage cache settings for additional endpoints defined as CloudFormation', () => {
  let serverless, settings, requestsToAws, apiGatewayRequest;
  const apiGatewayService = 'APIGateway', updateStageMethod = 'updateStage';

  // TODO
  describe('When API Gateway caching is disabled', () => {
    describe('and there are only additional endpoints defined', () => {
      // disables caching
    });
  });

  describe('When API Gateway caching is enabled', () => {
    describe('and there are additionalEndpoints configured for HTTP endpoints defined as CloudFormation', () => {
      describe('and there are no other endpoints with caching enabled', () => {
      });

      describe('and there are other endpoints with caching enabled', () => {

      });
    });
  });


  // Described in https://github.com/DianaIonita/serverless-api-gateway-caching/pull/68
  describe('When there are additionalEndpoints configured for HTTP endpoints defined as CloudFormation', () => {
    const additionalEndpoints = [given.an_additional_endpoint({ method: 'GET', path: '/', caching: { enabled: true, ttlInSeconds: 120 } })];

    describe('and there are no other endpoints with caching enabled', () => {
      before(async () => {
        serverless = given.a_serverless_instance()
          .withApiGatewayCachingConfig(true, '0.5', 60)
          .withAdditionalEndpoints(additionalEndpoints)
          .forStage('somestage');
        settings = new ApiGatewayCachingSettings(serverless);

        restApiId = await given.a_rest_api_id_for_deployment(serverless, settings);

        await when_updating_stage_cache_settings(settings, serverless);

        requestsToAws = serverless.getRequestsToAws();
      });

      describe('the request sent to AWS SDK to update stage', () => {
        before(() => {
          apiGatewayRequest = requestsToAws.find(r => r.awsService == apiGatewayService && r.method == updateStageMethod);
        });

        it('should contain the Rest Api Id', () => {
          expect(apiGatewayRequest.properties.restApiId).to.equal(restApiId);
        });

        it('should contain the stage name', () => {
          expect(apiGatewayRequest.properties.stageName).to.equal('somestage');
        });

        it('should specify exactly four patch operations', () => {
          expect(apiGatewayRequest.properties.patchOperations).to.have.lengthOf(4);
        })

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
            value: '60'
          });
        });
      });
    });

    describe('and there are other endpoints with caching enabled', () => {

    })
  });
});

const when_updating_stage_cache_settings = async (settings, serverless) => {
  return await updateStageCacheSettings(settings, serverless);
}
