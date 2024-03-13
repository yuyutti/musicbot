const { PermissionsBitField } = require('discord.js');
const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const playdl = require('play-dl');
const { queue: musicQueue } = require('../src/musicQueue');
const { playSong } = require('../src/playsong');
const { volume, lang, removeWord } = require('../SQL/lockup');
const language = require('../lang/commands/play');
const { commandStatus } = require('../events/event');
const { getLoggerChannel, getErrorChannel } = require('../src/log');

module.exports = {
    data: {
        name: 'play',
        description: 'Plays a song or playlist',
        name_localizations: {
            ja: 'play',
        },
        description_localizations: {
            ja: '曲またはプレイリストを再生します',
        },
        options: [
            {
                name: 'song',
                description: 'The song URL, playlist URL, or search keywords',
                name_localizations: {
                    ja: '曲',
                },
                description_localizations: {
                    ja: '曲のURL、プレイリストのURL、または検索キーワード',
                },
                type: 3,
                required: true
            }
        ]
    },
    alias: ['p'],
    async execute(interactionOrMessage, args, lang) {
        let songString;
        let voiceChannel;
        let userId;
        let inputType = null;
        let playlistName;
        let addedCount = 0;

        const loggerChannel = getLoggerChannel();
        const errorChannel = getErrorChannel();
        
        if (interactionOrMessage.isCommand?.()) {
            songString = interactionOrMessage.options.getString('song');
            voiceChannel = interactionOrMessage.member.voice.channel;
            userId = interactionOrMessage.user.id;
        } else {
            songString = args.join(' ');
            voiceChannel = interactionOrMessage.member.voice.channel;
            userId = interactionOrMessage.author.id;
        }

        if (!voiceChannel) return interactionOrMessage.reply({ content: language.unVoiceChannel[lang], ephemeral: true });

        const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);

        if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) return interactionOrMessage.reply({ content: language.ViewChannelPermission[lang], ephemeral: true });
        if (!permissions.has(PermissionsBitField.Flags.Connect)) return interactionOrMessage.reply({ content: language.ConnectPermission[lang], ephemeral: true });
        if (!permissions.has(PermissionsBitField.Flags.Speak)) return interactionOrMessage.reply({ content: language.SpeakPermission[lang], ephemeral: true });

        const serverQueue = musicQueue.get(interactionOrMessage.guildId) || await createServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel);

        const stringType = await playdl.validate(songString);

        if (stringType === "sp_track" || stringType === "sp_album" || stringType === "sp_playlist") {
            if (playdl.is_expired()) await playdl.refreshToken()
        }

        switch (stringType) {

            case "yt_video":
                const videoInfo = await playdl.video_basic_info(songString);
                serverQueue.songs.push(
                    {
                        title: videoInfo.video_details.title,
                        url: songString,
                        duration: videoInfo.video_details.durationInSec,
                        requestBy: userId
                    }
                );
            break;
            
            case "yt_playlist":
                inputType = "yt_playlist";
                const playlistInfo = await playdl.playlist_info(songString,{ incomplete : true });
                const initialLength = serverQueue.songs.length;
                for (const video of playlistInfo.videos) {
                    serverQueue.songs.push(
                        {
                            title: video.title,
                            url: video.url,
                            duration: video.durationInSec,
                            requestBy: userId
                        }
                    );
                }
                addedCount = serverQueue.songs.length - initialLength;
            break;
            
            case "search":
                const searchResult = await playdl.search(songString, { source : { youtube : "video" }, limit: 1 });
                if (searchResult.length > 0) {
                    const video = searchResult[0];
                    serverQueue.songs.push(
                        {
                            title: video.title,
                            url: video.url,
                            duration: video.durationInSec,
                            requestBy: userId
                        }
                    );
                } else {
                    return interactionOrMessage.reply({ content: language.notHit[lang], ephemeral: true });
                }
            break;
            
            case "sp_track":
                const sp_track = await playdl.spotify(songString);
                const trackName = sp_track.spotifyTrack.name;
                const sp_trackSearchResult = await playdl.search(trackName, { source: { youtube: "video" }, limit: 1 });
                if (sp_trackSearchResult.length > 0) {
                    const video = sp_trackSearchResult[0];
                    serverQueue.songs.push({
                        title: video.title,
                        url: video.url,
                        duration: video.durationInSec,
                        requestBy: userId
                    });
                }
                else {
                    return interactionOrMessage.reply({ content: language.notHit[lang], ephemeral: true });
                }
            break;
            
            case "sp_album":
                inputType = "sp_album";
                const sp_album = await addSpotifyTrackListToQueue(songString, serverQueue, userId, lang, interactionOrMessage);
                playlistName = sp_album.Name;
                addedCount = sp_album.addedCount;
                break;
            
            case "sp_playlist":
                inputType = "sp_playlist";
                const sp_playlist = await addSpotifyTrackListToQueue(songString, serverQueue, userId, lang, interactionOrMessage);
                playlistName = sp_playlist.Name;
                addedCount = sp_playlist.addedCount;
            break;

            case false:
                return interactionOrMessage.reply({ content: language.unLink[lang], ephemeral: true });
        
            default:
                return interactionOrMessage.reply({ content: language.notSupportService[lang], ephemeral: true });
        }

        musicQueue.set(interactionOrMessage.guildId, serverQueue);
        
        if (!inputType) {
            if (serverQueue.songs.length === 1) {
                playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
                interactionOrMessage.reply({ content: language.addPlaying[lang](serverQueue.songs[0].title) });
                loggerChannel.send(`\`${interactionOrMessage.guild.name}\`で\`${serverQueue.songs[0].title}\`を再生します`);
            }
            else {
                const lastSong = serverQueue.songs.length - 1;
                interactionOrMessage.reply({ content: language.added[lang](serverQueue.songs[lastSong].title) });
                loggerChannel.send(`\`${interactionOrMessage.guild.name}\`に\`${serverQueue.songs[lastSong].title}\`を追加しました`);
            }
        }
        else if (inputType === "yt_playlist") {
            interactionOrMessage.reply({ content: language.addToPlaylist[lang](addedCount) });
            if (serverQueue.songs.length === addedCount) {
                playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
                return loggerChannel.send(`\`${interactionOrMessage.guild.name}\`でYouTubeプレイリストが\`${addedCount}\`件追加され、を再生を開始します`);
            }
            loggerChannel.send(`\`${interactionOrMessage.guild.name}\`でYouTubeプレイリストが\`${addedCount}\`件追加されました`);
        }
        else if (inputType === "sp_album") {
            interactionOrMessage.reply({ content: language.addedAlbum[lang](playlistName,addedCount) });
            if (serverQueue.songs.length === addedCount) {
                playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
                return loggerChannel.send(`\`${interactionOrMessage.guild.name}\`でSpotifyアルバムが\`${addedCount}\`件追加され、を再生を開始します`);
            }
            loggerChannel.send(`\`${interactionOrMessage.guild.name}\`でSpotifyアルバムが\`${addedCount}\`件追加されました`);
        }
        else if (inputType === "sp_playlist") {
            interactionOrMessage.reply({ content: language.addedPlaylist[lang](playlistName,addedCount) });
            if (serverQueue.songs.length === addedCount) {
                playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
                return loggerChannel.send(`\`${interactionOrMessage.guild.name}\`でSpotifyプレイリストが\`${addedCount}\`件追加され、を再生を開始します`);
            }
            loggerChannel.send(`\`${interactionOrMessage.guild.name}\`でSpotifyプレイリストが\`${addedCount}\`件追加されました`);
        }
        
        const textChannelPermission = interactionOrMessage.channel.permissionsFor(interactionOrMessage.client.user);
        if (serverQueue.removeWord && textChannelPermission.has(PermissionsBitField.Flags.ManageMessages)) {
            console.log('removeWord');
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
};

async function addSpotifyTrackListToQueue(songString, serverQueue, userId, lang, interactionOrMessage) {
    const result = await playdl.spotify(songString);
    const Name = result.name;
    const artist = result.artists && result.artists.length > 0 ? result.artists[0].name : "";
    const resultTracksList = result.fetched_tracks.get('1');
    let addedCount = 0;

    if (resultTracksList && resultTracksList.length > 0) {
        const firstTrack = resultTracksList[0];
        const firstTrackName = firstTrack.name;
        const firstSearchResult = await playdl.search(firstTrackName + ' ' + artist, { source: { youtube: "video" }, limit: 1 });
        if (firstSearchResult.length > 0) {
            const firstVideo = firstSearchResult[0];
            serverQueue.songs.push({
                title: firstVideo.title,
                url: firstVideo.url,
                duration: firstVideo.durationInSec,
                requestBy: userId
            });
            addedCount++;
            playSong(serverQueue.guildId, serverQueue.songs[0]);
        } else {
            return interactionOrMessage.reply({ content: language.aNotHit[lang](firstTrackName), ephemeral: true });
        }

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
        serverQueue.songs.push(...validTracks);
        addedCount += validTracks.length;
    }
    return { Name, addedCount };
}

async function createServerQueue(guildId, voiceChannel, textChannel) {
    const queueConstruct = {
        textChannel,
        playingMessage: null,
        voiceChannel,
        connection: null,
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
    musicQueue.set(guildId, queueConstruct);

    return queueConstruct;
}