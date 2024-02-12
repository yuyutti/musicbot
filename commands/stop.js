const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { queue: musicQueue } = require('../src/musicQueue');
const language = require('../lang/commands/stop');

module.exports = {
    data: {
        name: 'stop',
        description: {
            english: 'Stops playing music and disconnects the bot from the voice channel',
            japanese: '音楽の再生を停止し、ボットをボイスチャンネルから切断します'
        }
    },
    alias: ['dc'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);
        cleanupQueue(interactionOrMessage.guildId);
        interactionOrMessage.reply(language.stopped[lang]);
    },
};

function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (serverQueue) {
        serverQueue.autoPlay = false;
        serverQueue.audioPlayer.removeAllListeners();
        serverQueue.connection.destroy();

        if (serverQueue.playingMessage) {
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    serverQueue.playingMessage.components[0].components.map(button =>
                        ButtonBuilder.from(button).setDisabled(true)
                    )
                );
            const disabledButtons2 = new ActionRowBuilder()
                .addComponents(
                    serverQueue.playingMessage.components[1].components.map(button =>
                        ButtonBuilder.from(button).setDisabled(true)
                    )
                );
            serverQueue.playingMessage.edit({ components: [ disabledButtons, disabledButtons2 ] }).catch(console.error);
        }
        musicQueue.delete(guildId);
    }
}