const { queue } = require('../src/musicQueue');
const { autoplay } = require('../src/autoplay');
const { playSong } = require('../src/playsong');
const language = require('../lang/commands/skip');

module.exports = {
    data: {
        name: 'skip',
        description: 'Skips the currently playing song',
        name_localizations: {
            ja: 'skip',
        },
        description_localizations: {
            ja: '現在再生中の曲をスキップします',
        },
        options: [
            {
                name: 'queuenumber',
                description: 'skip count of songs',
                name_localizations: {
                    ja: 'キューナンバー',
                },
                description_localizations: {
                    ja: 'スキップする曲数',
                },
                type: 4,
                required: false,
            }
        ]
    },
    alias: ['s'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);
    
        if (serverQueue.loop) return interactionOrMessage.reply(language.loopEnabled[lang]);

        if (serverQueue.autoPlay) {
            await autoplay(interactionOrMessage.guildId);
            serverQueue.songs.splice(0, 1);
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            return interactionOrMessage.reply(language.autoplayEnabled[lang]);
        }

        let skipCount = 1;
        
        if (interactionOrMessage.isCommand?.()) skipCount = interactionOrMessage.options.getInteger('queuenumber') || 1;
        else if (args && args.length > 0 && !isNaN(parseInt(args[0], 10))) skipCount = parseInt(args[0], 10);
        
        if (skipCount >= serverQueue.songs.length) {
            return interactionOrMessage.reply(language.notEnoughSongs[lang](skipCount));
        }
        
        serverQueue.songs.splice(0, skipCount);
        
        if (serverQueue.songs.length > 0) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            interactionOrMessage.reply(language.skipped[lang](skipCount));
        }
        else if (serverQueue.autoPlay) {
            await autoplay(interactionOrMessage.guildId);
            if (serverQueue.songs.length > 0) {
                playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
                interactionOrMessage.reply(language.autoplayEnabled[lang]);
            } else {
                interactionOrMessage.reply(language.queueEmpty[lang]);
            }
        }
        else interactionOrMessage.reply(language.queueEmpty[lang]);
    }
};
