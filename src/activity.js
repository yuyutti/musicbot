const { queue } = require('./musicQueue');
const { isOfflineMode } = require('../SQL/connection');


let clientInstant = null

function setClientInstant(client) {
    clientInstant = client
}

async function shutdownActivity() {
    return await clientInstant.user.setActivity(`Rebooting...`);
}

function startActivity() {
    return clientInstant.user.setActivity(`Bot is Starting!`);
}

async function updateActivity() {
    const serverCount = clientInstant.guilds.cache.size;
    const voiceCount = queue.size;

    if (isOfflineMode()) return clientInstant.user.setActivity(`!help | Currently, the database is inaccessible, so all settings are in their default states | ${voiceCount}VC ${serverCount} Servers`);

    return clientInstant.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`);
}

module.exports = { updateActivity, setClientInstant, startActivity, shutdownActivity }