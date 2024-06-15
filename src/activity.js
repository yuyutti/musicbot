const { queue } = require('./musicQueue')

let clientInstant = null

function setClientInstant(client) {
    clientInstant = client
}

function updateActivity() {
    const serverCount = clientInstant.guilds.cache.size;
    const voiceCount = queue.size;
    return clientInstant.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`)
}

module.exports = { updateActivity, setClientInstant }