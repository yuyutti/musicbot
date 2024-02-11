const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/shuffle');

module.exports = {
    data: {
        name: 'shuffle',
        description: {
            english: 'Shuffles the songs in the queue',
            japanese: 'キューに入っている曲順をシャッフルします'
        }
    },
    alias: ['sh'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) {
            return interactionOrMessage.reply(language.notQueue[lang]);
        }

        const currentSong = serverQueue.songs[0];
        const shuffledSongs = serverQueue.songs.slice(1).sort(() => Math.random() - 0.5);
        serverQueue.songs = [currentSong, ...shuffledSongs];
        interactionOrMessage.reply(language.shuffled[lang]);
    }
};