/*
    command: play

    Japanese: ja
    English: en
 */

const lang = {
    unVoiceChannel: {
        ja: '音声チャンネルに参加してから音楽を再生してください',
        en: 'Please join a voice channel before playing music'
    },
    connectPermission: {
        ja: '音声チャンネルに参加し、発言するための許可が必要です',
        en: 'You need permission to join a voice channel and speak'
    },
    notHit: {
        ja: '検索結果が見つかりませんでした',
        en: 'No search results found'
    },
    unLink: {
        ja: '無効なURLです',
        en: 'Invalid URL'
    },
    notSupportService: {
        ja: 'サポートされていないサービスです',
        en: 'Unsupported service'
    },
    addToPlaylist: {
        ja: (addedCount)=> `プレイリストから${addedCount}件の曲がキューに追加されました`,
        en: (addedCount)=> `${addedCount} songs have been added to the queue from the playlist`
    },
    addPlaying:{
        ja: (title)=> `**${title}** が再生されます`,
        en: (title)=> `**${title}** will be played`
    },
    added: {
        ja: (title)=> `**${title}** がキューに追加されました`,
        en: (title)=> `**${title}** has been added to the queue`
    },
}

module.exports = lang;