const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const ApiGatewayCachingSettings = require(`${APP_ROOT}/src/ApiGatewayCachingSettings`);
const pathParams = require(`${APP_ROOT}/src/pathParametersCache`);
const expect = require('chai').expect;

describe('Configuring path parameter caching', () => {
  let serverless;
  let serviceName = 'cat-api', stage = 'dev';

  describe('when there are no endpoints', () => {
    before(() => {
      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage);
    });

    it('should do nothing to the serverless instance', () => {
      let stringified = JSON.stringify(serverless);
      when_configuring_path_parameters(serverless);
      let stringifiedAfter = JSON.stringify(serverless);
      expect(stringified).to.equal(stringifiedAfter);
    });
  });

  describe('when there are no endpoints with cache key parameters', () => {
    before(() => {
      let endpoint = given.a_serverless_function('get-cat-by-paw-id')
        .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true });
      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage)
        .withFunction(endpoint);
    });

    it('should do nothing to the serverless instance', () => {
      let stringified = JSON.stringify(serverless);
      when_configuring_path_parameters(serverless);
      let stringifiedAfter = JSON.stringify(serverless);
      expect(stringified).to.equal(stringifiedAfter);
    });
  });

  describe('when one endpoint with lambda integration has cache key parameters', () => {
    let cacheKeyParameters, method, functionWithCachingName;
    before(() => {
      functionWithCachingName = 'get-cat-by-paw-id';
      cacheKeyParameters = [{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }];

      const withLambdaIntegration = true;
      let functionWithCaching = given.a_serverless_function(functionWithCachingName)
        .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, cacheKeyParameters }, withLambdaIntegration);

      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage)
        .withFunction(functionWithCaching);

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

    it('should not set any integration request parameters', () => {
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

  describe('when one of the endpoints has cache key parameters', () => {
    let cacheKeyParameters, method;
    let functionWithoutCachingName, functionWithCachingName;
    before(() => {
      functionWithoutCachingName = 'list-all-cats';
      let functionWithoutCaching = given.a_serverless_function(functionWithoutCachingName)
        .withHttpEndpoint('get', '/cats');

      functionWithCachingName = 'get-cat-by-paw-id';
      cacheKeyParameters = [{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }];
      let functionWithCaching = given.a_serverless_function(functionWithCachingName)
        .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, cacheKeyParameters });

      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage)
        .withFunction(functionWithCaching)
        .withFunction(functionWithoutCaching);

      when_configuring_path_parameters(serverless);
    });


    describe('on the method corresponding with the endpoint with cache key parameters', () => {
      before(() => {
        method = serverless.getMethodResourceForFunction(functionWithCachingName);
      });

      it('should configure them as request parameters', () => {
        for (let parameter of cacheKeyParameters) {
          expect(method.Properties.RequestParameters)
            .to.deep.include({
              [`method.${parameter.name}`]: {}
            });
        }
      });

      it('should set integration request parameters', () => {
        for (let parameter of cacheKeyParameters) {
          expect(method.Properties.Integration.RequestParameters)
            .to.deep.include({
              [`integration.${parameter.name}`]: `method.${parameter.name}`
            });
        }
      });

      it('should set integration cache key parameters', () => {
        for (let parameter of cacheKeyParameters) {
          expect(method.Properties.Integration.CacheKeyParameters)
            .to.include(`method.${parameter.name}`);
        }
      });

      it('should set a cache namespace', () => {
        expect(method.Properties.Integration.CacheNamespace).to.exist;
      });
    });

    describe('on the method resource corresponding with the endpoint without cache key parameters', () => {
      before(() => {
        method = serverless.getMethodResourceForFunction(functionWithoutCachingName);
      });

      it('should not set whether request parameters are required', () => {
        expect(method.Properties.RequestParameters).to.deep.equal({});
      });

      it('should not set integration request parameters', () => {
        expect(method.Properties.Integration.RequestParameters).to.not.exist;
      });

      it('should not set integration cache key parameters', () => {
        expect(method.Properties.Integration.CacheKeyParameters).to.not.exist;
      });

      it('should not set a cache namespace', () => {
        expect(method.Properties.Integration.CacheNamespace).to.not.exist;
      });
    });
  });

  describe('when one endpoint has cache key parameters and a path parameter containing underscore', () => {
    let cacheKeyParameters, method;
    let functionWithoutCachingName, functionWithCachingName;
    before(() => {
      functionWithoutCachingName = 'list-all-cats';
      let functionWithoutCaching = given.a_serverless_function(functionWithoutCachingName)
        .withHttpEndpoint('get', '/cats');

      functionWithCachingName = 'get-cat-by-paw-id';
      cacheKeyParameters = [{ name: 'request.path.paw_id' }, { name: 'request.header.Accept-Language' }];
      let functionWithCaching = given.a_serverless_function(functionWithCachingName)
        .withHttpEndpoint('get', '/cat/{paw_id}', { enabled: true, cacheKeyParameters });

      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage)
        .withFunction(functionWithCaching)
        .withFunction(functionWithoutCaching);

      when_configuring_path_parameters(serverless);
    });

    describe('on the method corresponding with the endpoint with cache key parameters', () => {
      before(() => {
        method = serverless.getMethodResourceForFunction(functionWithCachingName);
      });

      it('should configure them as request parameters', () => {
        for (let parameter of cacheKeyParameters) {
          expect(method.Properties.RequestParameters)
            .to.deep.include({
              [`method.${parameter.name}`]: {}
            });
        }
      });

      it('should set integration request parameters', () => {
        for (let parameter of cacheKeyParameters) {
          expect(method.Properties.Integration.RequestParameters)
            .to.deep.include({
              [`integration.${parameter.name}`]: `method.${parameter.name}`
            });
        }
      });

      it('should set integration cache key parameters', () => {
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

  describe('when one endpoint has cache key parameters', () => {
    let cacheKeyParameters, functionWithCachingName;
    before(() => {
      functionWithCachingName = 'get-cat-by-paw-id';
      cacheKeyParameters = [{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }];

      let functionWithCaching = given.a_serverless_function(functionWithCachingName)
        .withHttpEndpoint('get', '/cat/{pawId}', { enabled: true, cacheKeyParameters });

      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage)
        .withFunction(functionWithCaching);
    });

    let alreadyConfiguredParamsScenarios = [
      {
        description: "required",
        isRequired: true
      },
      {
        description: "not required",
        isRequired: false
      }
    ];
    for (let { description, isRequired } of alreadyConfiguredParamsScenarios) {
      describe(`and one of them has been already configured as ${description} for http request validation by another plugin`, () => {
        let method;
        before(() => {
          method = serverless.getMethodResourceForFunction(functionWithCachingName);
          method.Properties.RequestParameters[`method.${cacheKeyParameters[0].name}`] = isRequired;

          when_configuring_path_parameters(serverless)
        });

        it('should keep configuration', () => {
          expect(method.Properties.RequestParameters)
            .to.deep.include({
              [`method.${cacheKeyParameters[0].name}`]: isRequired
            });
        });
      });
    }
  });

  describe('when there are two endpoints with a cache key parameter', () => {
    describe(`and the second endpoint's name is a substring of the first endpoint's name`, () => {
      let method, firstEndpointName, firstEndpointCacheKeyParameters, secondEndpointName, secondEndpointCacheKeyParameters;
      before(() => {
        firstEndpointName = 'catpaw';
        secondEndpointName = 'paw';
        firstEndpointCacheKeyParameters = [{ name: 'request.path.catPawId' }];
        secondEndpointCacheKeyParameters = [{ name: 'request.path.pawId' }];

        let firstFunctionWithCaching = given.a_serverless_function(firstEndpointName)
          .withHttpEndpoint('get', '/cat/paw/{pawId}', { enabled: true, cacheKeyParameters: firstEndpointCacheKeyParameters });

        let secondFunctionWithCaching = given.a_serverless_function(secondEndpointName)
          .withHttpEndpoint('get', '/paw/{catPawId}', { enabled: true, cacheKeyParameters: secondEndpointCacheKeyParameters });

        serverless = given.a_serverless_instance(serviceName)
          .withApiGatewayCachingConfig(true, '0.5', 45)
          .forStage(stage)
          .withFunction(firstFunctionWithCaching)
          .withFunction(secondFunctionWithCaching);

        when_configuring_path_parameters(serverless);
      });

      describe('on the method corresponding with the first endpoint with cache key parameters', () => {
        before(() => {
          method = serverless.getMethodResourceForFunction(firstEndpointName);
        });

        it('should configure them as request parameters', () => {
          for (let parameter of firstEndpointCacheKeyParameters) {
            expect(method.Properties.RequestParameters)
              .to.deep.include({
                [`method.${parameter.name}`]: {}
              });
          }
        });

        it('should set integration request parameters', () => {
          for (let parameter of firstEndpointCacheKeyParameters) {
            expect(method.Properties.Integration.RequestParameters)
              .to.deep.include({
                [`integration.${parameter.name}`]: `method.${parameter.name}`
              });
          }
        });

        it('should set integration cache key parameters', () => {
          for (let parameter of firstEndpointCacheKeyParameters) {
            expect(method.Properties.Integration.CacheKeyParameters)
              .to.include(`method.${parameter.name}`);
          }
        });

        it('should set a cache namespace', () => {
          expect(method.Properties.Integration.CacheNamespace).to.exist;
        });
      });

      describe('on the method corresponding with the second endpoint with cache key parameters', () => {
        before(() => {
          method = serverless.getMethodResourceForFunction(secondEndpointName);
        });

        it('should configure them as request parameters', () => {
          for (let parameter of secondEndpointCacheKeyParameters) {
            expect(method.Properties.RequestParameters)
              .to.deep.include({
                [`method.${parameter.name}`]: {}
              });
          }
        });

        it('should set integration request parameters', () => {
          for (let parameter of secondEndpointCacheKeyParameters) {
            expect(method.Properties.Integration.RequestParameters)
              .to.deep.include({
                [`integration.${parameter.name}`]: `method.${parameter.name}`
              });
          }
        });

        it('should set integration cache key parameters', () => {
          for (let parameter of secondEndpointCacheKeyParameters) {
            expect(method.Properties.Integration.CacheKeyParameters)
              .to.include(`method.${parameter.name}`);
          }
        });

        it('should set a cache namespace', () => {
          expect(method.Properties.Integration.CacheNamespace).to.exist;
        });
      });
    });
  });

  describe('when there are two endpoints with a cache key parameter on the same function', () => {
    let method, functionName, firstEndpointCacheKeyParameters, secondEndpointCacheKeyParameters;
    before(() => {
      functionName = 'catpaw';

      firstEndpointCacheKeyParameters = [{ name: 'request.path.pawId' }];
      secondEndpointCacheKeyParameters = [{ name: 'request.path.pawId' }];

      let firstFunctionWithCaching = given.a_serverless_function(functionName)
        .withHttpEndpoint('get', '/cat/paw/{pawId}', { enabled: true, cacheKeyParameters: firstEndpointCacheKeyParameters })
        .withHttpEndpoint('delete', '/cat/paw/{pawId}', { enabled: true, cacheKeyParameters: secondEndpointCacheKeyParameters });
      serverless = given.a_serverless_instance(serviceName)
        .withApiGatewayCachingConfig(true, '0.5', 45)
        .forStage(stage)
        .withFunction(firstFunctionWithCaching)

      when_configuring_path_parameters(serverless);
    });

    describe('on the method corresponding with the first endpoint with cache key parameters', () => {
      before(() => {
        method = serverless.getMethodResourceForMethodName("ApiGatewayMethodCatPawPawidVarGet");
      });

      it('should configure them as request parameters', () => {
        for (let parameter of firstEndpointCacheKeyParameters) {
          expect(method.Properties.RequestParameters)
            .to.deep.include({
              [`method.${parameter.name}`]: {}
            });
        }
      });

      it('should set integration request parameters', () => {
        for (let parameter of firstEndpointCacheKeyParameters) {
          expect(method.Properties.Integration.RequestParameters)
            .to.deep.include({
              [`integration.${parameter.name}`]: `method.${parameter.name}`
            });
        }
      });

      it('should set integration cache key parameters', () => {
        for (let parameter of firstEndpointCacheKeyParameters) {
          expect(method.Properties.Integration.CacheKeyParameters)
            .to.include(`method.${parameter.name}`);
        }
      });

      it('should set a cache namespace', () => {
        expect(method.Properties.Integration.CacheNamespace).to.exist;
      });
    });

    describe('on the method corresponding with the second endpoint with cache key parameters', () => {
      before(() => {
        method = serverless.getMethodResourceForMethodName("ApiGatewayMethodCatPawPawidVarDelete");
      });

      it('should configure them as request parameters', () => {
        for (let parameter of secondEndpointCacheKeyParameters) {
          expect(method.Properties.RequestParameters)
            .to.deep.include({
              [`method.${parameter.name}`]: {}
            });
        }
      });

      it('should set integration request parameters', () => {
        for (let parameter of secondEndpointCacheKeyParameters) {
          expect(method.Properties.Integration.RequestParameters)
            .to.deep.include({
              [`integration.${parameter.name}`]: `method.${parameter.name}`
            });
        }
      });

      it('should set integration cache key parameters', () => {
        for (let parameter of secondEndpointCacheKeyParameters) {
          expect(method.Properties.Integration.CacheKeyParameters)
            .to.include(`method.${parameter.name}`);
        }
      });

      it('should set a cache namespace', () => {
        expect(method.Properties.Integration.CacheNamespace).to.exist;
      });
    });
  });

  let specialCharacterScenarios = [
    {
      description: 'contains the \'+\' special character',
      httpEndpointPath: '/cat/{pawId+}'
    },
    {
      description: 'contains the \'.\' special character',
      httpEndpointPath: 'cat.plaything.js'
    },
    {
      description: 'contains the \'_\' special character',
      httpEndpointPath: '/cat/{paw_id}'
    },
    {
      description: 'contains the \'-\' special character',
      httpEndpointPath: 'cat-list'
    }
  ];
  for (let { description, httpEndpointPath } of specialCharacterScenarios) {
    describe(`when an http event path ${description}`, () => {
      let cacheKeyParameters, functionWithCachingName;
      before(() => {
        functionWithCachingName = 'get-cat-by-paw-id';
        cacheKeyParameters = [{ name: 'request.path.pawId' }, { name: 'request.header.Accept-Language' }];

        let functionWithCaching = given.a_serverless_function(functionWithCachingName)
          .withHttpEndpoint('get', httpEndpointPath, { enabled: true, cacheKeyParameters });

        serverless = given.a_serverless_instance(serviceName)
          .withApiGatewayCachingConfig(true, '0.5', 45)
          .forStage(stage)
          .withFunction(functionWithCaching);

        when_configuring_path_parameters(serverless)
      });

      describe('on the corresponding method', () => {
        before(() => {
          method = serverless.getMethodResourceForFunction(functionWithCachingName);
        });

        it('should configure cache key parameters as request parameters', () => {
          for (let parameter of cacheKeyParameters) {
            expect(method.Properties.RequestParameters)
              .to.deep.include({
                [`method.${parameter.name}`]: {}
              });
          }
        });

        it('should set integration request parameters', () => {
          for (let parameter of cacheKeyParameters) {
            expect(method.Properties.Integration.RequestParameters)
              .to.deep.include({
                [`integration.${parameter.name}`]: `method.${parameter.name}`
              });
          }
        });

        it('should set integration cache key parameters', () => {
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
  }
});

const when_configuring_path_parameters = (serverless) => {
  let cacheSettings = new ApiGatewayCachingSettings(serverless);
  return pathParams.addPathParametersCacheConfig(cacheSettings, serverless);
}
