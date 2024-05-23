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
        ja: 'リクエストユーザー',
        en: 'RequestBy'
    },
    autoPlayError: {
        ja: '自動再生の準備中にエラーが発生しました',
        en: 'An error occurred while preparing for auto play'
    },
    embedError: {
        ja: 'ボイスチャンネルに正常に接続できなかったか、データが破損しているため再生を続行できません',
        en: 'Either the connection to the voice channel failed or the data is corrupted, so playback cannot continue'
    },
}

module.exports = lang;