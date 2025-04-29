const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
const { Throttle } = require('stream-throttle');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static'); 
ffmpeg.setFfmpegPath(ffmpegPath);
const { volume, lang, filter: getFilter, LogChannel } = require('../SQL/lockup');
const language = require('../lang/src/playsong');

const proxyManager = require('./proxymanager');
const { queue: musicQueue } = require('./musicQueue');
const { autoplay } = require('./autoplay');
const { cleanupQueue, cleanupButtons } = require('./cleanUp');
const { updatePlayingGuild } = require('./playingGuild');
const { updateActivity } = require('./activity');
const { joinVC } = require('./vc');
const filterList = require('./filter');

const { getLoggerChannel, getErrorChannel } = require('./log');

class processKill {
    constructor(child) {
        this.child = child;
    }
    kill() {
        this.child.kill('SIGKILL');
    }
}

let timeatack

async function playSong(guildId, song) {
    const serverQueue = musicQueue.get(guildId);
    if (!song || !serverQueue) return await cleanupQueue(guildId);

    timeatack = Date.now()

    if (serverQueue._currentlyTryingToPlay) {
        console.log(`[playSong] 多重再生防止: ${song.title}`);
        return;
    }
    serverQueue._currentlyTryingToPlay = true;

    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();

    process.dashboardData.proxy.blackList = proxyManager.getBlockedProxyList();
    process.dashboardData.proxy.currentList = proxyManager.getProxyList();

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
        await getStream(serverQueue, song);
        await sendPlayingMessage(serverQueue);
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
        serverQueue.ffmpegProcess.kill();
        serverQueue.ffmpegProcess = null;
    }

    updateActivity();
    updatePlayingGuild();

    handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId);
    handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song);

    try {
        await getStream(serverQueue, song);
        await sendPlayingMessage(serverQueue);
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

async function getStream(serverQueue, song) {
    const guildId = serverQueue.guildId;
    const proxy = proxyManager.getProxy();
    console.log(`Using proxy: ${proxy}`);
    const currentFilter = await getFilter(guildId);

    const {
        LiveItag,
        time: { current: seekPosition },
        voiceChannel: { members: { size: vcSize }, guild: { name: guildName } },
        filter,
        itag
    } = serverQueue;

    const child = fork(path.join(__dirname, 'playsong_stream.js'), [], {
        env: {
            ...process.env,
            GLOBAL_AGENT_HTTP_PROXY: proxy,
            HTTP_PROXY: proxy
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    serverQueue.ffmpegProcess = new processKill(child);

    child.send({ type: "getStream", song, LiveItag, seekPosition, vcSize, filter, filterList, currentFilter, guildName, itag, proxy });

    child.on('message', async msg => {
        if (msg.type === "log") {
            console.log(msg.message);
        }
        if (msg.type === "logger") {
            console.log(msg.message);
            getLoggerChannel().send(msg.message);
        }
        if (msg.type === "error") {
            console.log(msg.message);
            getErrorChannel().send(msg.message);
        }
        if (msg.type === "itag") {
            serverQueue.itag = msg.itag;
        }
        if (msg.type === "itagList") {
            serverQueue.itagList = msg.itagList;
        }
        if (msg.type === "handleStreamError") {
            handleStreamError(serverQueue, msg.isAgeRestricted);
        }
        if (msg.type === "replaySong") {
            rePlaySong(serverQueue.guildId, serverQueue.songs[0]);
        }
        if (msg.type === "filter") {
            serverQueue.filter = msg.filter;
        }
        if(msg.type === "unavailable") {
            let message = language.unavailable[serverQueue.language](serverQueue.songs[0].title);
            try {
                await serverQueue.playingMessage.edit(message);
            } catch (error) {
                await serverQueue.textChannel.send(message);
            }
        }
        if (msg.type === "downloading") {
            const kb = msg.size
            const kbps = Math.round((kb * 8) / 1000);
            process.dashboardData.traffic.push({
                timeStamp: Date.now(),
                guildId: serverQueue.guildId,
                kbps: kbps,
                kb: kb,
                rs: "s"
            })
        }
        if(msg.type === "singInToConfirmYouReNotABot") {
            proxyManager.blacklistProxy(proxy);
            rePlaySong(guildId, song);
        }
        if (msg.type === "ready") {
            console.log('readyを受信しました');
            console.log(`🔊 VC人数: ${vcSize} | 適用するフィルター: ${serverQueue.filter.name}`);

            process.dashboardData.proxy.blackList = proxyManager.getBlockedProxyList();
            process.dashboardData.proxy.currentList = proxyManager.getProxyList();

            serverQueue.Filter = serverQueue.filter;

            const throttleRate = 320 * 1024 / 8; // 320kbps
            serverQueue.Throttle = new Throttle({ rate: throttleRate });

            const audioStream = child.stdout.pipe(serverQueue.Throttle);
            
            serverQueue.resource = createAudioResource(audioStream, {
                inputType: StreamType.WebmOpus,  // WebmOpusが適切でない場合、他の形式に変更
                inlineVolume: true
            });
            serverQueue.resource.volume.setVolume(volumePurse(serverQueue.volume));

            const FIVE_SECOND_BYTES = 10 * 1024
            let accumulatedSizeBytes = 0;
            let resolved = false;

            await new Promise((resolve, reject) => {
                const onData = (chunk) => {
                    if (resolved) return; // 一回でもresolveしたら無視する
                    accumulatedSizeBytes += chunk.length;
                    if (accumulatedSizeBytes >= FIVE_SECOND_BYTES) {
                        resolved = true;
                        const elapsedMs = Date.now() - timeatack;
                        console.log(`再生開始までに ${(elapsedMs / 1000).toFixed(1)}秒かかりました`);
                        resolve();
                    }
                };
            
                audioStream.on('data', onData);
                
                audioStream.on('error', async (error) => {
                    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
                    console.error('FFmpeg stream error:', error);
                    getErrorChannel().send(`**${serverQueue.voiceChannel.guild.name}**でFFmpeg streamエラーが発生しました\n\`\`\`${error}\`\`\``);
                    handleStreamError(serverQueue, false);
                    reject(error);
                });        
            
                audioStream.on('close', () => {
                    resolve();
                });
            
                audioStream.on('end', () => {
                    resolve();
                });
            });

            // 再生開始処理
            setupCommandStatusListeners(serverQueue, guildId);
            serverQueue.audioPlayer.play(serverQueue.resource);
            serverQueue.connection.subscribe(serverQueue.audioPlayer);
        }
    });
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
                        content: language.playing_region_preparation[serverQueue.language], 
                        embeds: [],
                        components: []
                    });
                }
            } catch (fetchError) {
                if (serverQueue.LiveItag.includes(serverQueue.itag)) {
                    serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_LIVE_preparation[serverQueue.language]);
                }
                else {
                    serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_region_preparation[serverQueue.language]);
                }
            }
        } else {
            if (serverQueue.LiveItag.includes(serverQueue.itag)) {
                serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_LIVE_preparation[serverQueue.language]);
            }
            else {
                serverQueue.playingMessage = await serverQueue.textChannel.send(language.playing_region_preparation[serverQueue.language]);
            }
        }
    } catch (error) {
        console.error('Playing message error:', error);
    }
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