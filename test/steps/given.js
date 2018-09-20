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

const a_rest_api_id_for_deployment = async (serverless, settings) => {
  let restApiId = chance.guid();
  serverless.setRestApiId(restApiId, settings);

  return restApiId;
}

module.exports = {
  a_serverless_instance,
  a_serverless_function,
  api_gateway_update_stage_is_mocked,
  a_rest_api_id_for_deployment
}
