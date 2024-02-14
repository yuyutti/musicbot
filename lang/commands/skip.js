/*
    command: skip

    Japanese: ja
    English: en
 */

const lang = {
    notQueue: {
        ja: '曲を追加してください',
        en: 'Please add a song'
    },
    loopEnabled: {
        ja: 'ループ再生が有効なため、スキップできません',
        en: 'Cannot skip because loop is enabled'
    },
    notEnoughSongs: {
        ja: (skipCount) => `キューには${skipCount}曲以上追加されていません。`,
        en: (skipCount) => `There are not ${skipCount} or more songs in the queue.`
    },
    autoplayEnabled: {
        ja: '自動再生が有効なため、次の曲を再生します',
        en: 'Autoplay is enabled, so the next song will be played'
    },
    skipped: {
        ja: (skipCount) => `${skipCount}曲スキップしました`,
        en: (skipCount) => `Skipped ${skipCount} songs`
    }
}

module.exports = lang;