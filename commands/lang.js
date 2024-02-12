const { queue: musicQueue } = require('../src/musicQueue');
const { setData } = require('../SQL/setdata');

module.exports = {
    data: {
        name: 'lang',
        description: {
            english: 'Change the default language',
            japanese: 'デフォルト言語を変更します'
        },
        option: [
            {
                name: 'language',
                description: {
                    english: 'The language to change to',
                    japanese: '変更する言語'
                },
                type: 3,
                required: true,
                choices: [
                    {
                        name: 'English',
                        value: 'english'
                    },
                    {
                        name: 'Japanese',
                        value: 'japanese'
                    }
                ]
            }
        ]
    },
    async execute(interactionOrMessage, args) {
        const lang = args[0];
        if (lang === 'english' || lang === 'en') {
            setData(interactionOrMessage.guildId, 'en');
            interactionOrMessage.reply('The default language has been changed to English');
        }
        else if (lang === 'japanese' || lang === 'ja') {
            await setData(interactionOrMessage.guildId, 'ja');
            interactionOrMessage.reply('デフォルト言語が日本語に変更されました');
        }
        else {
            return interactionOrMessage.reply('Please enter a valid language');
        }

        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return;

        serverQueue.commandStatus.emit('lang');
    }
};