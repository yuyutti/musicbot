const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/shuffle');

module.exports = {
    data: {
        name: 'shuffle',
        description: 'Shuffles the songs in the queue',
        name_localizations: {
            ja: 'shuffle',
        },
        description_localizations: {
            ja: 'キューに入っている曲順をシャッフルします',
        }
    },
    alias: ['sh'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);

        if (serverQueue.songs.length <= 1) return interactionOrMessage.reply(language.onlyOneSong[lang]);

        const currentSong = serverQueue.songs[0];
        const shuffledSongs = serverQueue.songs.slice(1).sort(() => Math.random() - 0.5);
        serverQueue.songs = [currentSong, ...shuffledSongs];
        interactionOrMessage.reply(language.shuffled[lang]);
    }
};