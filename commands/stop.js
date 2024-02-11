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
        musicQueue.delete(guildId);
    }
}