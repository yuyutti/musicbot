/*
    command: volume

    Japanese: ja
    English: en
 */

const lang = {
    invalidVolume: {
        ja: '音量は0から100の間で設定してください',
        en: 'Please set the volume between 0 and 100'
    },
    setVolume: {
        ja: (volume) => `音量を${volume}%に設定しました`,
        en: (volume) => `Set the volume to ${volume}%`
    },
}

module.exports = lang;