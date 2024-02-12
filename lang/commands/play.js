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
    ViewChannelPermission: {
        ja: '音声チャンネルを閲覧する権限が必要です',
        en: 'Permission to view the voice channel is required'
    },
    ConnectPermission: {
        ja: '音声チャンネルに接続する権限が必要です',
        en: 'Permission to connect to a voice channel is required'
    },
    SpeakPermission: {
        ja: '音声チャンネルで発言する権限が必要です',
        en: 'Permission to speak in a voice channel is required'
    },
    notHit: {
        ja: '検索結果が見つかりませんでした',
        en: 'No search results found'
    },
    aNotHit: {
        ja: (trackName) => `${trackName}に一致する検索結果が見つかりませんでした`,
        en: (trackName) => `No search results found for ${trackName}`
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
    addedAlbum: {
        ja: (albumName, addedCount)=> `**${albumName}** アルバムから${addedCount}件がキューに追加されました`,
        en: (albumName, addedCount)=> `${addedCount} songs have been added to the queue from the **${albumName}** album`
    },
    addedPlaylist: {
        ja: (albumName, addedCount)=> `**${albumName}** プレイリストから${addedCount}件がキューに追加されました`,
        en: (albumName, addedCount)=> `${addedCount} songs have been added to the queue from the **${albumName}** playlist`
    }
}

module.exports = lang;