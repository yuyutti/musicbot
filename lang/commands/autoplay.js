/*
    command: autoplay

    Japanese: ja
    English: en
 */

const lang = {
    notQueue: {
        ja: '曲を追加してください',
        en: 'Please add a song'
    },
    autoplayStatus: {
        ja: (autoPlay) => `自動再生が${autoPlay ? '有効' : '無効'}になりました`,
        en: (autoPlay) => `Autoplay has been ${autoPlay ? 'enabled' : 'disabled'}`
    },
}

module.exports = lang;