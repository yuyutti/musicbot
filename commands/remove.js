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
        if (!serverQueue) {
            return interactionOrMessage.reply(language.notQueue[lang]);
        }
        
        // 引数がない場合
        if (!args.length) {
            return interactionOrMessage.reply(language.invalidNumber[lang]);
        }
    
        // 'all'の場合、全ての曲を除く現在の曲を削除
        if (args[0].toLowerCase() === 'all') {
            if (serverQueue.songs.length === 1) {
                return interactionOrMessage.reply(language.onlyOne[lang]);
            }
            serverQueue.songs.splice(1); // 現在の曲以外を削除
            return interactionOrMessage.reply(language.allRemoved[lang]);
        }
    
        // 数字の場合、指定された曲を削除
        const trackNumber = parseInt(args[0], 10);
        if (!isNaN(trackNumber) && trackNumber > 0 && trackNumber < serverQueue.songs.length) {
            // 指定された曲をキューから削除
            const removedSong = serverQueue.songs.splice(trackNumber, 1)[0];
            return interactionOrMessage.reply(language.removedSong[lang](removedSong.title));
        } else {
            // 不正な引数
            return interactionOrMessage.reply(language.invalidNumber[lang]);
        }


    }
};