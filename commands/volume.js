const { queue: musicQueue } = require('../src/musicQueue');
const { updateVolume, updateLang, updateRemoveWord, updateLogChannel } = require('../SQL/setdata');
const language = require('../lang/commands/volume');

module.exports = {
    data: {
        name: 'volume',
        description: 'Sets the default volume when playing a song',
        name_localizations: {
            ja: 'volume',
        },
        description_localizations: {
            ja: '再生時のデフォルト音量を設定します',
        },
        options: [
            {
                name: 'volume',
                description: 'The volume to set',
                name_localizations: {
                    ja: 'ボリューム',
                },
                description_localizations: {
                    ja: '設定する音量',
                },
                min_value: 0,
                max_value: 100,
                type: 4,
                required: true,
            }
        ]
    },
    async execute(interactionOrMessage, args, lang) {
        let volume;
        if (interactionOrMessage.isCommand?.()) volume = interactionOrMessage.options.getInteger('volume');
        else volume = parseInt(args[0], 10);

        if (isNaN(volume) || volume < 0 || volume > 100) {
            return interactionOrMessage.reply(language.invalidVolume[lang]);
        }

        interactionOrMessage.reply(language.setVolume[lang](volume));
        await updateVolume(interactionOrMessage.guildId, volume.toString());
    
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return;

        serverQueue.commandStatus.emit('volume', volume);
    }
};