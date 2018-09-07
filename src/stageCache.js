const isEmpty = require('lodash.isempty');
const AWS = require('aws-sdk');

const getRestApiId = async serverless => {
  const stackName = serverless.providers.aws.naming.getStackName(serverless.service.provider.stage);

  let stack = await serverless.providers.aws.request('CloudFormation', 'describeStacks', { StackName: stackName },
    serverless.service.provider.stage,
    serverless.service.provider.region
  );

  return stack.Stacks[0].Outputs
    .filter(output => output.OutputKey === 'RestApiIdForApiGwCaching')
    .map(output => output.OutputValue)[0];
}

String.prototype.replaceAll = function (search, replacement) {
  let target = this;

  return target
    .split(search)
    .join(replacement);
};

const escapeJsonPointer = path => {
  return path
    .replaceAll('~', '~0')
    .replaceAll('/', '~1')
    .replaceAll('{', '\{')
    .replaceAll('}', '\}');
}

const createPatchForStage = (settings) => {
  return [
    {
      op: 'replace',
      path: '/cacheClusterEnabled',
      value: `${settings.cachingEnabled}`
    },
    {
      op: 'replace',
      path: '/cacheClusterSize',
      value: `${settings.cacheClusterSize}`
    }
  ]
}

const createPatchForEndpoint = (endpointSettings, serverless) => {
  const patchPath = patchPathFor(endpointSettings, serverless);
  if (!patchPath) return [];
  let patch = [{
    op: 'replace',
    path: `/${patchPath}/caching/enabled`,
    value: `${endpointSettings.cachingEnabled}`
  }]
  if (endpointSettings.cachingEnabled) {
    patch.push({
      op: 'replace',
      path: `/${patchPath}/caching/ttlInSeconds`,
      value: `${endpointSettings.cacheTtlInSeconds}`
    })
  }
  return patch;
}

const patchPathFor = (endpointSettings, serverless) => {
  let lambda = serverless.service.getFunction(endpointSettings.functionName);
  if (isEmpty(lambda.events)) {
    serverless.cli.log(`[serverless-api-gateway-caching] Lambda ${endpointSettings.functionName} has not defined events.`);
  }
  // TODO there can be many http events
  let httpEvents = lambda.events.filter(e => e.http != null);
  if (isEmpty(httpEvents)) {
    serverless.cli.log(`[serverless-api-gateway-caching] Lambda ${endpointSettings.functionName} has not defined any HTTP events.`);
  }
  let { path, method } = httpEvents[0].http;
  let escapedPath = escapeJsonPointer(path);
  let patchPath = `~1${escapedPath}/${method.toUpperCase()}`;
  return patchPath;
}

const updateStageCacheSettings = async (settings, serverless) => {
  let restApiId = await getRestApiId(serverless);

  AWS.config.update({
    region: serverless.service.custom.region,
  });

  let patchOps = createPatchForStage(settings);
  for (let endpointSettings of settings.endpointSettings) {
    let endpointPatch = createPatchForEndpoint(endpointSettings, serverless);
    patchOps = patchOps.concat(endpointPatch);
  }
  const apiGateway = new AWS.APIGateway();
  let params = {
    restApiId,
    stageName: serverless.service.custom.stage,
    patchOperations: patchOps
  }
  await apiGateway.updateStage(params).promise();
}

module.exports = updateStageCacheSettings;
