const { PermissionsBitField } = require('discord.js');
const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const playdl = require('play-dl');
const { queue: musicQueue } = require('../src/musicQueue');
const { playSong } = require('../src/playsong');
const { volume, lang, removeWord } = require('../SQL/lockup');
const language = require('../lang/commands/play');
const { commandStatus } = require('../events/event');
const { getLoggerChannel } = require('../src/log');

const singleLists = ['yt_video', 'search', 'sp_track'];
const multiLists = ['yt_playlist', 'sp_album', 'sp_playlist'];
const spotifyLists = ['sp_track', 'sp_album', 'sp_playlist'];

module.exports = {
    data: {
        name: 'play',
        description: 'Plays a song or playlist',
        name_localizations: { ja: 'play' },
        description_localizations: { ja: '曲またはプレイリストを再生します' },
        options: [
            {
                name: 'song',
                description: 'The song URL, playlist URL, or search keywords',
                name_localizations: { ja: '曲' },
                description_localizations: { ja: '曲のURL、プレイリストのURL、または検索キーワード' },
                type: 3,
                required: true
            }
        ]
    },
    alias: ['p'],
    async execute(interactionOrMessage, args, lang) {
        try {
            const { songString, voiceChannel, userId } = parseInteractionOrMessage(interactionOrMessage, args);
            if (!voiceChannel) return interactionOrMessage.reply({ content: language.unVoiceChannel[lang], ephemeral: true });

            const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
            if (!checkPermissions(permissions, interactionOrMessage, lang)) return;

            const stringType = await playdl.validate(songString);
            if (spotifyLists.includes(stringType) && playdl.is_expired()) await playdl.refreshToken();

            const { addedCount, songs, name } = await handleSongType(stringType, songString, userId, lang, interactionOrMessage);
            if (addedCount === 0) return;

            const serverQueue = musicQueue.get(interactionOrMessage.guildId) || await CreateServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel, songs);
            serverQueue.songs.push(...songs);
            await handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, name);
            await handleRemoveWord(interactionOrMessage, serverQueue, lang);
        } catch (error) {
            console.error('Error executing play command:', error);
        }
    }
};

function parseInteractionOrMessage(interactionOrMessage, args) {
    if (interactionOrMessage.isCommand?.()) {
        return {
            songString: interactionOrMessage.options.getString('song'),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.user.id
        };
    }
    else {
        return {
            songString: args.join(' '),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.author.id
        };
    }
}

function checkPermissions(permissions, interactionOrMessage, lang) {
    if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) {
        interactionOrMessage.reply({ content: language.ViewChannelPermission[lang], ephemeral: true });
        return false;
    }
    if (!permissions.has(PermissionsBitField.Flags.Connect)) {
        interactionOrMessage.reply({ content: language.ConnectPermission[lang], ephemeral: true });
        return false;
    }
    if (!permissions.has(PermissionsBitField.Flags.Speak)) {
        interactionOrMessage.reply({ content: language.SpeakPermission[lang], ephemeral: true });
        return false;
    }
    if (interactionOrMessage.member.voice.channel.full) {
        interactionOrMessage.reply({ content: language.fullVoiceChannel[lang], ephemeral: true });
        return false;
    }
    return true;
}

async function handleSongType(stringType, songString, userId, lang, interactionOrMessage) {
    let songs = [];
    let name = "";
    switch (stringType) {
        case "yt_video":
            songs = await addYouTubeVideo(songString, userId, interactionOrMessage, lang);
            break;
        case "yt_playlist":
            songs = await addYouTubePlaylist(songString, userId);
            break;
        case "search":
            songs = await addSearchResult(songString, userId, interactionOrMessage, lang);
            break;
        case "sp_track":
            songs = await addSpotifyTrack(songString, userId, interactionOrMessage, lang);
            break;
        case "sp_album":
        case "sp_playlist":
            ({ songs, name } = await addSpotifyTrackListToQueue(songString, userId, interactionOrMessage, lang));
            break;
        case false:
            await interactionOrMessage.reply({ content: language.unLink[lang], ephemeral: true });
            break;
        default:
            await interactionOrMessage.reply({ content: language.notSupportService[lang], ephemeral: true });
            break;
    }
    return { addedCount: songs.length, songs, name};
}

async function addYouTubeVideo(songString, userId, interactionOrMessage, lang) {
    try {
        const videoInfo = await playdl.video_basic_info(songString);
        return [{
            title: videoInfo.video_details.title,
            url: songString,
            duration: videoInfo.video_details.durationInSec,
            requestBy: userId
        }];
    } catch {
        await interactionOrMessage.reply({ content: language.notFoundVoiceChannel[lang], ephemeral: true });
        return 0;
    }
}

async function addYouTubePlaylist(songString, userId) {
    const playlistInfo = await playdl.playlist_info(songString, { incomplete: true });
    return playlistInfo.videos.map(video => ({
        title: video.title,
        url: video.url,
        duration: video.durationInSec,
        requestBy: userId
    }));
}

async function addSearchResult(songString, userId, interactionOrMessage, lang) {
    const searchResult = await playdl.search(songString, { source: { youtube: "video" }, limit: 1 });
    if (searchResult.length > 0) {
        const video = searchResult[0];
        return [{
            title: video.title,
            url: video.url,
            duration: video.durationInSec,
            requestBy: userId
        }];
    }
    else {
        await interactionOrMessage.reply({ content: language.notHit[lang], ephemeral: true });
        return 0;
    }
}

async function addSpotifyTrack(songString, userId, interactionOrMessage, lang) {
    const sp_track = await playdl.spotify(songString);
    const trackName = sp_track.name;
    const sp_trackSearchResult = await playdl.search(trackName, { source: { youtube: "video" }, limit: 1 });
    if (sp_trackSearchResult.length > 0) {
        const video = sp_trackSearchResult[0];
        return [{
            title: video.title,
            url: video.url,
            duration: video.durationInSec,
            requestBy: userId
        }];
    }
    else {
        await interactionOrMessage.reply({ content: language.notHit[lang], ephemeral: true });
        return 0;
    }
}

async function addSpotifyTrackListToQueue(songString, userId, lang, interactionOrMessage) {
    const result = await playdl.spotify(songString);
    const name = result.name;
    const artist = result.artists && result.artists.length > 0 ? result.artists[0].name : "";
    const resultTracksList = result.fetched_tracks.get('1');

    if (resultTracksList && resultTracksList.length > 0) {
        const firstTrack = resultTracksList[0];
        const firstTrackName = firstTrack.name;
        const firstSearchResult = await playdl.search(firstTrackName + ' ' + artist, { source: { youtube: "video" }, limit: 1 });
        if (firstSearchResult.length > 0) {
            const firstVideo = firstSearchResult[0];
            const songs = [{
                title: firstVideo.title,
                url: firstVideo.url,
                duration: firstVideo.durationInSec,
                requestBy: userId
            }];

            const trackPromises = resultTracksList.slice(1).map(async spotifyTrack => {
                const trackName = spotifyTrack.name;
                const searchResult = await playdl.search(trackName + ' ' + artist, { source: { youtube: "video" }, limit: 1 });
                if (searchResult.length > 0) {
                    const video = searchResult[0];
                    return {
                        title: video.title,
                        url: video.url,
                        duration: video.durationInSec,
                        requestBy: userId
                    };
                }
                return null;
            });

            const tracks = await Promise.all(trackPromises);
            const validTracks = tracks.filter(track => track !== null);
            songs.push(...validTracks);
            return { name, songs };
        } else {
            await interactionOrMessage.reply({ content: language.aNotHit[lang](firstTrackName), ephemeral: true });
            return { name, songs: [] };
        }
    }
    return { name, songs: [] };
}

async function CreateServerQueue(guildId, voiceChannel, textChannel, songs) {
    const serverQueue = {
        textChannel,
        playingMessage: null,
        voiceChannel,
        connection: null,
        guildName: voiceChannel.guild.name,
        guildId: guildId,
        language: await lang(guildId) || 'en',
        removeWord: await removeWord(guildId) || false,
        loop: false,
        autoPlay: false,
        volume: await volume(guildId) || 10,
        commandStatus: new commandStatus(),
        songs: [],
        audioPlayer: createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Stop
            }
        }),
    };
    musicQueue.set(guildId, serverQueue);
    return serverQueue;
}

async function handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, albumName) {
    const loggerChannel = getLoggerChannel();
    const isPlaying = serverQueue.songs.length === 1;

    if (singleLists.includes(stringType)) {
        await interactionOrMessage.reply({ content: isPlaying ? language.addPlaying[lang](serverQueue.songs[0].title) : language.added[lang](serverQueue.songs.slice(-1)[0].title) });
        loggerChannel.send(`\`${interactionOrMessage.guild.name}\`に\`${serverQueue.songs.slice(-1)[0].title}\`を追加しました`);
        if (isPlaying) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        }
    }
    else if (multiLists.includes(stringType)) {
        const message = stringType === "yt_playlist"
            ? language.addToPlaylist[lang](addedCount) 
            : stringType === "sp_album" 
            ? language.addedAlbum[lang](albumName, addedCount) 
            : language.addedPlaylist[lang](albumName, addedCount);

        await interactionOrMessage.reply({ content: message });
        if (serverQueue.songs.length === addedCount) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            loggerChannel.send(`\`${interactionOrMessage.guild.name}\`で${stringType === "yt_playlist" ? 'YouTubeプレイリスト' : stringType === "sp_album" ? 'Spotifyアルバム' : 'Spotifyプレイリスト'}が\`${addedCount}\`件追加され、再生を開始します`);
        } else {
            loggerChannel.send(`\`${interactionOrMessage.guild.name}\`で${stringType === "yt_playlist" ? 'YouTubeプレイリスト' : stringType === "sp_album" ? 'Spotifyアルバム' : 'Spotifyプレイリスト'}が\`${addedCount}\`件追加されました`);
        }
    }
}

async function handleRemoveWord(interactionOrMessage, serverQueue, lang) {
    const textChannelPermission = interactionOrMessage.channel.permissionsFor(interactionOrMessage.client.user);
    if (serverQueue.removeWord && textChannelPermission.has(PermissionsBitField.Flags.ManageMessages)) {
        try {
            if (!interactionOrMessage.isCommand?.()) {
                setTimeout(async () => {
                    try {
                        await interactionOrMessage.delete();
                        console.log('Message deleted after 3 seconds.');
                    } catch (error) {
                        console.error('Failed to delete message after delay:', error);
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    }
}