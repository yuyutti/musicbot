const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { queue: musicQueue } = require('../src/musicQueue');
const language = require('../lang/commands/stop');
const { cleanupQueue, cleanupButtons } = require('../src/cleanUp');

module.exports = {
    data: {
        name: 'stop',
        description: 'Stops playing music and disconnects the bot from the voice channel',
        name_localizations: {
            ja: 'stop',
        },
        description_localizations: {
            ja: '音楽の再生を停止し、ボットをボイスチャンネルから切断します',
        }
    },
    alias: ['dc'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);
        cleanupQueue(interactionOrMessage.guildId) && cleanupButtons(interactionOrMessage.guildId);
        interactionOrMessage.reply(language.stopped[lang]);
    },
};