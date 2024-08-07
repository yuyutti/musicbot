const playdl = require("play-dl");
const language = require("../lang/commands/play");

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
    return { addedCount: songs.length, songs, name };
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

module.exports = { handleSongType }