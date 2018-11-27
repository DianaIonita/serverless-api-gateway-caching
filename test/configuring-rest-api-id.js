const APP_ROOT = '..';
const given = require(`${APP_ROOT}/test/steps/given`);
const expect = require('chai').expect;
const { restApiExists } = require(`${APP_ROOT}/src/restApiId`);

describe('Finding the Rest API', () => {
  let result;
  describe('when the Rest API Id has already been defined in serverless configuration', () => {
    before(() => {
      let serverless = given.a_serverless_instance()
        .withPredefinedRestApiId(given.a_rest_api_id());
      result = restApiExists(serverless);
    });

    it('should return that the Rest API exists', () => {
      expect(result).to.be.true;
    });
  });

  describe('when the Rest API has not been defined in serverless configuration', () => {
    describe('and there are HTTP handler functions', () => {
      before(() => {
        let functionWithHttpEndpoint = given.a_serverless_function('get-cat-by-paw-id')
          .withHttpEndpoint('get', '/cat/{pawId}');
        serverless = given.a_serverless_instance()
          .withFunction(functionWithHttpEndpoint);

        result = restApiExists(serverless);
      });

      it('should return that the Rest API does exist', () => {
        expect(result).to.be.true;
      });
    });

    describe('and there are no HTTP handler functions', () => {
      before(() => {
        serverless = given.a_serverless_instance();

        result = restApiExists(serverless);
      });

      it('should return that the Rest API does not exist', () => {
        expect(result).to.be.false;
      });
    });
  });
});
