const { queue } = require('./musicQueue')

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
    return clientInstant.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`);
}

module.exports = { updateActivity, setClientInstant, startActivity, shutdownActivity }