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
    fullVoiceChannel: {
        ja: '音声チャンネルが満員です',
        en: 'The voice channel is full'
    },
    notFoundVoiceChannel: {
        ja: '年齢制限のあるコンテンツ、または暴力的、性的なコンテンツのため再生できません',
        en: 'Cannot be played due to age-restricted, violent or sexual content'
    },
    singInToConfirmYouReNotABot: {
        ja: '動画の取得に失敗しました。再試行しています...',
        en: 'Failed to retrieve the video. Retrying...'
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
    },
    notArray: {
        ja: 'データ取得時にエラーが発生しました、もう一度お試しください',
        en: 'An error occurred while retrieving data, please try again'
    },
    maintenanceMode: {
        ja: '📢 メンテナンスのお知らせ 📢\n\nプラットフォーム側の問題により、現在再生できない状態です。\nメンテナンス中は、BOTが「退席中」のステータスになります。\n\nBOTのステータスがオンラインに戻り次第、ご利用いただけます。\nしばらくの間、ご不便をおかけいたしますが、何卒よろしくお願いいたします。\n\n開始日時: 4月30日 14:00 JST\n復旧時期: 未定',
        en: '📢 Maintenance 📢\n\nDue to a problem on the platform side, playback is not possible.\nDuring maintenance, the status will be displayed as idle.\n\nYou can use it as soon as the status of the BOT is back online.\nWe apologize for any inconvenience this may cause you.\n\nStart time: 4/27\\30 14:00 JST\nRecovery time: undecided'
    }    
}

module.exports = lang;