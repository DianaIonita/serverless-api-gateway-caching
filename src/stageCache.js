const isEmpty = require('lodash.isempty');
const AWS = require('aws-sdk');

const getRestApiId = async (settings, serverless) => {
  const stackName = serverless.providers.aws.naming.getStackName(settings.stage);

  let stack = await serverless.providers.aws.request('CloudFormation', 'describeStacks', { StackName: stackName },
    settings.stage,
    settings.region
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
  let restApiId = await getRestApiId(settings, serverless);

  AWS.config.update({
    region: settings.region,
  });

  let patchOps = createPatchForStage(settings);
  for (let endpointSettings of settings.endpointSettings) {
    let endpointPatch = createPatchForEndpoint(endpointSettings, serverless);
    patchOps = patchOps.concat(endpointPatch);
  }
  const apiGateway = new AWS.APIGateway();
  let params = {
    restApiId,
    stageName: settings.stage,
    patchOperations: patchOps
  }

  serverless.cli.log(`[serverless-api-gateway-caching] Updating API Gateway cache settings.`);
  await apiGateway.updateStage(params).promise();
  serverless.cli.log(`[serverless-api-gateway-caching] Done updating API Gateway cache settings.`);
}

module.exports = updateStageCacheSettings;
