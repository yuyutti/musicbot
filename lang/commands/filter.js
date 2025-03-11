/*
    command: filter

    Japanese: ja
    English: en
*/

const language = {
    nowSetting: {
        ja: (filter) => `現在のフィルター設定: ${filter.name_ja}`,
        en: (filter) => `Current filter setting: ${filter.name}`
    },
    return: {
        ja: (filter) => `フィルター設定を${filter.name_ja}に変更しました`,
        en: (filter) => `Changed the filter setting to ${filter.name}`
    },
    notFound: {
        ja: '指定されたフィルターが見つかりませんでした',
        en: 'The specified filter was not found'
    }
}

module.exports = language;