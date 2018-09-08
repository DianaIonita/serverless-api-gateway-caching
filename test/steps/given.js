const APP_ROOT = '../..';
const Serverless = require(`${APP_ROOT}/test/model/serverless`);

const a_serverless_instance = () => {
  return new Serverless();
}

module.exports = {
  a_serverless_instance
}
