const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { queue: musicQueue } = require('../src/musicQueue');
const language = require('../lang/commands/stop');
const updatePlayingGuild = require('../src/playingGuild');
const updateActivity = require('../src/activity');

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
        cleanupQueue(interactionOrMessage.guildId);
        interactionOrMessage.reply(language.stopped[lang]);
    },
};

async function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (serverQueue) {
        serverQueue.autoPlay = false;
        if (serverQueue.audioPlayer) {
            serverQueue.audioPlayer.removeAllListeners();
        }
        if (serverQueue.connection && serverQueue.connection.state.status !== "destroyed") {
            serverQueue.connection.destroy();
        }

        if (serverQueue.playingMessage && Array.isArray(serverQueue.playingMessage.components)) {
            try {
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
                await serverQueue.playingMessage.edit({ components: [disabledButtons, disabledButtons2] });
            }
            catch (error) {
                console.error('Failed to disable buttons:', error);
            }
        }
        musicQueue.delete(guildId);
        updateActivity();
        updatePlayingGuild();
    }
}