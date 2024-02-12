/*
    command: remove

    Japanese: ja
    English: en
 */

const lang = {
    notQueue: {
        ja: '曲を追加してください',
        en: 'Please add a song'
    },
    onlyOne: {
        ja: '現在再生中の曲以外キューに入っていないため削除できません',
        en: 'Cannot be deleted because only the currently playing song is in the queue'
    },
    allRemoved: {
        ja: '現在再生中の曲を除き全ての曲が削除されました',
        en: 'All songs except the currently playing song have been removed'
    },
    invalidNumber: {
        ja: '無効なリクエストです',
        en: 'Invalid request'
    }
}

module.exports = lang;