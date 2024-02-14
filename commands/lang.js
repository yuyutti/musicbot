const { queue: musicQueue } = require('../src/musicQueue');
const { setData } = require('../SQL/setdata');

module.exports = {
    data: {
        name: 'lang',
        description: 'Change the default language',
        name_localizations: {
            ja: 'lang',
        },
        description_localizations: {
            ja: 'デフォルト言語を変更します',
        },
        options: [
            {
                name: 'language',
                description: 'The language to change to',
                name_localizations: {
                    ja: 'language',
                },
                description_localizations: {
                    ja: '変更する言語',
                },
                type: 3,
                required: true,
                choices: [
                    {
                        name: 'English',
                        value: 'en'
                    },
                    {
                        name: 'Japanese',
                        value: 'ja'
                    }
                ]
            }
        ]
    },
    async execute(interactionOrMessage, args) {
        let lang;

        if (interactionOrMessage.isCommand?.())lang = interactionOrMessage.options.getString('language');
        else lang = args[0];
    
        if (lang === 'english' || lang === 'en') {
            await setData(interactionOrMessage.guildId, 'en');
            interactionOrMessage.reply('The default language has been changed to English.');
        }
        else if (lang === 'japanese' || lang === 'ja') {
            await setData(interactionOrMessage.guildId, 'ja');
            interactionOrMessage.reply('デフォルト言語が日本語に変更されました。');
        }
        else {
            return interactionOrMessage.reply('Please enter a valid language.');
        }
    
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return;
    
        serverQueue.commandStatus.emit('lang');
    }
};