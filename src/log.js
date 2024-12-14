require('dotenv').config();

let sharedChannels = {
    loggerChannel: null,
    errorChannel: null,
    statusChannel: null,
    statusMessage: null,
};

const embed = {
    title: 'Bot is Online!',
    timestamp: new Date(),
};

async function fetchChannel(client) {
    const currentShardId = parseInt(process.env.SHARDS, 10);

    // シャード0がチャンネル情報を取得
    if (currentShardId === 0) {
        if (!sharedChannels.loggerChannel) sharedChannels.loggerChannel = await client.channels.fetch(process.env.LOGGER_CHANNEL_ID);
        if (!sharedChannels.errorChannel) sharedChannels.errorChannel = await client.channels.fetch(process.env.ERROR_CHANNEL_ID);
        if (!sharedChannels.statusChannel) sharedChannels.statusChannel = await client.channels.fetch(process.env.STATUS_CHANNEL_ID);

        sharedChannels.statusMessage = await sharedChannels.statusChannel.send({ embeds: [embed] });

        // シャード0が取得した情報を他のシャードに共有
        await client.shard.broadcastEval((c, context) => {
            const { loggerChannel, errorChannel, statusChannel, statusMessage } = context;
            global.sharedChannels = { loggerChannel, errorChannel, statusChannel, statusMessage }; // グローバル変数に保存
        }, { context: sharedChannels });
    } else {
        // 他のシャードはシャード0からの情報を取得
        await client.shard.broadcastEval(async (c) => {
            if (parseInt(process.env.SHARDS, 10) === 0) {
                return global.sharedChannels;
            }
        }).then(data => {
            if (data) sharedChannels = data;
        });
    }
}

// チャンネル情報を取得する関数
function getLoggerChannel() {
    return sharedChannels.loggerChannel;
}

function getErrorChannel() {
    return sharedChannels.errorChannel;
}

function getStatusChannel() {
    return sharedChannels.statusChannel;
}

function getStatusMessage() {
    return sharedChannels.statusMessage;
}

module.exports = { fetchChannel, getLoggerChannel, getErrorChannel, getStatusChannel, getStatusMessage };
