const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
// const play = require('play-dl');
const ytdl = require('ytdl-core'); // play-dlで障害が発生しているため、ytdl-coreに切り替えて運用
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
    serverQueue.connection.removeAllListeners();
    serverQueue.audioPlayer.removeAllListeners();
    serverQueue.commandStatus.removeAllListeners();
    cleanupButtons(guildId);

    updateActivity();
    updatePlayingGuild();

    handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId);
    handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song);

    try {
        const [,stream] = await Promise.all([
            sendPlayingMessage(serverQueue),
            // play.stream(song.url, { quality: 0, discordPlayerCompatibility: true })
            ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio' })
        ]);
        await prepareAndPlayStream(serverQueue, stream, song, guildId);
    } catch (error) {
        console.error('Error playing song:', error);
        errorChannel.send(`**${serverQueue.voiceChannel.guild.name}**でエラーが発生しました\n\`\`\`${error}\`\`\``);
        cleanupQueue(guildId);
    }
}

function handleVoiceConnectionStateChanges(serverQueue, voiceStatusFlags, loggerChannel, guildId) {
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
}

async function handleAudioPlayerStateChanges(serverQueue, loggerChannel, errorChannel, guildId, song) {
    serverQueue.audioPlayer.on('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            handleIdleState(serverQueue, guildId);
        } else if (newState.status === AudioPlayerStatus.Playing) {
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
    loggerChannel.send(`**${serverQueue.voiceChannel.guild.name}**で**${song.title}**の再生を開始しました`);
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
}

async function prepareAndPlayStream(serverQueue, stream, song, guildId) {
    //const targetBufferSizeBytes = isNaN(stream.per_sec_bytes * 5) ? 75 * 1024 : stream.per_sec_bytes * 5;
    const targetBufferSizeBytes = 75 * 1024;
    let accumulatedSizeBytes = 0;

    // const resource = createAudioResource(stream.stream, {
    //     inputType: stream.type,
    //     inlineVolume: true
    // });
    const resource = createAudioResource(stream, {
        inputType: stream.type,
        inlineVolume: true
    });
    resource.volume.setVolume(volumePurse(serverQueue.volume));

    // await new Promise((resolve, reject) => {
    //     stream.stream.on('data', (chunk) => {
    //         accumulatedSizeBytes += chunk.length;
    //         if (accumulatedSizeBytes >= targetBufferSizeBytes) resolve();
    //     });
    //     stream.stream.on('error', reject);
    // });
    await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
            accumulatedSizeBytes += chunk.length;
            if (accumulatedSizeBytes >= targetBufferSizeBytes) resolve();
        });
        stream.on('error', reject);
    });

    setupCommandStatusListeners(serverQueue, guildId, resource);
    serverQueue.audioPlayer.play(resource);
    serverQueue.connection.subscribe(serverQueue.audioPlayer);
}

function setupCommandStatusListeners(serverQueue, guildId, resource) {
    serverQueue.commandStatus.on('volume', async () => {
        const getVolume = await volume(guildId);
        resource.volume.setVolume(volumePurse(getVolume));
        serverQueue.volume = getVolume;
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
    });

    serverQueue.commandStatus.on('lang', async () => {
        const getLang = await lang(guildId);
        serverQueue.language = getLang;
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
    });

    serverQueue.commandStatus.on('loop', async () => {
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
    });

    serverQueue.commandStatus.on('autoplay', async () => {
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
    });

    serverQueue.commandStatus.on('removeWord', async () => {
        console.log("removeWord event");
        serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
    });
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