const { AudioPlayerStatus } = require('@discordjs/voice');
const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/play_pause');

module.exports = {
    data: {
        name: 'play_pause',
        description: {
            english: 'Toggles between pausing and resuming playback',
            japanese: '一時停止・再生を切り替えます'
        },
    },
    alias: ['pause'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) {
            return interactionOrMessage.reply(language.notQueue[lang]);
        }

        if (serverQueue.audioPlayer.state.status === AudioPlayerStatus.Paused) {
            serverQueue.audioPlayer.unpause();
            interactionOrMessage.reply(language.resumed[lang]);
        }
        else {
            serverQueue.audioPlayer.pause();
            interactionOrMessage.reply(language.paused[lang]);
        }
    },
}