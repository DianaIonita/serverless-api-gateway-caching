const isEmpty = require('lodash.isempty');
const { retrieveRestApiId } = require('./restApiId');
const MAX_PATCH_OPERATIONS_PER_STAGE_UPDATE = 80;
const BASE_RETRY_DELAY_MS = 500;

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

  if (settings.apiGatewayIsShared) {
    return [];
  }

  let patch = [{
    op: 'replace',
    path: '/cacheClusterEnabled',
    value: `${settings.cachingEnabled}`
  }];

  if (settings.cachingEnabled) {
    patch.push({
      op: 'replace',
      path: '/cacheClusterSize',
      value: `${settings.cacheClusterSize}`
    });

    patch.push({
      op: 'replace',
      path: '/*/*/caching/dataEncrypted',
      value: `${settings.dataEncrypted}`
    });

    patch.push({
      op: 'replace',
      path: '/*/*/caching/ttlInSeconds',
      value: `${settings.cacheTtlInSeconds}`
    });
  }

  return patch;
}

const createPatchForMethod = (path, method, endpointSettings, stageState) => {
  let patchPath = patchPathFor(path, method);
  let patch = [{
    op: 'replace',
    path: `/${patchPath}/caching/enabled`,
    value: `${endpointSettings.cachingEnabled}`
  }];
  if (endpointSettings.cachingEnabled) {
    patch.push({
      op: 'replace',
      path: `/${patchPath}/caching/ttlInSeconds`,
      value: `${endpointSettings.cacheTtlInSeconds}`
    });
    patch.push({
      op: 'replace',
      path: `/${patchPath}/caching/dataEncrypted`,
      value: `${endpointSettings.dataEncrypted}`
    });
  }
  if (endpointSettings.perKeyInvalidation) {
    patch.push({
      op: 'replace',
      path: `/${patchPath}/caching/requireAuthorizationForCacheControl`,
      value: `${endpointSettings.perKeyInvalidation.requireAuthorization}`
    });
    if (endpointSettings.perKeyInvalidation.requireAuthorization) {
      patch.push({
        op: 'replace',
        path: `/${patchPath}/caching/unauthorizedCacheControlHeaderStrategy`,
        value: `${endpointSettings.perKeyInvalidation.handleUnauthorizedRequests}`
      });
    }
  }

  if (endpointSettings.inheritCloudWatchSettingsFromStage && stageState.methodSettings['*/*']) {
    if (stageState.methodSettings['*/*'].loggingLevel) {
      patch.push({
        op: 'replace',
        path: `/${patchPath}/logging/loglevel`,
        value: stageState.methodSettings['*/*'].loggingLevel,
      });
    }
    patch.push({
      op: 'replace',
      path: `/${patchPath}/logging/dataTrace`,
      value: stageState.methodSettings['*/*'].dataTraceEnabled ? 'true' : 'false',
    });
    patch.push({
      op: 'replace',
      path: `/${patchPath}/metrics/enabled`,
      value: stageState.methodSettings['*/*'].metricsEnabled ? 'true' : 'false',
    });
  }
  return patch;
}

const httpEventOf = (lambda, endpointSettings) => {
  let httpEvents = lambda.events.filter(e => e.http != undefined)
    .map(e => {
      if (typeof (e.http) === 'string') {
        let parts = e.http.split(' ');
        return {
          method: parts[0],
          path: parts[1]
        }
      } else {
        return {
          method: e.http.method,
          path: e.http.path
        }
      }
    });

  const event = httpEvents.filter(e =>
    (e.path === endpointSettings.path) ||
    (`/${e.path}` === endpointSettings.path) ||
    (e.path == endpointSettings.pathWithoutGlobalBasePath) ||
    (`/${e.path}` == endpointSettings.pathWithoutGlobalBasePath))
    .filter(e => e.method.toUpperCase() == endpointSettings.method.toUpperCase());
  return event;
}

const createPatchForEndpoint = (endpointSettings, serverless, stageState) => {
  let lambda = serverless.service.getFunction(endpointSettings.functionName);
  if (isEmpty(lambda.events)) {
    serverless.cli.log(`[serverless-api-gateway-caching] Lambda ${endpointSettings.functionName} has not defined events.`);
    return;
  }
  const httpEvents = httpEventOf(lambda, endpointSettings);
  if (isEmpty(httpEvents)) {
    serverless.cli.log(`[serverless-api-gateway-caching] Lambda ${endpointSettings.functionName} has not defined any HTTP events.`);
    return;
  }
  const { path, method } = endpointSettings;

  let patch = [];
  if (method.toUpperCase() == 'ANY') {
    let httpMethodsToDisableCacheFor = ['DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']; // TODO could come from settings, vNext
    for (let methodWithCacheDisabled of httpMethodsToDisableCacheFor) {
      patch = patch.concat(createPatchForMethod(path, methodWithCacheDisabled,
        { cachingEnabled: false }));
    };

    patch = patch.concat(createPatchForMethod(path, 'GET', endpointSettings, stageState));
  }
  else {
    patch = patch.concat(createPatchForMethod(path, method, endpointSettings, stageState));
  }
  return patch;
}

const patchPathFor = (path, method) => {
  let escapedPath = escapeJsonPointer(path);
  if (!escapedPath.startsWith('~1')) {
    escapedPath = `~1${escapedPath}`;
  }
  let patchPath = `${escapedPath}/${method.toUpperCase()}`;
  return patchPath;
}

const updateStageFor = async (serverless, params, stage, region) => {
  if (params.patchOperations.length == 0) {
    serverless.cli.log(`[serverless-api-gateway-caching] Will not update API Gateway cache settings because apiGatewayIsShared is set to true.`);
    return;
  }
  const chunkSize = MAX_PATCH_OPERATIONS_PER_STAGE_UPDATE;
  const { patchOperations } = params;
  const paramsInChunks = [];
  if (patchOperations.length > chunkSize) {
    for (let i = 0; i < patchOperations.length; i += chunkSize) {
      paramsInChunks.push({
        restApiId: params.restApiId,
        stageName: params.stageName,
        patchOperations: patchOperations.slice(i, i + chunkSize)
      });
    }
  }
  else {
    paramsInChunks.push(params);
  }

  for (const [index, chunk] of paramsInChunks.entries()) {
    serverless.cli.log(`[serverless-api-gateway-caching] Updating API Gateway cache settings (${index + 1} of ${paramsInChunks.length}).`);
    await applyUpdateStageForChunk(chunk, serverless, stage, region);
  }

  serverless.cli.log(`[serverless-api-gateway-caching] Done updating API Gateway cache settings.`);
}

const applyUpdateStageForChunk = async (chunk, serverless, stage, region) => {
  const maxRetries = 10;
  const baseDelay = BASE_RETRY_DELAY_MS;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      serverless.cli.log(`[serverless-api-gateway-caching] Updating API Gateway cache settings. Attempt ${attempt + 1}.`);
      await serverless.providers.aws.request('APIGateway', 'updateStage', chunk, stage, region);
      return;
    } catch (error) {
      // Check for specific error code first, fallback to message check
      if (
          (error.code === 'ConflictException' || error.message.includes('A previous change is still in progress'))
      ) {
        attempt++;
        if (attempt >= maxRetries) {
           serverless.cli.log(`[serverless-api-gateway-caching] Maximum retries (${maxRetries}) reached. Failed to update API Gateway cache settings.`);
           // Log the full error for better debugging before throwing
           console.error('[serverless-api-gateway-caching] Final error details:', error);
           throw new Error(`Failed to update API Gateway cache settings after ${maxRetries} retries: ${error.message}`);
        }
        const delay = baseDelay * 2 ** attempt;
        serverless.cli.log(`[serverless-api-gateway-caching] Retrying (${attempt}/${maxRetries}) after ${delay}ms due to error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error('[serverless-api-gateway-caching] Non-retryable error during update:', error);
        // Throw immediately for non-retryable errors or if string/code doesn't match
        throw new Error(`Failed to update API Gateway cache settings: ${error.message}`);
      }
    }
  }
}

const updateStageCacheSettings = async (settings, serverless) => {
  // do nothing if caching settings are not defined
  if (settings.cachingEnabled == undefined) {
    return;
  }

  let restApiId = await retrieveRestApiId(serverless, settings);

  let stageState = await serverless.providers.aws.request('APIGateway', 'getStage', { restApiId, stageName: settings.stage }, { region: settings.region });

  let patchOps = createPatchForStage(settings);

  let endpointsWithCachingEnabled = settings.endpointSettings.filter(e => e.cachingEnabled)
    .concat(settings.additionalEndpointSettings.filter(e => e.cachingEnabled));
  if (settings.cachingEnabled && isEmpty(endpointsWithCachingEnabled)) {
    serverless.cli.log(`[serverless-api-gateway-caching] [WARNING] API Gateway caching is enabled but none of the endpoints have caching enabled`);
  }

  for (let endpointSettings of settings.endpointSettings) {
    let endpointPatch = createPatchForEndpoint(endpointSettings, serverless, stageState);
    patchOps = patchOps.concat(endpointPatch);
  }

  // TODO handle 'ANY' method, if possible
  for (let additionalEndpointSettings of settings.additionalEndpointSettings) {
    let endpointPatch = createPatchForMethod(additionalEndpointSettings.path, additionalEndpointSettings.method, additionalEndpointSettings, stageState);
    patchOps = patchOps.concat(endpointPatch);
  }

  let params = {
    restApiId,
    stageName: settings.stage,
    patchOperations: patchOps
  }

  await updateStageFor(serverless, params, settings.stage, settings.region);
}

module.exports = {
  updateStageCacheSettings,
  applyUpdateStageForChunk
}
