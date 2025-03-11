const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/filter');

const { updateFilter } = require('../SQL/setdata');
const { filter: getFilter } = require('../SQL/lockup');
const Filter = require('../src/filter');

module.exports = {
    data: {
        name: 'filter',
        description: 'Switches the server settings for the filter',
        name_localizations: {
            ja: 'filter',
        },
        description_localizations: {
            ja: 'フィルターのサーバー設定を切り替えます',
        },
        options: [
            {
                name: 'filter',
                description: 'The filter to switch to',
                name_localizations: {
                    ja: 'filter',
                },
                description_localizations: {
                    ja: '切り替えるフィルターを選択してください',
                },
                type: 3,
                required: true,
                choices: [
                    {
                        name: 'Auto',
                        value: 'auto',
                        name_localizations: {
                            ja: '自動'
                        }
                    },
                    {
                        name: 'Rich',
                        value: 'rich',
                        name_localizations: {
                            ja: 'リッチ'
                        }
                    },
                    {
                        name: 'Natural',
                        value: 'natural',
                        name_localizations: {
                            ja: 'ナチュラル'
                        }
                    },
                    {
                        name: 'Balanced',
                        value: 'balanced',
                        name_localizations: {
                            ja: 'バランス'
                        }
                    },
                    {
                        name: 'Soft',
                        value: 'soft',
                        name_localizations: {
                            ja: 'ソフト'
                        }
                    },
                    {
                        name: 'Disable',
                        value: 'disable',
                        name_localizations: {
                            ja: '無効'
                        }
                    }
                ]
            }
        ]
    },
    async execute(interactionOrMessage, args, lang) {

        let filter = null;

        // スラッシュコマンドの場合
        if (interactionOrMessage.isCommand?.()) {
            const filterOption = interactionOrMessage.options.getString('filter').toLowerCase();
            if (!Filter.find(f => f.value === filterOption)) {
                return interactionOrMessage.reply(language.notFound[lang]);
            }
            filter = filterOption;
        }
        // 通常のメッセージの場合
        else if (args.length > 0) {
            const filterString = args[0].toLowerCase();
            if (!Filter.find(f => f.value === filterString)) {
                return interactionOrMessage.reply(language.notFound[lang]);
            }
            filter = filterString;
        }

        // filterがいずれかの値を持っていない場合の処理
        if (filter === null) {
            const currentFilter = await getFilter(interactionOrMessage.guildId);
            const audioFilter = Filter.find(f => f.value === currentFilter);
            
            return interactionOrMessage.reply(language.nowSetting[lang](audioFilter));
        }

        // 引数が提供された場合、設定を更新
        await updateFilter(interactionOrMessage.guildId, `${filter}`);
        const currentFilter = await getFilter(interactionOrMessage.guildId);
        const audioFilter = Filter.find(f => f.value === currentFilter);
        
        return interactionOrMessage.reply(language.return[lang](audioFilter));
    }
};