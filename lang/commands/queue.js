/*
    command: queue

    Japanese: ja
    English: en
 */

const lang = {
    notQueue: {
        ja: '現在音楽は再生されていません',
        en: 'There is no music playing at the moment'
    },
    title: {
        ja: '再生待機リスト',
        en: 'Queue List'
    },
    description: {
        ja: (totalDuration) => `総再生時間: ${totalDuration}`,
        en: (totalDuration) => `Total play time: ${totalDuration}`
    },
    nowPlaying: {
        ja: '再生中',
        en: 'Now playing'
    },
    footer: {
        ja: (currentPage, maxPages) => `ページ ${currentPage + 1}/${maxPages}`,
        en: (currentPage, maxPages) => `Page ${currentPage + 1}/${maxPages}`
    },
    prev: {
        ja: '前へ',
        en: 'Prev'
    },
    next: {
        ja: '次へ',
        en: 'Next'
    },
}

module.exports = lang;