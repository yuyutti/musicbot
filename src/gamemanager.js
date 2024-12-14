const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { playIntro } = require('./gameplaysong');
const { getLoggerChannel, getErrorChannel } = require('./log');
const { musicQueue } = require('./musicQueue');
const { cleanupQueue, cleanupButtons } = require('./cleanUp');
const { volume, lang } = require('../SQL/lockup');

const language = require('../lang/src/gamemanager');

async function gameManager(serverQueue) {
    console.log(serverQueue.language); // ja
    serverQueue.playingMessage = await serverQueue.textChannel.send(language.preparingGame[serverQueue.language]);

    playIntro(serverQueue);
}

module.exports = { gameManager };