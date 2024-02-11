const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { queue: musicQueue } = require('./musicQueue');
const { autoplay } = require('./autoplay');
const { volume, lang } = require('../SQL/lockup');
const language = require('../lang/src/playsong');

async function playSong(guildId, song) {
    const serverQueue = musicQueue.get(guildId);
    if (!song || !serverQueue) {
        cleanupQueue(guildId);
        return;
    }
    const lan = serverQueue.language;
    serverQueue.audioPlayer.removeAllListeners();
    serverQueue.commandStatus.removeAllListeners();

    try {
        const info = await ytdl.getInfo(ytdl.getURLVideoID(song.url));
        let format = await ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
        if (!format) format = await ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
        if (!format) format = await ytdl.chooseFormat(info.formats, { filter: 'audioandvideo' });

        const stream = ytdl.downloadFromInfo(info, {
            format: format,
            highWaterMark: 64 * 1024 * 1024,
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
        });
        serverQueue.commandStatus.on('lang', async() => {
            const getLang = await lang(guildId);
            serverQueue.language = getLang;
        });

        serverQueue.audioPlayer.on('stateChange', async(oldState, newState) => {
            if (newState.status === AudioPlayerStatus.Playing) {
                const currentSong = serverQueue.songs[0];
        
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
                        { name: language.Fields4_name[lan], value: `<@${currentSong.requestBy}>` }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'DJ-Music', iconURL: 'https://cdn.discordapp.com/app-icons/1113282204064297010/9934a13736d8e8e012d6cb71a5f2107a.png?size=256' });

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('play_pause')
                            .setLabel('\u23EF')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('loop')
                            .setLabel('\u{1F501}')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('shuffle')
                            .setLabel('\u{1F500}')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('skip')
                            .setLabel('\u23ED')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('stop')
                            .setLabel('\u23F9')
                            .setStyle(ButtonStyle.Danger)
                    );

                const textChannel = serverQueue.textChannel;
                textChannel.send({ embeds: [ nowPlayingEmbed ], components: [ buttons ] });
            }
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
        musicQueue.delete(guildId);
    }
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