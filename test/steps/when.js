const updateStageCacheSettings = require('../../src/stageCache');

const updating_stage_cache_settings = async (settings, serverless) => {
    return await updateStageCacheSettings(settings, serverless);
}

module.exports = {
    updating_stage_cache_settings
}
