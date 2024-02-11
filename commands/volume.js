const { queue: musicQueue } = require('../src/musicQueue');
const { setData } = require('../SQL/data');
const language = require('../lang/commands/volume');

module.exports = {
    data: {
        name: 'volume',
        description: {
            english: 'Sets the default volume when playing a song',
            japanese: '再生時のデフォルト音量を設定します'
        }
    },
    async execute(interactionOrMessage, args, lang) {
        const volume = parseInt(args[0], 10);
        if (isNaN(volume) || volume < 0 || volume > 100) {
            return interactionOrMessage.reply(language.invalidVolume[lang]);
        }

        interactionOrMessage.reply(language.setVolume[lang](volume));
        setData(interactionOrMessage.guildId, args[0]);

        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return;

        serverQueue.commandStatus.emit('volume');
    }
};