const { AudioPlayerStatus } = require('@discordjs/voice');
const { queue } = require('../src/musicQueue');
const language = require('../lang/commands/play_pause');

const { cleanupQueue } = require('../src/cleanUp');

// pauseTime
const pauseTime = 3600000; // 1 hour in milliseconds

module.exports = {
    data: {
        name: 'play_pause',
        description: 'Toggles between pausing and resuming playback',
        name_localizations: {
            ja: 'play_pause',
        },
        description_localizations: {
            ja: '一時停止・再生を切り替えます',
        }
    },
    alias: ['pause'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = queue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);
    
        if (serverQueue.audioPlayer.state.status === AudioPlayerStatus.Paused) {
            // 一時停止を解除
            serverQueue.audioPlayer.unpause();
            serverQueue.pause = false;

            // 一時停止タイマーをクリア
            if (serverQueue.pauseTimeout) {
                clearTimeout(serverQueue.pauseTimeout);
                serverQueue.pauseTimeout = null;
            }

            interactionOrMessage.reply(language.resumed[lang]);
        } else {
            // 再生を一時停止
            clearInterval(serverQueue.time.interval);
            serverQueue.time.interval = null;
            serverQueue.audioPlayer.pause();
            serverQueue.pause = {
                pauseStart: Date.now(),
                pauseTime: pauseTime
            };

            // 古いタイマーがあればクリア
            if (serverQueue.pauseTimeout) {
                clearTimeout(serverQueue.pauseTimeout);
                serverQueue.pauseTimeout = null;
            }

            interactionOrMessage.reply(language.paused[lang]);

            // 一時停止状態で1時間経過した場合に切断するタイマーを設定
            serverQueue.pauseTimeout = setTimeout(() => {
                cleanupQueue(interactionOrMessage.guildId);
                interactionOrMessage.channel.send(language.disconnectDueToInactivity[lang]);
            }, pauseTime); // 1時間（3600000ミリ秒）
        }
    }
}