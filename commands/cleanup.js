const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/cleanup');

const { cleanupQueue } = require('../src/cleanUp');

const owner = process.env.OWNER_ID.split(',');

module.exports = {
    data: {
        name: 'cleanup',
        description: 'Cleans up the playlist and system',
        name_localizations: {
            ja: 'cleanup',
        },
        description_localizations: {
            ja: '再生リスト、システムをクリーンアップします',
        }
    },
    async execute(interactionOrMessage, args, lang) {
        if (!owner.includes(interactionOrMessage.author.id)) return

        const guildId = args[0]
        if (!guildId) return interactionOrMessage.reply(language.noGuildId[lang])
        
        await cleanupQueue(guildId);

        interactionOrMessage.reply(language.done[lang]);
    }
};