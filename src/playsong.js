const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const { Throttle } = require('stream-throttle');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static'); 
ffmpeg.setFfmpegPath(ffmpegPath);
const { volume, lang, filter: getFilter } = require('../SQL/lockup');
const language = require('../lang/src/playsong');

const { queue: musicQueue } = require('./musicQueue');
const { autoplay } = require('./autoplay');
const { cleanupQueue, cleanupButtons } = require('./cleanUp');
const { updatePlayingGuild } = require('../src/playingGuild');
const { updateActivity } = require('../src/activity');
const { joinVC } = require('./vc');
const filter = require('./filter');

const { getLoggerChannel, getErrorChannel } = require('./log');

async function playSong(guildId, song) {
    const serverQueue = musicQueue.get(guildId);
    if (!song || !serverQueue) return await cleanupQueue(guildId);

    if (serverQueue._currentlyTryingToPlay) {
        console.log(`[playSong] 多重再生防止: ${song.title}`);
        return;
    }
    serverQueue._currentlyTryingToPlay = true;

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
    serverQueue.itag = null;
    delete serverQueue.playSongRetryCount;

    if (serverQueue.ffmpegProcess) {
        serverQueue.ffmpegProcess.kill('SIGKILL');
        serverQueue.ffmpegProcess = null;
    }

    updateActivity();
    updatePlayingGuild();

    handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId);
    handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song);

    try {
        const isPlaying = await getStream(serverQueue, song);
        if (!isPlaying) {
            delete serverQueue._currentlyTryingToPlay;
            return;
        }
        await sendPlayingMessage(serverQueue);
        await prepareAndPlayStream(serverQueue, guildId);
        await pauseTimeout(serverQueue, guildId);
        delete serverQueue._currentlyTryingToPlay;
    } catch (error) {
        if (error.message.includes('Invalid input')) {
            rePlaySong(guildId, song);
            return;
        }
        console.error('playSong global error:', error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でplaySongグローバルエラーが発生しました\n\`\`\`${error}\`\`\``);
        handleStreamError(serverQueue, false);
    }
}

async function rePlaySong(guildId, song) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const serverQueue = musicQueue.get(guildId);
    if (!song || !serverQueue) return await cleanupQueue(guildId);

    if (serverQueue._currentlyTryingToPlay) {
        console.log(`[rePlaySong] 多重再生防止: ${song.title}`);
        return;
    }
    serverQueue._currentlyTryingToPlay = true;

    if (!serverQueue.playSongRetryCount) serverQueue.playSongRetryCount = 1;
    else serverQueue.playSongRetryCount++;

    if (serverQueue.playSongRetryCount > 3) {
        delete serverQueue.playSongRetryCount;
        serverQueue.songs.shift();
        serverQueue.time.current = 0;
        serverQueue.songs.length > 0 ? playSong(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
        return;
    }

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

    if (serverQueue.ffmpegProcess) {
        serverQueue.ffmpegProcess.kill('SIGKILL');
        serverQueue.ffmpegProcess = null;
    }

    updateActivity();
    updatePlayingGuild();

    handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId);
    handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song);

    try {
        const isPlaying = await getStream(serverQueue, song);
        if (!isPlaying) {
            delete serverQueue._currentlyTryingToPlay;
            return;
        }
        await sendPlayingMessage(serverQueue);
        await prepareAndPlayStream(serverQueue, guildId);
        await pauseTimeout(serverQueue, guildId);
        delete serverQueue._currentlyTryingToPlay;
        delete serverQueue.playSongRetryCount;
    } catch (error) {
        if (error.message.includes('Invalid input')) {
            rePlaySong(guildId, song);
            return;
        }
        console.error('playSong global error:', error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でrePlaySongグローバルエラーが発生しました\n\`\`\`${error}\`\`\``);
        handleStreamError(serverQueue, false);
    }
}

async function getStream(serverQueue, song, retries = 3, delayMs = 1500) {
    let attemptCount = 0;
    while (attemptCount < retries) {
        try {
            attemptCount++;
            console.log(`Playing song (Attempt ${attemptCount}): ${song.title}`);

            // const defaultItagList = [ 18, 250, 251, 140, 249 ];
            const defaultItagList = [251, 250, 249, 18, 93, 94, 92, 91, 140];
            if (!serverQueue.itagList) {
                serverQueue.itagList = [...defaultItagList];
            }
            if (serverQueue.itagList.length === 0) {
                await handleStreamError(serverQueue, false);
                return false;
            }
            
            const info = await ytdl.getInfo(song.url);
            const formats = info.formats;
            
            while (serverQueue.itagList.length > 0) {
                const itag = serverQueue.itagList[0];
                serverQueue.itag = itag;
                console.log(`itag: ${itag}`);
            
                const format = formats.find(f => f.itag === itag);
                if (!format) {
                    serverQueue.itagList.shift();
                    continue;
                }
            
                try {
                    serverQueue.stream = ytdl(song.url, {
                        quality: itag,
                        highWaterMark: 1 << 28,
                        dlChunkSize: serverQueue.LiveItag.includes(itag) ? 1024 * 1024 * 75 : undefined
                    });
                    serverQueue.itagList = [...defaultItagList];
                    return true;
                } catch (err) {
                    console.warn(`itag ${itag} の stream に失敗しました: ${err.message}`);
                    serverQueue.itagList.shift();
                    continue;
                }
            }

            serverQueue.stream = ytdl(song.url, { highWaterMark: 1 << 28, dlChunkSize: 1024 * 1024 * 75 });
            return true;
        } catch (error) {
            console.error(`Error while fetching stream for ${song.title}: ${error.message}`);
            if (error.message.includes('Sign in to confirm your age')) {
                await handleStreamError(serverQueue, true);
                return;
            }

            if (attemptCount === retries) {
                const errorChannel = getErrorChannel();
                if (errorChannel) {
                    errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でストリーム取得エラーが発生しました\n\`\`\`${error.message}\`\`\``);
                }
                await handleStreamError(serverQueue, false);
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

async function handleStreamError(serverQueue, isAgeRestricted) {
    const guildId = serverQueue.guildId;
    let message;

    if (isAgeRestricted) {
        if (serverQueue.songs.length > 1) {
            message = language.ageToNext[serverQueue.language](serverQueue.songs[0].title);
        } else {
            message = language.ageToEnd[serverQueue.language](serverQueue.songs[0].title);
        }
    } else if (serverQueue.songs.length > 1) {
        message = language.streamErrorToNext[serverQueue.language](serverQueue.songs[0].title);
    } else {
        message = language.streamErrorToEnd[serverQueue.language](serverQueue.songs[0].title);
    }

    try {
        await serverQueue.playingMessage.edit(message);
    } catch (error) {
        await serverQueue.textChannel.send(message);
    }

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
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    if (serverQueue.moveVc) return serverQueue.moveVc = false;
                    voiceStatusFlags.Destroyed = true;
                    loggerChannel.send(`playing: **${guildName}**のVCから切断しました`);
                    cleanupQueue(guildId);
                }
                break;
            case VoiceConnectionStatus.Disconnected:
                if (!voiceStatusFlags.Disconnected) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    if (serverQueue.moveVc) return serverQueue.moveVc = false;
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
            console.log(`AudioPlayerStatus.Idle: ${serverQueue.time.current} / ${serverQueue.time.end}`);
            if (serverQueue.time.current === 0) return;
            if (serverQueue.playSongRetryCount) {
                clearInterval(serverQueue.time.interval);
                clearInterval(serverQueue.trafficLogInterval);
                serverQueue.time.interval = null;
                serverQueue.time.start, serverQueue.time.end, serverQueue.time.current = 0;
                return;
            }
            if (Math.abs(serverQueue.time.current - serverQueue.time.end) <= 1) {
                handleIdleState(serverQueue, guildId);
                clearInterval(serverQueue.time.interval);
                clearInterval(serverQueue.trafficLogInterval);
                serverQueue.time.interval = null;
                serverQueue.time.start, serverQueue.time.end, serverQueue.time.current = 0;
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (serverQueue.moveVc) return;
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
            }, 1000);
            await handlePlayingState(serverQueue, loggerChannel, guildId, song);
        }
    });

    serverQueue.audioPlayer.on('error', (error) => {
        console.error('Audio player error:', error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でaudioPlayerエラーが発生しました\n\`\`\`${error}\`\`\``);
        handleStreamError(serverQueue, false);
    });
}

async function handlePlayingState(serverQueue, loggerChannel, guildId, song) {
    loggerChannel.send(`playing: ${serverQueue.itag} / **${serverQueue.voiceChannel.guild.name}**で**${song.title}**の再生を開始しました`);
    const buttons = createControlButtons();
    await serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
}

function handleIdleState(serverQueue, guildId) {
    if (serverQueue.loop) {
        playSong(guildId, serverQueue.songs[0]);
    }
    else if (serverQueue.autoPlay) {
        handleAutoPlay(serverQueue, guildId);
    }
    else {
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
    try {
        const messages = await serverQueue.textChannel.messages.fetch({ limit: 3 });
        const isPlayingMessage = messages.some(msg => msg.id === serverQueue.playingMessage?.id);
        if (isPlayingMessage) {
            try {
                if (serverQueue.LiveItag.includes(serverQueue.itag)) {
                    serverQueue.playingMessage.edit({ 
                        content: language.playing_LIVE_preparation[serverQueue.language], 
                        embeds: [],
                        components: []
                    });
                }
                else {
                    serverQueue.playingMessage.edit({ 
                        content: language.playing_preparation[serverQueue.language], 
                        embeds: [],
                        components: []
                    });
                }
            } catch (fetchError) {
                if (serverQueue.LiveItag.includes(serverQueue.itag)) {
                    serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_LIVE_preparation[serverQueue.language]);
                }
                else {
                    serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_preparation[serverQueue.language]);
                }
            }
        } else {
            if (serverQueue.LiveItag.includes(serverQueue.itag)) {
                serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_LIVE_preparation[serverQueue.language]);
            }
            else {
                serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_preparation[serverQueue.language]);
            }
        }
    } catch (error) {
        console.error('Playing message error:', error);
    }
}

async function prepareAndPlayStream(serverQueue, guildId) {
    if (serverQueue.ffmpegProcess) {
        serverQueue.ffmpegProcess.kill('SIGKILL');
        serverQueue.ffmpegProcess = null;
    }

    const seekPosition = serverQueue.time.current;
    let YT_lastLoggedBytes = 0;
    let YT_accumulatedSizeBytes = 0;
    serverQueue.stream.on("data", (chunk) => {
        const currentTime = Date.now();
        YT_accumulatedSizeBytes += chunk.length;
        const bytesSinceLastLog = YT_accumulatedSizeBytes - YT_lastLoggedBytes;
        YT_lastLoggedBytes = YT_accumulatedSizeBytes;
        
        const kbps = (bytesSinceLastLog * 8) / 1024;
        const readKB = bytesSinceLastLog / 1024;
        // console.log( `timestamp: ${currentTime}, guildId: ${guildId}, Speed: ${kbps.toFixed(2)} kbps, Data Read: ${readKB.toFixed(2)} KB`);
        process.dashboardData.traffic.push({
            timestamp: currentTime,
            guildId: guildId,
            kbps: kbps.toFixed(2),
            kb: readKB.toFixed(2),
            rs: "r"
        });
    });

    const vcSize = serverQueue.voiceChannel.members.size;
    const currentFilter = await getFilter(guildId);

    if (currentFilter === 'auto') {
        serverQueue.filter = filter
            .filter(f => f.auto)
            .sort((a, b) => a.minVCSize - b.minVCSize)
            .find(f => vcSize <= f.minVCSize);
    } else {
        serverQueue.filter = filter.find(f => f.value === currentFilter);
        if (!serverQueue.filter) {
            serverQueue.filter = filter
                .filter(f => f.auto)
                .sort((a, b) => a.minVCSize - b.minVCSize)
                .find(f => vcSize <= f.minVCSize);
        }
        else {
            serverQueue.filter.auto = false;
        }
    }

    console.log(`🔊 VC人数: ${vcSize} | 適用するフィルター: ${serverQueue.filter.name}`);

    serverQueue.Filter = serverQueue.filter;

    serverQueue.ffmpegProcess = ffmpeg(serverQueue.stream)
        .setStartTime(seekPosition)
        .noVideo()
        .audioFilters(serverQueue.filter.filter)
        .audioFrequency(48000)
        .outputOptions([
            '-reconnect_at_eof', '1',
            '-reconnect_streamed', '1',
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
            if (error.message.includes('Status code: 403')) {
                rePlaySong(serverQueue.guildId, serverQueue.songs[0]);
                return;
            }
            if (error.message.includes('ffmpeg exited with code 1')) {
                serverQueue.itagList.shift();
                rePlaySong(serverQueue.guildId, serverQueue.songs[0]);
                return;
            }
            if (error.message.includes('No such format found')) {
                serverQueue.itagList.shift();
                rePlaySong(serverQueue.guildId, serverQueue.songs[0]);
                return;
            }
            if (error.message.includes('ECONNRESET')) {
                serverQueue.itagList.shift();
                rePlaySong(serverQueue.guildId, serverQueue.songs[0]);
                return;
            }
            console.error('FFmpeg error:', error);
            getErrorChannel().send(`**${serverQueue.voiceChannel.guild.name}**でFFmpegエラーが発生しました\n\`\`\`${error}\`\`\``);
        }
    );
    
    const throttleRate = 320 * 1024 / 8; // 320kbps
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
        const kbps = (bytesSinceLastLog * 8) / 1024;
        const readKB = bytesSinceLastLog / 1024;
        
        const currentTime = Date.now();
        
        process.dashboardData.traffic.push({
            timestamp: currentTime,
            guildId: guildId,
            kbps: kbps,
            kb: readKB,
            rs: "s"
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
        
        ffmpegStream.on('error', async (error) => {
            if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            console.error('FFmpeg stream error:', error);
            getErrorChannel().send(`**${serverQueue.voiceChannel.guild.name}**でFFmpeg streamエラーが発生しました\n\`\`\`${error}\`\`\``);
            handleStreamError(serverQueue, false);
            reject(error);
        });        

        ffmpegStream.on('close', () => {
            resolve();
        });

        ffmpegStream.on('end', () => {
            resolve();
        });
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
        editEmbed(serverQueue, guildId);
    });

    serverQueue.commandStatus.on('lang', async () => {
        const getLang = await lang(guildId);
        serverQueue.language = getLang;
        editEmbed(serverQueue, guildId);
    });

    serverQueue.commandStatus.on('loop', async () => {
        editEmbed(serverQueue, guildId);
    });

    serverQueue.commandStatus.on('autoplay', async () => {
        editEmbed(serverQueue, guildId);
    });

    serverQueue.commandStatus.on('removeWord', async () => {
        editEmbed(serverQueue, guildId);
    });

    function editEmbed(serverQueue, guildId) {
        if (serverQueue.editTimeout) {
            clearTimeout(serverQueue.editTimeout);
        }

        serverQueue.editTimeout = setTimeout(() => {
            const buttons = createControlButtons();
            serverQueue.playingMessage.edit({ content: "", embeds: [nowPlayingEmbed(guildId)], components: buttons });
            
            serverQueue.editTimeout = null;
        }, 5000);
    }
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
            {
                name: language.Fields5_name[lan],
                value: `${lan === "ja" ? serverQueue.Filter.name_ja : serverQueue.Filter.name} ${serverQueue.Filter.auto ? (lan === "ja" ? " (自動)" : " (auto)") : ""}`
            },
            { name: language.Fields6_name[lan], value: `<@${currentSong.requestBy}>` }
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
    if (seconds === "0") {
        return 'LIVE';
    }
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