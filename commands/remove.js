const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/remove');

module.exports = {
    data: {
        name: 'remove',
        description: 'Removes a song in the queue by its position in the queue',
        name_localizations: {
            ja: 'remove',
        },
        description_localizations: {
            ja: 'キューに入っている曲を削除します',
        },
        options: [
            {
                name: 'remove',
                description: 'The position of the song to remove (number or "all")',
                name_localizations: {
                    ja: 'remove',
                },
                description_localizations: {
                    ja: '削除する曲の番号または "all" を指定',
                },
                type: 3,
                required: true,
            }
        ]
    },
    alias: ['rm'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);
    
        let trackNumber;
    
        // コマンドがスラッシュコマンドから実行されたかどうかをチェック
        if (interactionOrMessage.isCommand?.()) {
            const trackInput = interactionOrMessage.options.get('remove').value;
            if (typeof trackInput === 'string' && trackInput.toLowerCase() === 'all') {
                if (serverQueue.songs.length === 1) {
                    return interactionOrMessage.reply(language.onlyOne[lang]);
                }
                serverQueue.songs.splice(1);
                return interactionOrMessage.reply(language.allRemoved[lang]);
            }
            trackNumber = parseInt(trackInput, 10);
        } else {
            // プレフィックスコマンドから実行された場合
            if (!args.length) return interactionOrMessage.reply(language.invalidNumber[lang]);
            if (args[0].toLowerCase() === 'all') {
                if (serverQueue.songs.length === 1) {
                    return interactionOrMessage.reply(language.onlyOne[lang]);
                }
                serverQueue.songs.splice(1);
                return interactionOrMessage.reply(language.allRemoved[lang]);
            }
            trackNumber = parseInt(args[0], 10);
        }

        trackNumber = trackNumber - 1;
        console.log(trackNumber);
    
        if (!isNaN(trackNumber) && trackNumber > 0 && trackNumber < serverQueue.songs.length) {
            const removedSong = serverQueue.songs.splice(trackNumber, 1)[0];
            return interactionOrMessage.reply(language.removedSong[lang](removedSong.title));
        } 
        else if (trackNumber === 0) {
            return interactionOrMessage.reply(language.cannotRemoveCurrentSong[lang]);
        }
        else {
            return interactionOrMessage.reply(language.invalidNumber[lang]);
        }
    }
};