/*
    command: loop

    Japanese: ja
    English: en
 */

const lang = {
    notQueue: {
        ja: '曲を追加してください',
        en: 'Please add a song'
    },
    loopStatus: {
        ja: (loop) => `ループ再生が${loop ? '有効' : '無効'}になりました`,
        en: (loop) => `Loop has been ${loop ? 'enabled' : 'disabled'}`
    },
}

module.exports = lang;