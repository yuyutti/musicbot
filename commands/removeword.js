const { queue: musicQueue } = require('../src/musicQueue');
const { setData } = require('../SQL/setdata');
const { removeWord } = require('../SQL/lockup');
const language = require('../lang/commands/removeword.js');

module.exports = {
    data: {
        name: 'removeword',
        description: 'Sets whether to remove the URL when executing the play command',
        name_localizations: {
            ja: 'removeword',
        },
        description_localizations: {
            ja: 'プレイコマンド実行時にURLを削除するかどうかを設定します',
        },
        options: [{
            type: 5,
            name: 'removeword',
            description: 'Whether to remove the URL when the play command is executed',
            name_localizations: {
                ja: 'removeword',
            },
            description_localizations: {
                ja: 'Playコマンド実行時にメッセージにURLを含む場合メッセージを削除する',
            },
        }]
    },
    async execute(interactionOrMessage, args, lang) {
        let inputRemoveURL = null; // 明示的にnullを設定
    
        // スラッシュコマンドの場合
        if (interactionOrMessage.isCommand?.()) {
            const removeUrlOption = interactionOrMessage.options.getBoolean('removeword', false); // 第2引数で必須ではないことを指定
            inputRemoveURL = removeUrlOption; // true, false, または undefined
        }
        // 通常のメッセージの場合
        else if (args.length > 0) {
            const arg = args[0].toLowerCase();
            inputRemoveURL = arg === 'true' || arg === 'false' ? arg === 'true' : null;
        }
    
        // inputRemoveURLが明示的に設定されていない場合の処理
        if (inputRemoveURL === null) {
            return interactionOrMessage.reply(language.nowSetting[lang](await removeWord(interactionOrMessage.guildId)));
        }
    
        // 引数が提供された場合、設定を更新
        await setData(interactionOrMessage.guildId, `${inputRemoveURL}`);
        interactionOrMessage.reply(language.return[lang](inputRemoveURL));
    
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return;
        
        serverQueue.removeWord = !serverQueue.removeWord;
        serverQueue.commandStatus.emit('removeWord');
    }
};