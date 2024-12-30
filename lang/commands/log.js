/*
    command: log

    Japanese: ja
    English: en
*/

const language = {
    invalidChannel: {
        ja: '無効なチャンネルです',
        en: 'Invalid channel'
    },
    set: {
        ja: (channel) => `ログチャンネルを${channel}に設定しました`,
        en: (channel) => `Log channel has been set to ${channel}`
    },
    unset: {
        ja: 'ログチャンネルを解除しました',
        en: 'Log channel has been unset'
    },
    noViewPermission: {
        ja: 'チャンネルを表示する権限がありません',
        en: 'No permission to view channel'
    },
    noSendPermission: {
        ja: 'メッセージを送信する権限がありません',
        en: 'No permission to send messages'
    }
};

module.exports = language;