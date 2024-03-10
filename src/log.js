require('dotenv').config();

let loggerChannel = null;
let errorChannel = null;
let playingGuildChannel = null;
let playingGuildMessage = null;
let editMessage = null;

const embed = {
    title: 'Bot is Online!',
    timestamp: new Date(),
};

async function fetchChannel(client) {
    if (!loggerChannel) loggerChannel = await client.channels.fetch(process.env.LOGGER_CHANNEL_ID);
    if (!errorChannel) errorChannel = await client.channels.fetch(process.env.ERROR_CHANNEL_ID);
    if (!playingGuildChannel) playingGuildChannel = await client.channels.fetch(process.env.STATUS_CHANNEL_ID);
    playingGuildMessage = await playingGuildChannel.send({ embeds: [embed] });
    editMessage = await playingGuildChannel.messages.fetch(playingGuildMessage.id);
}

function getLoggerChannel() {
    return loggerChannel;
}

function getErrorChannel() {
    return errorChannel;
}

function getPlayingGuildChannel() {
    return playingGuildMessage;
}

module.exports = { fetchChannel, getLoggerChannel, getErrorChannel, getPlayingGuildChannel };
