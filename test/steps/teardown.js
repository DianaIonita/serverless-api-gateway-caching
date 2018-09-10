const AWSMock = require('aws-sdk-mock');

const unmock_aws_sdk = function () {
  AWSMock.restore();
};

module.exports = {
  unmock_aws_sdk
}
