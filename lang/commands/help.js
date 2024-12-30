/*
    command: global

    Japanese: ja
    English: en
 */

const lang = {
    page1Title: {
        ja: '基本コマンド',
        en: 'Basic commands'
    },
    page1_addFields_name1: {
        ja: 'play (p)',
        en: 'play (p)'
    },
    page1_addFields_value1: {
        ja: '音楽を再生します。曲名やURLを指定してください。',
        en: 'Play music. Specify the song name or URL.'
    },
    page1_addFields_name2: {
        ja: 'queue (q)',
        en: 'queue (q)'
    },
    page1_addFields_value2: {
        ja: '現在のプレイリストを表示します。',
        en: 'Displays the current playlist.'
    },
    page1_addFields_name3: {
        ja: 'skip (s)',
        en: 'skip (s)'
    },
    page1_addFields_value3: {
        ja: '現在再生中の曲をスキップし、次の曲へ移ります。',
        en: 'Skip the currently playing song and move on to the next song.'
    },
    page1_addFields_name4: {
        ja: 'stop (dc)',
        en: 'stop (dc)'
    },
    page1_addFields_value4: {
        ja: '音楽の再生を停止し、ボットをボイスチャンネルから切断します。',
        en: 'Stops music playback and disconnects the bot from the voice channel.'
    },
    page1_addFields_name5: {
        ja: 'volume',
        en: 'volume'
    },
    page1_addFields_value5: {
        ja: '音量を調整します。0から100までの値を指定可能です。',
        en: 'Adjust the volume. You can specify a value from 0 to 100.'
    },
    page2Title: {
        ja: '拡張コマンド',
        en: 'Extended commands'
    },
    page2_addFields_name1: {
        ja: 'pause',
        en: 'pause'
    },
    page2_addFields_value1: {
        ja: '再生中の音楽を一時停止します。再度再生するにはもう一度このコマンドを実行してください。',
        en: 'Pauses the currently playing music. Use the `play` command to resume playback.'
    },
    page2_addFields_name2: {
        ja: 'loop',
        en: 'loop'
    },
    page2_addFields_value2: {
        ja: '現在再生中の曲をループ再生します。解除するにはもう一度このコマンドを実行してください。',
        en: 'Loops the currently playing song. You can cancel the loop by running this command again.'
    },
    page2_addFields_name3: {
        ja: 'shuffle (sh)',
        en: 'shuffle (sh)'
    },
    page2_addFields_value3: {
        ja: 'プレイリストの曲をランダムに並べ替えます。',
        en: 'Shuffles the songs in the playlist.'
    },
    page2_addFields_name4: {
        ja: 'remove (rm)',
        en: 'remove (rm)'
    },
    page2_addFields_value4: {
        ja: 'プレイリストから特定の曲を削除します。曲の番号を指定してください。',
        en: 'Removes a specific song from the playlist. Specify the song number.'
    },
    page2_addFields_name5: {
        ja: 'autoplay (ap)',
        en: 'autoplay (ap)'
    },
    page2_addFields_value5: {
        ja: '自動再生を切り替えます。有効にすると、プレイリストが空になった時に類似の曲を自動で追加します。解除するにはもう一度このコマンドを実行してください。',
        en: 'Toggles autoplay. When enabled, similar songs are automatically added when the playlist is empty.'
    },
    page3Title: {
        ja: '管理コマンド',
        en: 'Management commands'
    },
    page3_addFields_name1: {
        ja: 'help',
        en: 'help'
    },
    page3_addFields_value1: {
        ja: 'ヘルプメニューを表示します。使用できるコマンドとその説明がリストアップされます。',
        en: 'Displays the help menu. Lists available commands and their descriptions.'
    },
    page3_addFields_name2: {
        ja: 'lang',
        en: 'lang'
    },
    page3_addFields_value2: {
        ja: 'ボットの言語設定を変更します。サポートされている言語のリストを表示することもできます。',
        en: 'Changes the bot\'s language settings. You can also display a list of supported languages.'
    },
    page3_addFields_name3: {
        ja: 'removeWord',
        en: 'removeWord'
    },
    page3_addFields_value3: {
        ja: 'Playコマンド実行時にURLが含まれている場合、メッセージを削除します。',
        en: 'If a URL is included when the Play command is executed, the message will be deleted.'
    },
    page3_addFields_name4: {
        ja: 'logger',
        en: 'logger'
    },
    page3_addFields_value4: {
        ja: 'ログチャンネルの設定、解除を行います。誰が何時、どのコマンドを実行したかを確認できます。',
        en: 'Sets or removes the log channel. You can check who executed which command and when.'
    },
    // ボタンリンクのラベル
    inviteButton: {
        ja: 'BOTを招待する',
        en: 'Invite BOT'
    },
    supportButton: {
        ja: 'サポートサーバー',
        en: 'Support Server'
    },
    paypalButton: {
        ja: 'PayPal.Meで寄付',
        en: 'Pay what you want via PayPal.Me'
    },
    // footer
    footer1: {
        ja: 'サービスは無料で提供していますが、ご支援いただける場合は「PayPal.Meで寄付」からお好きな額をお支払いください！',
        en: 'The service is provided free of charge, but if you would like to support us, please pay any amount you like from "PayPal.Me"!'
    },
    footer2: {
        ja: (top,privacy) => `[利用規約](${top}) | [プライバシーポリシー](${privacy})`,
        en: (top,privacy) => `[Terms of Service](${top}) | [Privacy Policy](${privacy})`
    }
}

module.exports = lang;