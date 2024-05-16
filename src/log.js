require('dotenv').config();

let loggerChannel = null;
let errorChannel = null;
let statusChannel = null;
let statusMessage = null;

const embed = {
    title: 'Bot is Online!',
    timestamp: new Date(),
};

async function fetchChannel(client) {
    if (!loggerChannel) loggerChannel = await client.channels.fetch(process.env.LOGGER_CHANNEL_ID);
    if (!errorChannel) errorChannel = await client.channels.fetch(process.env.ERROR_CHANNEL_ID);
    if (!statusChannel) statusChannel = await client.channels.fetch(process.env.STATUS_CHANNEL_ID);
    statusMessage = await statusChannel.send({ embeds: [embed] });
}

function getLoggerChannel() {
    return loggerChannel;
}

function getErrorChannel() {
    return errorChannel;
}

function getStatusChannel() {
    return statusChannel;
}

function getStatusMessage() {
    return statusMessage;
}

module.exports = { fetchChannel, getLoggerChannel, getErrorChannel, getStatusChannel, getStatusMessage };
