const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const { Throttle } = require('stream-throttle');
const play = require('play-dl'); // 有志の方が作成したテスト版をyuyuttiがフォークしたものを使用
const ytdl = require('@distube/ytdl-core'); // distubejs/ytdl-core#pull/163/head を使用

const ffmpeg = require('fluent-ffmpeg');
const { volume, lang } = require('../SQL/lockup');
const language = require('../lang/src/playsong');

const { queue: musicQueue } = require('./musicQueue');
const { autoplay } = require('./autoplay');
const { cleanupQueue, cleanupButtons } = require('./cleanUp');
const { updatePlayingGuild } = require('../src/playingGuild');
const { updateActivity } = require('../src/activity');
const { joinVC } = require('./vc');
const { getLoggerChannel, getErrorChannel } = require('./log');

async function playSong(guildId, song) {
    const serverQueue = musicQueue.get(guildId);
    if (!song || !serverQueue) return await cleanupQueue(guildId);

    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();

    const voiceStatusFlags = {
        Connecting: false,
        Ready: false,
        Destroyed: false,
        Disconnected: false
    };

    joinVC(guildId);
    serverQueue.streamIsAge = false;
    serverQueue.connection.removeAllListeners();
    serverQueue.audioPlayer.removeAllListeners();
    serverQueue.commandStatus.removeAllListeners();
    cleanupButtons(guildId);
    clearInterval(serverQueue.time.interval);
    clearInterval(serverQueue.trafficLogInterval);
    serverQueue.time.interval = null;
    if (serverQueue.ffmpegProcess) serverQueue.ffmpegProcess.kill('SIGKILL');

    updateActivity();
    updatePlayingGuild();

    handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId);
    handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song);

    try {
        await sendPlayingMessage(serverQueue);
        const isPlaying =  await getStream(serverQueue, song, { quality: 2, precache: 10 });
        if (!isPlaying) return
        await prepareAndPlayStream(serverQueue, guildId);
        await pauseTimeout(serverQueue, guildId);
    } catch (error) {
        console.error(error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でエラーが発生しました\n\`\`\`${error}\`\`\``);
        cleanupQueue(guildId);
    }
}

async function getStream(serverQueue, song, options, retries = 1, delayMs = 1500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Playing song (Attempt ${attempt}): ${song.title}`);

            // serverQueue.stream = await play.stream(song.url, streamOptions);
            serverQueue.stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25, });
            return true;
        } catch (error) {

            if (attempt === retries) {
                const errorChannel = getErrorChannel(serverQueue);
                if (errorChannel) {
                    errorChannel.send(
                        `**${serverQueue.voiceChannel.guild.name}**でストリーム取得エラーが発生しました\n\`\`\`${error}\`\`\``
                    );
                }
                await handleStreamError(serverQueue, false);
                throw error;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

async function handleStreamError(serverQueue, isAgeRestricted) {
    const guildId = serverQueue.guildId;
    let message

    if (isAgeRestricted) {
        if (serverQueue.songs.length > 1) {
            message = language.ageToNext[serverQueue.language](serverQueue.songs[0].title);
        }
        else message = language.ageToEnd[serverQueue.language](serverQueue.songs[0].title);
    }

    else if (serverQueue.songs.length > 1) {
        message = language.streamErrorToNext[serverQueue.language](serverQueue.songs[0].title);
    }
    else message = language.streamErrorToEnd[serverQueue.language](serverQueue.songs[0].title);
    
    await serverQueue.playingMessage.edit(message);

    // キューにhistoryを残してap時に次の曲を再生できるようにする
    serverQueue.songs.shift();
    serverQueue.songs.length > 0 ? playSong(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
    return false;
}

function handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId) {
    serverQueue.connection.on('stateChange', async (oldState, newState) => {
        const guildName = serverQueue.voiceChannel.guild.name;
        switch (newState.status) {
            case VoiceConnectionStatus.Connecting:
                if (!voiceStatusFlags.Connecting) {
                    voiceStatusFlags.Connecting = true;
                    loggerChannel.send(`playing: **${guildName}**のVCに接続しました`);
                }
                break;
            case VoiceConnectionStatus.Ready:
                voiceStatusFlags.Ready = true;
                break;
            case VoiceConnectionStatus.Destroyed:
                if (!voiceStatusFlags.Destroyed) {
                    voiceStatusFlags.Destroyed = true;
                    loggerChannel.send(`playing: **${guildName}**のVCから切断しました`);
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
}

async function handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song) {
    serverQueue.audioPlayer.on('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            if (serverQueue.IdolStop) return;
            handleIdleState(serverQueue, guildId);
            clearInterval(serverQueue.time.interval);
            clearInterval(serverQueue.trafficLogInterval);
            serverQueue.time.interval = null;
            serverQueue.time.start, serverQueue.time.end, serverQueue.time.current = 0;
        }
        else if (newState.status === AudioPlayerStatus.Playing) {
            if (serverQueue.time.interval) return;
            serverQueue.time.start = Date.now() - (serverQueue.time.current * 1000);
            serverQueue.time.end = song.duration;
            serverQueue.time.interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - serverQueue.time.start) / 1000);
                serverQueue.time.current = elapsed;
                console.log(serverQueue.time.current);
            }, 1000);
            await handlePlayingState(serverQueue, loggerChannel, guildId, song);
        }
    });

    serverQueue.audioPlayer.on('error', (error) => {
        console.error('Audio player error:', error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でaudioPlayerエラーが発生しました\n\`\`\`${error}\`\`\``);
        cleanupQueue(guildId);
    });
}

async function handlePlayingState(serverQueue, loggerChannel, guildId, song) {

    loggerChannel.send(`playing: **${serverQueue.voiceChannel.guild.name}**で**${song.title}**の再生を開始しました`);
    const buttons = createControlButtons();
    await serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
}

function handleIdleState(serverQueue, guildId) {
    if (serverQueue.loop) {
        playSong(guildId, serverQueue.songs[0]);
    } else if (serverQueue.autoPlay) {
        handleAutoPlay(serverQueue, guildId);
    } else {
        serverQueue.songs.shift();
        serverQueue.songs.length > 0 ? playSong(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
    }
}

async function handleAutoPlay(serverQueue, guildId) {
    if (serverQueue.songs.length > 1) {
        serverQueue.songs.shift();
        serverQueue.songs.length > 0 ? playSong(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
    } else {
        const result = await autoplay(guildId);
        if (!result) {
            cleanupQueue(guildId);
            serverQueue.textChannel.send(language.autoPlayError[serverQueue.language]);
        }
        serverQueue.songs.shift();
        playSong(guildId, serverQueue.songs[0]);
    }
}

async function sendPlayingMessage(serverQueue) {
    serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_preparation[serverQueue.language]);
    //serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_preparation_warning[serverQueue.language]);
}

async function prepareAndPlayStream(serverQueue, guildId) {
    if (serverQueue.ffmpegProcess) {
        serverQueue.ffmpegProcess.kill('SIGKILL');
    }

    const seekPosition = serverQueue.time.current;
    serverQueue.ffmpegProcess = ffmpeg(serverQueue.stream)
    .setStartTime(seekPosition)
    .noVideo()
    .audioFilters('loudnorm=I=-18:TP=-2:LRA=14')
    .audioFrequency(48000)
    .outputOptions([
        '-analyzeduration', '5000000',
        '-fflags', '+genpts',
        '-loglevel', 'error',
    ])
    .format('opus')
    .on('stderr', (stderr) => {
        console.log('FFmpeg stdout:', stderr);
    })
    .on('error', (error) => {
        if (error.message.includes('Sign in to confirm your age')) return handleStreamError(serverQueue, true);
        if (error.message.includes('SIGKILL')) return;
        if (error.message.includes('Output stream error: Premature close')) return;
        console.error('FFmpeg error:', error);
        getErrorChannel().send(`**${serverQueue.voiceChannel.guild.name}**でFFmpegエラーが発生しました\n\`\`\`${error}\`\`\``);
    });

    const throttleRate = 512 * 1024 / 8; // 512kbps
    serverQueue.Throttle = new Throttle({ rate: throttleRate });
    
    const ffmpegStream = serverQueue.ffmpegProcess.pipe(serverQueue.Throttle);
    
    serverQueue.resource = createAudioResource(ffmpegStream, {
        inputType: StreamType.WebmOpus,
        inlineVolume: true
    });
    serverQueue.resource.volume.setVolume(volumePurse(serverQueue.volume));

    const targetBufferSizeBytes = isNaN(serverQueue.stream.per_sec_bytes * 10) ? 75 * 1024 : serverQueue.stream.per_sec_bytes * 10;
    let accumulatedSizeBytes = 0;
    let lastLoggedBytes = 0;
    
    serverQueue.trafficLogInterval = setInterval(() => {
        const bytesSinceLastLog = accumulatedSizeBytes - lastLoggedBytes;
        lastLoggedBytes = accumulatedSizeBytes;
    
        // kbpsとKBの計算
        const kbps = (bytesSinceLastLog * 8) / 1024; // 1秒間のkbps
        const readKB = bytesSinceLastLog / 1024; // この間に読み込んだKB
    
        const currentTime = Date.now();
    
        process.dashboardData.traffic.push({
            timestamp: currentTime,
            guildId: guildId,
            kbps: kbps,
            kb: readKB,
        });
    
        // console.log(
        //     `timestamp: ${currentTime}, guildId: ${guildId}, Speed: ${kbps.toFixed(2)} kbps, Data Read: ${readKB.toFixed(2)} KB`
        // );
    }, 1000);
    
    await new Promise((resolve, reject) => {
        ffmpegStream.on('data', (chunk) => {
            accumulatedSizeBytes += chunk.length;

            if (accumulatedSizeBytes >= targetBufferSizeBytes) resolve();
        });
    
        ffmpegStream.on('error', (error) => {
            if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            console.error('FFmpeg stream error:', error);
            getErrorChannel().send(`**${serverQueue.voiceChannel.guild.name}**でFFmpeg streamエラーが発生しました\n\`\`\`${error}\`\`\``);
            reject(error);
        });
        ffmpegStream
    });

    setupCommandStatusListeners(serverQueue, guildId);
    serverQueue.audioPlayer.play(serverQueue.resource);
    serverQueue.connection.subscribe(serverQueue.audioPlayer);
}

function setupCommandStatusListeners(serverQueue, guildId) {
    serverQueue.commandStatus.on('volume', async () => {
        const getVolume = await volume(guildId);
        serverQueue.resource.volume.setVolume(volumePurse(getVolume));
        serverQueue.volume = getVolume;
        const buttons = createControlButtons();
        serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
    });

    serverQueue.commandStatus.on('lang', async () => {
        const getLang = await lang(guildId);
        serverQueue.language = getLang;
        const buttons = createControlButtons();
        serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
    });

    serverQueue.commandStatus.on('loop', async () => {
        const buttons = createControlButtons();
        serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
    });

    serverQueue.commandStatus.on('autoplay', async () => {
        const buttons = createControlButtons();
        serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
    });

    serverQueue.commandStatus.on('removeWord', async () => {
        console.log("removeWord event");
        const buttons = createControlButtons();
        serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
    });
}

async function pauseTimeout(serverQueue, guildId) {
    if (serverQueue.pause?.pauseTime && serverQueue.pause?.pauseStart) {
        const loggerChannel = getLoggerChannel();
        // 一時停止タイマーの復元

        const remainingTime = serverQueue.pause.pauseTime - (Date.now() - serverQueue.pause.pauseStart);

        if (remainingTime > 0) {
            clearInterval(serverQueue.time.interval);
            serverQueue.time.interval = null;
            serverQueue.audioPlayer.pause();
            loggerChannel.send(`playing: **${serverQueue.voiceChannel.guild.name}**で一時停止状態を復元しました 残り${remainingTime / 1000}秒`);
            serverQueue.pauseTimeout = setTimeout(() => {
                loggerChannel.send(`playing: **${serverQueue.voiceChannel.guild.name}**で一時停止状態続いたため切断しました`);
                cleanupQueue(guildId);
            }, remainingTime);
        } else {
            loggerChannel.send(`playing: **${serverQueue.voiceChannel.guild.name}**の一時停止タイマーはすでに期限切れのため切断しました`);
            cleanupQueue(guildId);
        }
    }
}

function createControlButtons() {
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('play_pause').setEmoji('1206429030325162044').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('loop').setEmoji('1206523452312395796').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('autoplay').setEmoji('1206429027804651551').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('shuffle').setEmoji('1206429023845224509').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('skip').setEmoji('1206429022234484796').setStyle(ButtonStyle.Success)
        );

    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('stop').setEmoji('1206429026374254662').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('volumeSmall').setEmoji('1206535036979912724').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('volumeDefault').setEmoji('1206535038397587556').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('volumeBig').setEmoji('1206535035398787122').setStyle(ButtonStyle.Success)
        );

    return [buttons1, buttons2];
}

function nowPlayingEmbed(guildId) {
    const serverQueue = musicQueue.get(guildId);

    if (!serverQueue || !Array.isArray(serverQueue.songs) || serverQueue.songs.length === 0) {
        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Playing Error!`)
            .setDescription(language.embedError["ja"] + `\n` + language.embedError["en"])
            .setTimestamp()
            .setFooter({ text: 'DJ-Music', iconURL: 'https://cdn.discordapp.com/app-icons/1113282204064297010/9934a13736d8e8e012d6cb71a5f2107a.png?size=256' });
    }

    const currentSong = serverQueue.songs[0];
    const lan = serverQueue.language;

    return new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(language.title[lan])
        .setDescription(`[${currentSong.title}](${currentSong.url})`)
        .addFields(
            { name: language.Fields1_name[lan], value: formatDuration(currentSong.duration) },
            { name: language.Fields2_name[lan], value: language.Fields2_Value[lan](serverQueue) },
            { name: language.Fields3_name[lan], value: language.Fields3_Value[lan](serverQueue) },
            {
                name: language.Fields4_name[lan],
                value: `Volume: \`${serverQueue.volume}%\` | Loop: \`${serverQueue.loop ? 'ON' : 'Off'}\` | AutoPlay: \`${serverQueue.autoPlay ? 'ON' : 'Off' }\` | removeWord : \`${serverQueue.removeWord ? 'ON' : 'Off' }\` | lang : \`${serverQueue.language}\``
            },
            { name: language.Fields5_name[lan], value: `<@${currentSong.requestBy}>` }
        )
        .setTimestamp()
        .setFooter({ text: 'DJ-Music', iconURL: 'https://cdn.discordapp.com/app-icons/1113282204064297010/9934a13736d8e8e012d6cb71a5f2107a.png?size=256' });
}

function volumePurse(volume) {
    const maxVolume = 0.5;
    const normalizedPercentage = volume / 100;
    return normalizedPercentage * maxVolume;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsLeft = seconds % 60;
    return [
        hours,
        hours ? String(minutes).padStart(2, '0') : minutes,
        String(secondsLeft).padStart(2, '0'),
    ].filter(Boolean).join(':');
}

module.exports = { playSong };