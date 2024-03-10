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
                description: 'The position of the song to remove',
                name_localizations: {
                    ja: 'remove',
                },
                description_localizations: {
                    ja: '削除する曲の番号を指定',
                },
                type: 4,
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
            const trackInput = interactionOrMessage.options.get('track_number');
            if (trackInput && trackInput.value.toLowerCase() === 'all') {
                if (serverQueue.songs.length === 1) {
                    return interactionOrMessage.reply(language.onlyOne[lang]);
                }
                serverQueue.songs.splice(1);
                return interactionOrMessage.reply(language.allRemoved[lang]);
            }
            trackNumber = parseInt(trackInput.value, 10);
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

        trackNumber + 1;
    
        if (!isNaN(trackNumber) && trackNumber > 0 && trackNumber < serverQueue.songs.length) {
            const removedSong = serverQueue.songs.splice(trackNumber, 1)[0];
            return interactionOrMessage.reply(language.removedSong[lang](removedSong.title));
        } else {
            return interactionOrMessage.reply(language.invalidNumber[lang]);
        }
    }
};