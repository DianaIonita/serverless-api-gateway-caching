const APP_ROOT = '../..';
const Serverless = require(`${APP_ROOT}/test/model/Serverless`);
const ServerlessFunction = require(`${APP_ROOT}/test/model/ServerlessFunction`);
const AWS = require('aws-sdk');
const AWSMock = require('aws-sdk-mock');
AWSMock.setSDKInstance(AWS);

const a_serverless_instance = (serviceName) => {
  return new Serverless(serviceName);
}

const a_serverless_function = name => {
  return new ServerlessFunction(name);
}

const api_gateway_update_stage_is_mocked = (record) => {
  AWSMock.mock('APIGateway', 'updateStage', (params, callback) => {
    if (record) {
      record(params);
    }
    callback(null, { StatusCode: 200 });
  });
}

module.exports = {
  a_serverless_instance,
  a_serverless_function,
  api_gateway_update_stage_is_mocked
}
