const { queue } = require('./musicQueue')

function updateActivity(client) {
    const serverCount = client.guilds.cache.size;
    const voiceCount = queue.size;
    return client.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`)
}

module.exports = updateActivity