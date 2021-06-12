const APP_ROOT = '../..';
const Serverless = require(`${APP_ROOT}/test/model/Serverless`);
const ServerlessFunction = require(`${APP_ROOT}/test/model/ServerlessFunction`);
const chance = require('chance').Chance();

const a_serverless_instance = (serviceName) => {
  return new Serverless(serviceName);
}

const a_serverless_function = name => {
  return new ServerlessFunction(name);
}

const a_rest_api_id = () => {
  return chance.guid();
}

const a_rest_api_id_for_deployment = (serverless, settings) => {
  let restApiId = a_rest_api_id();
  serverless.setRestApiId(restApiId, settings);

  return restApiId;
}

const the_rest_api_id_is_not_set_for_deployment = (serverless, settings) => {
  serverless.setRestApiId(undefined, settings);
}

const endpoints_with_caching_enabled = (endpointCount) => {
  let result = [];
  for (let i = 0; i < endpointCount; i++) {
    result.push(
      a_serverless_function(chance.word())
        .withHttpEndpoint('GET', `/${chance.word()}`, { enabled: true }));
  }
  return result;
}

const an_additional_endpoint = ({ method, path, caching }) => {
  return {
    method,
    path,
    caching
  }
}

module.exports = {
  a_serverless_instance,
  a_serverless_function,
  a_rest_api_id,
  a_rest_api_id_for_deployment,
  the_rest_api_id_is_not_set_for_deployment,
  endpoints_with_caching_enabled,
  an_additional_endpoint
}
