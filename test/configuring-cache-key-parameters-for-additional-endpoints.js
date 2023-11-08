const given = require('../test/steps/given');
const ApiGatewayCachingSettings = require('../src/ApiGatewayCachingSettings');
const cacheKeyParams = require('../src/cacheKeyParameters');
const expect = require('chai').expect;

describe('Configuring path parameters for additional endpoints defined as CloudFormation', () => {
    let serverless;
    let serviceName = 'cat-api', stage = 'dev';

    describe('when there are no additional endpoints', () => {
        before(() => {
            serverless = given.a_serverless_instance(serviceName)
                .withApiGatewayCachingConfig()
                .forStage(stage);
        });

        it('should do nothing to the serverless instance', () => {
            let stringified = JSON.stringify(serverless);
            when_configuring_cache_key_parameters(serverless);
            let stringifiedAfter = JSON.stringify(serverless);
            expect(stringified).to.equal(stringifiedAfter);
        });
    });

    describe('when one of the additional endpoints has cache key parameters', () => {
        let cacheKeyParameters, apiGatewayMethod;
        before(() => {
            cacheKeyParameters = [
                { name: 'request.path.pawId' },
                { name: 'request.header.Accept-Language' }]
            const additionalEndpointWithCaching = given.an_additional_endpoint({
                method: 'GET', path: '/items',
                caching: {
                    enabled: true, ttlInSeconds: 120,
                    cacheKeyParameters
                }
            })
            const additionalEndpointWithoutCaching = given.an_additional_endpoint({
                method: 'POST', path: '/blue-items',
                caching: { enabled: true }
            });

            serverless = given.a_serverless_instance(serviceName)
                .withApiGatewayCachingConfig()
                .withAdditionalEndpoints([additionalEndpointWithCaching, additionalEndpointWithoutCaching])
                .forStage('somestage');

            when_configuring_cache_key_parameters(serverless);

            apiGatewayMethod = serverless.getMethodResourceForAdditionalEndpoint(additionalEndpointWithCaching);
        });

        it('should configure the method\'s request parameters', () => {
            for (let parameter of cacheKeyParameters) {
                expect(apiGatewayMethod.Properties.RequestParameters)
                    .to.deep.include({
                        [`method.${parameter.name}`]: true
                    });
            }
        });

        it('should not set integration request parameters', () => {
            for (let parameter of cacheKeyParameters) {
                expect(apiGatewayMethod.Properties.Integration.RequestParameters)
                    .to.not.include({
                        [`integration.${parameter.name}`]: `method.${parameter.name}`
                    });
            }
        });

        it('should set the method\'s integration cache key parameters', () => {
            for (let parameter of cacheKeyParameters) {
                expect(apiGatewayMethod.Properties.Integration.CacheKeyParameters)
                    .to.include(`method.${parameter.name}`);
            }
        });

        it('should set a cache namespace', () => {
            expect(apiGatewayMethod.Properties.Integration.CacheNamespace).to.exist;
        });
    });
});

const when_configuring_cache_key_parameters = (serverless) => {
    let cacheSettings = new ApiGatewayCachingSettings(serverless);
    return cacheKeyParams.addCacheKeyParametersConfig(cacheSettings, serverless);
}
