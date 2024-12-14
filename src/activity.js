const { queue } = require('./musicQueue');
const { isOfflineMode } = require('../SQL/connection');


let clientInstant = null

function getClientInstant() {
    return clientInstant
}

function setClientInstant(client) {
    clientInstant = client
}

async function shutdownActivity() {
    return await clientInstant.user.setActivity(`Rebooting...`);
}

function startActivity() {
    console.log(clientInstant)
    return clientInstant.user.setActivity(`Bot is Starting!`);
}

async function updateActivity() {
    if (clientInstant.shard && clientInstant.shard.ids[0] !== 0) {
        // 他のシャードがリクエストをシャード0に送信
        return await clientInstant.shard.broadcastEval((c, { isPrimary }) => {
            if (c.shard.ids[0] === 0) {
                return c.updateActivityFromRequest(); // シャード0で更新処理
            }
            return null;
        }, { context: { isPrimary: clientInstant.shard.ids[0] === 0 } });
    }

    // シャード0で実行
    await updateActivityFromRequest();
}

async function updateActivityFromRequest() {
    // 全シャードからデータを収集
    const results = await clientInstant.shard.broadcastEval((c) => ({
        serverCount: c.guilds.cache.size,
        voiceCount: require('./musicQueue').queue.size,
    }));

    // データを集計
    const totalServers = results.reduce((sum, shard) => sum + shard.serverCount, 0);
    const totalVCs = results.reduce((sum, shard) => sum + shard.voiceCount, 0);

    // アクティビティを設定
    await clientInstant.user.setActivity(`!help | ${totalVCs}VC ${totalServers} Servers`);
    console.log(`Updated activity: ${totalVCs}VC ${totalServers} Servers`);
}

// async function updateActivity() {
//     const serverCount = clientInstant.guilds.cache.size;
//     const voiceCount = queue.size;

//     if (isOfflineMode()) return clientInstant.user.setActivity(`!help | Currently, the database is inaccessible, so all settings are in their default states | ${voiceCount}VC ${serverCount} Servers`);

//     return clientInstant.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`);
// }

module.exports = { getClientInstant, updateActivity, setClientInstant, startActivity, shutdownActivity }