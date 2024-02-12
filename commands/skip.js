const { queue } = require('../src/musicQueue');
const { autoplay } = require('../src/autoplay');
const { playSong } = require('../src/playsong');
const language = require('../lang/commands/skip');

module.exports = {
    data: {
        name: 'skip',
        description: {
            english: 'Skips the currently playing song',
            japanese: '現在再生中の曲をスキップします',
            options: [
                {
                    name: 'skip_count',
                    description: {
                        english: 'skip count of songs',
                        japanese: 'スキップする曲の数'
                    },
                    type: 'INTEGER',
                    required: false,
                }
            ]
        }
    },
    alias: ['s'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) {
            return interactionOrMessage.reply(language.notQueue[lang]);
        }
        
        if (serverQueue.loop) {
            return interactionOrMessage.reply(language.loopEnabled[lang]);
        }
        
        let skipCount = 1; // デフォルトで1曲スキップ

        if (args && args.length > 0 && !isNaN(parseInt(args[0], 10))) {
            skipCount = parseInt(args[0], 10);
        }
        else if (interactionOrMessage.options) {
            skipCount = interactionOrMessage.options.getInteger('skip_count') || 1;
        }

        // スキップする曲数がキューの長さを超えているかのチェック
        if (skipCount >= serverQueue.songs.length) {
            return interactionOrMessage.reply(language.notEnoughSongs[lang](skipCount));
        }
        
        // 曲をスキップ
        serverQueue.songs.splice(0, skipCount);
        
        // autoPlayが有効な場合、自動再生のロジックをここに実装
        if (serverQueue.autoPlay) {
            await autoplay(interactionOrMessage.guildId);
            serverQueue.songs.shift();
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            return interactionOrMessage.reply(language.autoplayEnabled[lang]);
        }

        // 次の曲を再生
        playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        interactionOrMessage.reply(language.skipped[lang](skipCount));
    },
};
