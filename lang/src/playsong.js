/*
    src: playsong

    Japanese: ja
    English: en
 */

const lang = {
    title: {
        ja: '現在再生中の曲',
        en: 'Currently playing song'
    },
    Fields1_name: {
        ja: '再生時間',
        en: 'Play time'
    },
    Fields2_name: {
        ja: '次の曲',
        en: 'Next song'
    },
    Fields2_Value: {
        ja: (serverQueue) => serverQueue.songs[1] ? `[${serverQueue.songs[1].title}](${serverQueue.songs[1].url})` : 'なし',
        en: (serverQueue) => serverQueue.songs[1] ? `[${serverQueue.songs[1].title}](${serverQueue.songs[1].url})` : 'None'
    },
    Fields3_name: {
        ja: 'キューに追加された曲',
        en: 'Songs added to the queue'
    },
    Fields3_Value: {
        ja: (serverQueue) => serverQueue.songs.length > 2 ? `${serverQueue.songs.length - 1}曲` : '0曲',
        en: (serverQueue) => serverQueue.songs.length > 2 ? `${serverQueue.songs.length - 1} songs` : '0 songs'
    },
    Fields4_name: {
        ja: 'ステータス',
        en: 'Status'
    },
    Fields5_name: {
        ja: "フィルター",
        en: "Filter"
    },
    Fields6_name: {
        ja: 'リクエストユーザー',
        en: 'RequestBy'
    },
    playing_preparation: {
        ja: '再生する準備をしています...',
        en: 'Preparing to play...'
    },
    playing_LIVE_preparation: {
        ja: '再生する準備をしています... \nライブ配信のため、再生までに時間がかかる場合があります。',
        en: 'Preparing to play... \nIt may take some time to play due to live distribution.'
    },
    playing_preparation_warning: {
        ja: '再生する準備をしています... \n :warning: プラットフォームの仕様変更によりライブラリが対応できていないため、再生までに時間がかかる場合があります。\n エラーとなった場合は時間をおいてもう一度お確かめください。',
        en: 'Preparing to play... \n :warning: Due to changes in the platform specifications, the library may not be able to support it, so it may take time to play. \n If an error occurs, please wait and check again.'
    },
    autoPlayError: {
        ja: '自動再生の準備中にエラーが発生しました',
        en: 'An error occurred while preparing for auto play'
    },
    embedError: {
        ja: 'ボイスチャンネルに正常に接続できなかったか、データが破損しているため再生を続行できません',
        en: 'Either the connection to the voice channel failed or the data is corrupted, so playback cannot continue'
    },
    warning: {
        ja: ':warning: 現在YouTube側の問題により、正常に再生できない場合があります',
        en: ':warning: Currently, due to a problem on YouTube side, you may not be able to play the video properly'
    },
    streamErrorToNext: {
        ja: (title) => `**${title}**のストリームの取得に失敗しました。\n次の曲に進みます`,
        en: (title) => `Failed to get the stream of **${title}**. Proceed to the next song`
    },
    streamErrorToEnd: {
        ja: (title) => `**${title}**のストリームの取得に失敗しました。\n再生を終了します`,
        en: (title) => `Failed to get the stream of **${title}**. End playback`
    },
    ageToNext: {
        ja: (title) => `**${title}**は、年齢制限コンテンツのため再生できません。\n次の曲に進みます`,
        en: (title) => `**${title}** is age-restricted content and cannot be played. Proceed to the`
    },
    ageToEnd: {
        ja: (title) => `**${title}**は、年齢制限コンテンツのため再生できません。\n再生を終了します`,
        en: (title) => `**${title}** is age-restricted content and cannot be played. End playback`
    },
    unavailable: {
        ja: (title) => `**${title}**は、地域制限のため再生できません。\n次の曲に進みます`,
        en: (title) => `**${title}** is not available in your region. Proceed to the next song`
    },
}

module.exports = lang;