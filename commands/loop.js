const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/loop');

module.exports = {
    data: {
        name: 'loop',
        description: 'Enables or disables loop playback',
        name_localizations: {
            ja: 'loop',
        },
        description_localizations: {
            ja: 'ループ再生を有効または無効にします',
        }
    },
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);

        serverQueue.loop = !serverQueue.loop;
        interactionOrMessage.reply(language.loopStatus[lang](serverQueue.loop));

        if (!serverQueue) return;
        serverQueue.commandStatus.emit('loop');
    }
};