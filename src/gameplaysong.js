const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, } = require('@discordjs/voice');
const play = require('play-dl');
const { volume, lang } = require('../SQL/lockup');
const {  } = require('./gamemanager');

const { cleanupQueue, cleanupButtons } = require('./cleanUp');
const { updatePlayingGuild } = require('../src/playingGuild');
const { updateActivity } = require('../src/activity');
const { joinVC } = require('./vc');
const { getLoggerChannel, getErrorChannel } = require('./log');

const loggerChannel = getLoggerChannel();
const errorChannel = getErrorChannel();

async function playIntro(serverQueue) {
    try {
        if (!serverQueue && !serverQueue.songs[0]) return false;
        serverQueue.gameStatus = 'playing';
        guildId = serverQueue.guildId;
        joinVC(guildId);

        const voiceStatusFlags = {
            Connecting: false,
            Ready: false,
            Destroyed: false,
            Disconnected: false
        };

        serverQueue.connection.removeAllListeners();
        serverQueue.audioPlayer.removeAllListeners();
        serverQueue.commandStatus.removeAllListeners();
        cleanupButtons(guildId);

        updateActivity();
        updatePlayingGuild();

        serverQueue.connection.on('stateChange', async (oldState, newState) => {
            const guildName = serverQueue.voiceChannel.guild.name;
            switch (newState.status) {
                case VoiceConnectionStatus.Connecting:
                    if (!voiceStatusFlags.Connecting) {
                        voiceStatusFlags.Connecting = true;
                        loggerChannel.send(`**${guildName}**のVCに接続しました`);
                    }
                    break;
                case VoiceConnectionStatus.Ready:
                    voiceStatusFlags.Ready = true;
                    break;
                case VoiceConnectionStatus.Destroyed:
                    if (!voiceStatusFlags.Destroyed) {
                        voiceStatusFlags.Destroyed = true;
                        loggerChannel.send(`**${guildName}**のVCから切断しました`);
                        cleanupQueue(guildId);
                    }
                    break;
                case VoiceConnectionStatus.Disconnected:
                    if (!voiceStatusFlags.Disconnected) {
                        voiceStatusFlags.Disconnected = true;
                        cleanupQueue(guildId);
                    }
                    break;
            }
        });

        serverQueue.audioPlayer.on('error', (error) => {
            console.error('Audio player error:', error);
            errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でaudioPlayerエラーが発生しました\n\`\`\`${error}\`\`\``);
            cleanupQueue(guildId);
        });

        const [stream] = await Promise.all([
            play.stream(serverQueue.songs[0].url, { quality: 0, discordPlayerCompatibility: true })
        ]);
        const targetBufferSizeBytes = isNaN(stream.per_sec_bytes * 5) ? 75 * 1024 : stream.per_sec_bytes * 5;
        let accumulatedSizeBytes = 0;

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true
        });

        resource.volume.setVolume(volumePurse(serverQueue.volume));
        question.volume.setVolume(volumePurse(serverQueue.volume));

        await new Promise((resolve, reject) => {
            stream.stream.on('data', (chunk) => {
                accumulatedSizeBytes += chunk.length;
                if (accumulatedSizeBytes >= targetBufferSizeBytes) resolve();
            });
            stream.stream.on('error', reject);
        });

        setupCommandStatusListeners(serverQueue, guildId, resource);

        serverQueue.audioPlayer.on('stateChange', async (oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle) {
                // 三秒待つ
                await new Promise((resolve) => setTimeout(resolve, 3000));
                serverQueue.songs.shift();
                serverQueue.songs.length > 0 ? playIntro(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
            }
            else if (newState.status === AudioPlayerStatus.Playing) {
                loggerChannel.send(`イントロドン: **${serverQueue.voiceChannel.guild.name}**で**${serverQueue.songs[0].title}**の再生を開始しました`);
                serverQueue.roundCounts ++;
                const buttons = createControlButtons();
                await serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(serverQueue)], components: buttons });
            }
        });

        serverQueue.audioPlayer.play(resource);
        serverQueue.connection.subscribe(serverQueue.audioPlayer);
    }
    catch (error) {
        console.error('Error playing song:', error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でエラーが発生しました\n\`\`\`${error}\`\`\``);
        cleanupQueue(guildId);
    }
}

function setupCommandStatusListeners(serverQueue, guildId, resource) {
    serverQueue.commandStatus.on('volume', async () => {
        const getVolume = await volume(guildId);
        resource.volume.setVolume(volumePurse(getVolume));
        serverQueue.volume = getVolume;
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(serverQueue)] });
    });

    serverQueue.commandStatus.on('lang', async () => {
        const getLang = await lang(guildId);
        serverQueue.language = getLang;
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(serverQueue)] });
    });
}

function createControlButtons() {
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            // ギブアップ、ヒント、replay
            new ButtonBuilder().setCustomId('giveUp').setEmoji('🏳️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('hint').setEmoji('🔍').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('replay').setEmoji('🔁').setStyle(ButtonStyle.Primary)
        );

    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('volumeSmall').setEmoji('1206535036979912724').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('volumeDefault').setEmoji('1206535038397587556').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('volumeBig').setEmoji('1206535035398787122').setStyle(ButtonStyle.Success)
        );

    return [buttons1, buttons2];
}

function nowPlayingEmbed(serverQueue) {
    const points = serverQueue.points || {};

    const topPoints = Object.entries(points)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    const topPointsDisplay = topPoints.length > 0
        ? topPoints.map(([user, point]) => `${user}: ${point}ポイント`).join('\n')
        : 'ポイントデータがありません';

    if (serverQueue.gameStatus === 'playing') {
        // 現在のラウンド数、ポイントトップ3、回答方法のアナウンス、ギブアップやヒントの説明
        return new EmbedBuilder()
            .setTitle('イントロドンゲーム中！')
            .setDescription('現在再生中の曲を当ててください！')
            .addFields(
                { name: 'ラウンド', value: `現在のラウンド: ${serverQueue.game.roundCounts}`, inline: true },
                { name: 'トップ3', value: topPointsDisplay, inline: true },
                { name: '回答方法', value: '回答したい場合は「はい」と入力してください。', inline: false },
                { name: 'ギブアップやヒント', value: 'ギブアップする場合は「/giveup」\nヒントが欲しい場合は「/hint」と入力してください。', inline: false }
            )
            .setColor('#00FF00');
    }
    else if (serverQueue.gameStatus === 'answer') {
        // 回答、正解者、ポイントトップ3、次の曲のアナウンス
        return new EmbedBuilder()
            .setTitle('回答結果！')
            .setDescription(serverQueue.game.correctUser ? `${serverQueue.game.correctUser} さんが正解です！` : '正解者なし')
            .addFields(
                { name: 'ラウンド', value: `現在のラウンド: ${serverQueue.game.roundCounts}`, inline: true },
                { name: 'ポイントトップ3', value: topPointsDisplay, inline: true },
            )
            .setColor('#FFFF00');
    }
}

function volumePurse(volume) {
    const maxVolume = 0.5;
    const normalizedPercentage = volume / 100;
    return normalizedPercentage * maxVolume;
}

module.exports = { playIntro };