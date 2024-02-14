const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/autoplay');

module.exports = {
    data: {
        name: 'autoplay',
        description: 'Automatically plays the next song when the queue is empty',
        name_localizations: {
            ja: 'autoplay',
        },
        description_localizations: {
            ja: 'キューが空のときに自動的に次の曲を再生します',
        }
    },
    alias: ['ap'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);

        serverQueue.autoPlay = !serverQueue.autoPlay;
        interactionOrMessage.reply(language.autoplayStatus[lang](serverQueue.autoPlay));

        if (!serverQueue) return;
        serverQueue.commandStatus.emit('autoplay');
    }
};