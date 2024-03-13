/*
    command: removeurl

    Japanese: ja
    English: en
 */

const lang = {
    nowSetting: {
        ja: (removeWord) => `removeWordの設定は現在${removeWord ? `有効` : `無効`}です`,
        en: (removeWord) => `The removeWord setting is currently ${removeWord ? `enabled` : `disabled`}.`
    },
    return: {
        ja: (removeWord) => `removeWordの設定が${removeWord ? `有効化` : `無効化`}されました`,
        en: (removeWord) => `The removeWord setting has been ${removeWord ? `enabled` : `disabled`}.`
    },
    invalid: {
        ja: 'removeWordの設定にはtrueかfalseを入力してください',
        en: 'Please enter a valid setting for removeWord (true or false).'
    }
}

module.exports = lang;