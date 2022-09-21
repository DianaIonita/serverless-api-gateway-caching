const given = require('../test/steps/given');
const ApiGatewayCachingSettings = require('../src/ApiGatewayCachingSettings');
const pathParams = require('../src/pathParametersCache');
const expect = require('chai').expect;

describe('Configuring path parameters for additional endpoints defined as CloudFormation', () => {
    let serverless;
    describe('when one of the additional endpoints has cache key parameters', () => {
        let cacheKeyParameters, method, functionWithCachingName;
        before(() => {
            const additionalEndpoints = [
                given.an_additional_endpoint({
                    method: 'GET', path: '/items',
                    caching: {
                        enabled: true, ttlInSeconds: 120,
                        cacheKeyParameters: [
                            { name: 'request.path.pawId' },
                            { name: 'request.header.Accept-Language' }]
                    }
                }),
                given.an_additional_endpoint({
                    method: 'POST', path: '/blue-items',
                    caching: { enabled: true }
                })];

            // functionWithCachingName = 'get-cat-by-paw-id';
            // cacheKeyParameters = [{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }];

            let functionWithCaching = given.a_serverless_function(functionWithCachingName)
                .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, cacheKeyParameters });

            serverless = given.a_serverless_instance(serviceName)
                .withApiGatewayCachingConfig()
                .withAdditionalEndpoints(additionalEndpoints)
                .forStage('somestage');

            when_configuring_path_parameters(serverless);

            method = serverless.getMethodResourceForFunction(functionWithCachingName);
        });

        it('should configure the method\'s request parameters', () => {
            for (let parameter of cacheKeyParameters) {
                expect(method.Properties.RequestParameters)
                    .to.deep.include({
                        [`method.${parameter.name}`]: {}
                    });
            }
        });

        it('should not set integration request parameters', () => {
            for (let parameter of cacheKeyParameters) {
                expect(method.Properties.Integration.RequestParameters)
                    .to.not.include({
                        [`integration.${parameter.name}`]: `method.${parameter.name}`
                    });
            }
        });

        it('should set the method\'s integration cache key parameters', () => {
            for (let parameter of cacheKeyParameters) {
                expect(method.Properties.Integration.CacheKeyParameters)
                    .to.include(`method.${parameter.name}`);
            }
        });

        it('should set a cache namespace', () => {
            expect(method.Properties.Integration.CacheNamespace).to.exist;
        });
    });
});

const when_configuring_path_parameters = (serverless) => {
    let cacheSettings = new ApiGatewayCachingSettings(serverless);
    return pathParams.addPathParametersCacheConfig(cacheSettings, serverless);
}
