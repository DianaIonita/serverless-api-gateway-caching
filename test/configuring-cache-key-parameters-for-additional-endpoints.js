describe('Configuring cache key parameters for additional endpoints', () => {
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
});

const when_configuring_cache_key_parameters = (serverless) => {
    let cacheSettings = new ApiGatewayCachingSettings(serverless);
    return cacheKeyParams.addCacheKeyParametersConfig(cacheSettings, serverless);
}
