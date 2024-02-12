const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/remove');

module.exports = {
    data: {
        name: 'remove',
        description: {
            english: 'Removes a song in the queue by its position in the queue',
            japanese: 'キューに入っている曲を削除します'
        }
    },
    alias: ['rm'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);

        if (!args.length) return interactionOrMessage.reply(language.invalidNumber[lang]);

        if (args[0].toLowerCase() === 'all') {
            if (serverQueue.songs.length === 1) {
                return interactionOrMessage.reply(language.onlyOne[lang]);
            }
            serverQueue.songs.splice(1);
            return interactionOrMessage.reply(language.allRemoved[lang]);
        }
    
        const trackNumber = parseInt(args[0], 10);
        if (!isNaN(trackNumber) && trackNumber > 0 && trackNumber < serverQueue.songs.length) {

            const removedSong = serverQueue.songs.splice(trackNumber, 1)[0];
            return interactionOrMessage.reply(language.removedSong[lang](removedSong.title));
        }
        else {
            return interactionOrMessage.reply(language.invalidNumber[lang]);
        }


    }
};