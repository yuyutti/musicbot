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
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);

        if (serverQueue.loop)return interactionOrMessage.reply(language.loopEnabled[lang]);
        
        let skipCount = 1;

        if (args && args.length > 0 && !isNaN(parseInt(args[0], 10))) {
            skipCount = parseInt(args[0], 10);
        }
        else if (interactionOrMessage.options) {
            skipCount = interactionOrMessage.options.getInteger('skip_count') || 1;
        }

        if (skipCount >= serverQueue.songs.length) {
            return interactionOrMessage.reply(language.notEnoughSongs[lang](skipCount));
        }
        
        serverQueue.songs.splice(0, skipCount);
        
        if (serverQueue.autoPlay) {
            await autoplay(interactionOrMessage.guildId);
            serverQueue.songs.shift();
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            return interactionOrMessage.reply(language.autoplayEnabled[lang]);
        }

        playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        interactionOrMessage.reply(language.skipped[lang](skipCount));
    },
};
