const APP_ROOT = '../..';
const Serverless = require(`${APP_ROOT}/test/model/Serverless`);
const ServerlessFunction = require(`${APP_ROOT}/test/model/ServerlessFunction`);

const a_serverless_instance = () => {
  return new Serverless();
}

const a_serverless_function = name => {
  return new ServerlessFunction(name);
}

module.exports = {
  a_serverless_instance,
  a_serverless_function
}
