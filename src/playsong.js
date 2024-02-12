const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus, getVoiceConnection, VoiceConnectionStatus, joinVoiceChannel } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { queue: musicQueue } = require('./musicQueue');
const { autoplay } = require('./autoplay');
const { volume, lang } = require('../SQL/lockup');
const language = require('../lang/src/playsong');

async function playSong(guildId, song) {
    const serverQueue = musicQueue.get(guildId);
    if (!song || !serverQueue) return cleanupQueue(guildId);

    let VoiceConnectionStatusFlag = {
        Connecting: false,
        Ready: false,
        Destroyed: false,
        Disconnected: false
    }

    serverQueue.connection = joinVoiceChannel({
        channelId: serverQueue.voiceChannel.id,
        guildId,
        adapterCreator: serverQueue.voiceChannel.guild.voiceAdapterCreator,
    });
    serverQueue.connection.on("stateChange", async(oldState,newState) => {
        if (newState.status === VoiceConnectionStatus.Connecting){
            if (VoiceConnectionStatusFlag.Connecting) return;
            VoiceConnectionStatusFlag.Connecting = true
            console.log(`${serverQueue.voiceChannel.guild.name}のVCに接続しました`);
        }
        if (newState.status === VoiceConnectionStatus.Ready){
            if (VoiceConnectionStatusFlag.Ready) return;
            VoiceConnectionStatusFlag.Ready = true
            console.log("ready")
        }
        if (newState.status === VoiceConnectionStatus.Destroyed){
            if (VoiceConnectionStatusFlag.Destroyed) return;
            VoiceConnectionStatusFlag.Destroyed = true
            console.log("destroyed")
        }
        if (newState.status === VoiceConnectionStatus.Disconnected){
            if (VoiceConnectionStatusFlag.Disconnected) return;
            VoiceConnectionStatusFlag.Disconnected = true
            console.log("disconnected");
            cleanupQueue();
        }
    })

    const lan = serverQueue.language;
    serverQueue.audioPlayer.removeAllListeners();
    serverQueue.commandStatus.removeAllListeners();
    cleanupButtons(guildId)

    try {
        const info = await ytdl.getInfo(ytdl.getURLVideoID(song.url));
        let format = await ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        if (!format) format = await ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
        if (!format) format = await ytdl.chooseFormat(info.formats, { filter: 'audioandvideo' });

        const stream = ytdl.downloadFromInfo(info, {
            format: format,
            highWaterMark: 32 * 1024 * 1024,
            liveBuffer: 32 * 1024 * 1024,
            dlChunkSize: 0,
            bitrate: 128,
        });
        const resource = createAudioResource(stream, {
            inputType: "webm/opus",
            bitrate: 64,
            inlineVolume: true
        });
        resource.volume.setVolume(volumePurse(serverQueue.volume));
        serverQueue.audioPlayer.play(resource);
        serverQueue.connection.subscribe(serverQueue.audioPlayer);

        serverQueue.commandStatus.on('volume', async() => {
            const getVolume = await volume(guildId);
            resource.volume.setVolume(volumePurse(getVolume));
            serverQueue.volume = getVolume;
            serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
        });
        serverQueue.commandStatus.on('lang', async() => {
            const getLang = await lang(guildId);
            console.log(getLang)
            serverQueue.language = getLang;
            serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
        });
        serverQueue.commandStatus.on('loop', async() => {
            serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
        });
        serverQueue.commandStatus.on('autoplay', async() => {
            serverQueue.playingMessage.edit({ embeds: [nowPlayingEmbed(guildId)] });
        });

        serverQueue.audioPlayer.once('stateChange', async(oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Playing) {
                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('play_pause')
                            .setEmoji('1206429030325162044')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('loop')
                            .setEmoji('1206523452312395796')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('autoplay')
                            .setEmoji('1206429027804651551')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('shuffle')
                            .setEmoji('1206429023845224509')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('skip')
                            .setEmoji('1206429022234484796')
                            .setStyle(ButtonStyle.Success),
                    );
                const buttons2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('stop')
                            .setEmoji('1206429026374254662')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('volumeSmall')
                            .setEmoji('1206535036979912724')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('volumeDefault')
                            .setEmoji('1206535038397587556')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('volumeBig')
                            .setEmoji('1206535035398787122')
                            .setStyle(ButtonStyle.Success)
                    );
                const textChannel = serverQueue.textChannel;
                const sendPlayingMessage = await textChannel.send({ embeds: [ nowPlayingEmbed(guildId) ], components: [ buttons, buttons2 ] });
                serverQueue.playingMessage = sendPlayingMessage;
            }
        });
        serverQueue.audioPlayer.on('stateChange', async(oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Idle) {
                if (serverQueue.loop) {
                    playSong(guildId, serverQueue.songs[0]);
                }
                else if (serverQueue.autoPlay) {
                    if (serverQueue.songs.length > 1) {
                        serverQueue.songs.shift();
                        return serverQueue.songs.length > 0 ? playSong(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
                    }
                    const result = await autoplay(guildId);
                    if (!result) {
                        cleanupQueue(guildId);
                        serverQueue.textChannel.send(language.autoPlayError[lan]);
                    }
                    serverQueue.songs.shift();
                    playSong(guildId, serverQueue.songs[0]);
                }
                else {
                    serverQueue.songs.shift();
                    serverQueue.songs.length > 0 ? playSong(guildId, serverQueue.songs[0]) : cleanupQueue(guildId);
                }
            }
        });

        serverQueue.audioPlayer.on('error', (error) => {
            console.error('Audio player error:', error);
            cleanupQueue(guildId);
        });

        console.log(`Now playing: ${song.title}`);
    }
    catch (error) {
        console.error('Error playing song:', error);
        cleanupQueue(guildId);
    }
}

function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (serverQueue) {
        serverQueue.connection.destroy();
        cleanupButtons(guildId)
        musicQueue.delete(guildId);
    }
}

function cleanupButtons(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (serverQueue.playingMessage) {
        const disabledButtons = new ActionRowBuilder()
            .addComponents(
                serverQueue.playingMessage.components[0].components.map(button =>
                    ButtonBuilder.from(button).setDisabled(true)
                )
            );
        const disabledButtons2 = new ActionRowBuilder()
            .addComponents(
                serverQueue.playingMessage.components[1].components.map(button =>
                    ButtonBuilder.from(button).setDisabled(true)
                )
            );
        serverQueue.playingMessage.edit({ components: [ disabledButtons, disabledButtons2 ] }).catch(console.error);
    }
}

function nowPlayingEmbed(guildId) {
    const serverQueue = musicQueue.get(guildId);
    const currentSong = serverQueue.songs[0];
    const lan = serverQueue.language;

    const nowPlayingEmbed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(language.title[lan])
    .setDescription(`[${currentSong.title}](${currentSong.url})`)
    .addFields(
        { name: language.Fields1_name[lan], value: formatDuration(currentSong.duration)},
        { name: language.Fields2_name[lan], value: language.Fields2_Value[lan](serverQueue)},
        { name: language.Fields3_name[lan], value: language.Fields3_Value[lan](serverQueue)},
        { 
            name: language.Fields4_name[lan],
            value: `Volume: \`${serverQueue.volume}%\` | Loop: \`${serverQueue.loop ? 'ON' : 'Off'}\` | AutoPlay: \`${serverQueue.autoPlay ? 'ON' : 'Off' }\` | lang : \`${serverQueue.language}\``
        },
        { name: language.Fields5_name[lan], value: `<@${currentSong.requestBy}>` }
    )
    .setTimestamp()
    .setFooter({ text: 'DJ-Music', iconURL: 'https://cdn.discordapp.com/app-icons/1113282204064297010/9934a13736d8e8e012d6cb71a5f2107a.png?size=256' });
    return nowPlayingEmbed
}

function volumePurse(volume) {
    const maxVolume = 0.5;
    const normalizedPercentage = volume / 100;
    const value = normalizedPercentage * maxVolume;
    return value;
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