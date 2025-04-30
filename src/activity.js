const { queue } = require('./musicQueue');
const { isOfflineMode } = require('../SQL/connection');


let clientInstant = null
process.env.IsMaintenance = false ;
function setClientInstant(client) {
    clientInstant = client

    if (process.env.IsMaintenance === 'true') {
        client.user.setPresence({ // メンテナンスモード,
            status: 'idle',
        });
    }
}

async function shutdownActivity() {
    return await clientInstant.user.setActivity(`Rebooting...`);
}

function startActivity() {
    return clientInstant.user.setActivity(`Bot is Starting!`);
}

let activityToggle = 0;

async function updateActivity() {
    const serverCount = clientInstant.guilds.cache.size;
    const userCount = clientInstant.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0);
    const voiceCount = queue.size;

    if (isOfflineMode()) return clientInstant.user.setActivity(`!help | Currently, the database is inaccessible, so all settings are in their default states | ${voiceCount}VC ${serverCount} Servers`);

    process.dashboardData.totalGuilds = serverCount;
    process.dashboardData.totalUsers = userCount;
    process.dashboardData.totalConnections = voiceCount;

    // アクティビティの切り替え
    let activityMessage;

    if(process.env.IsMaintenance === 'true') {
        activityMessage = `Bot is in Maintenance Mode | ${serverCount} Servers`;
        return clientInstant.user.setActivity(activityMessage);
    }

    if (activityToggle % 20 < 10) { // 前半5回はサーバー数
        activityMessage = `!help | ${voiceCount}VC ${serverCount} Servers`;
    } else { // 後半5回はユーザー数
        activityMessage = `!help | ${voiceCount}VC ${userCount} Users`;
    }

    activityToggle++; // カウンターを増やす

    // アクティビティを設定
    return clientInstant.user.setActivity(activityMessage);
}

module.exports = { updateActivity, setClientInstant, startActivity, shutdownActivity, clientInstant };