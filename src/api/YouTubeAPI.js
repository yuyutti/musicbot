require('dotenv').config();
const { youtube_error } = require('../notification')
const YouTubeAPIKey1 = process.env.YouTube_API_KEY1
const YouTubeAPIKey2 = process.env.YouTube_API_KEY2
const YouTubeAPIKey3 = process.env.YouTube_API_KEY3
const YouTubeAPIKey4 = process.env.YouTube_API_KEY4
const YouTubeAPIKey5 = process.env.YouTube_API_KEY5
let Key_number = 1
async function YouTube_API_Key() {
    if(Key_number === 1){
        Key_number++
        return YouTubeAPIKey1
    }
    if(Key_number === 2){
        Key_number++
        return YouTubeAPIKey2
    }
    if(Key_number === 3){
        Key_number++
        return YouTubeAPIKey3
    }
    if(Key_number === 4){
        Key_number++
        return YouTubeAPIKey4
    }
    if(Key_number === 5){
        Key_number = 1
        return YouTubeAPIKey5
    }
}

async function playlist(playlistId,youtube_error_channel) {
    try {
        const maxResults = 50;
        let nextPageToken = '';
        let iterations = 0;

        let videoUrls = [];
        let videoTitles = [];
        let totalResults = 0;

        if (playlistId.length === 13){
            const YouTube_API_key = await YouTube_API_Key()
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${YouTube_API_key}`;
            const response = await fetch(url);
            const data = await response.json();

            totalResults = data.pageInfo.totalResults;

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));
            mix = true
            return { videoUrls, videoTitles, totalResults, mix };
        }

        do {
            const YouTube_API_key = await YouTube_API_Key()
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${YouTube_API_key}&pageToken=${nextPageToken}`;
            const response = await fetch(url);
            const data = await response.json();

            totalResults += data.pageInfo.totalResults;
            nextPageToken = data.nextPageToken;

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));
            iterations++;
        } while (nextPageToken && iterations < 20);
        mix = false
        return { videoUrls, videoTitles, totalResults, mix };
    } catch (error) {
        console.error('Failed to get playlist videos:', error);
        youtube_error(error,youtube_error_channel)
    }
}

async function search(searchQuery,maxResults) {
    const YouTube_API_key = await YouTube_API_Key()
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(searchQuery)}&key=${YouTube_API_key}`;
    try {
        const response = await fetch(searchUrl);
        const data = await response.json();

        const videoUrls = data.items.map(item => `https://www.youtube.com/watch?v=${item.id.videoId}`);
        const videoTitles = data.items.map(item => item.snippet.title);
        const totalResults = data.pageInfo.totalResults;

        return { videoUrls, videoTitles, totalResults };
    } catch (error) {
        console.error(error);
        youtube_error(error,youtube_error_channel)
        return null;
    }
}

async function NextPlay(VideoURL) {
    const regex = /(?:\?v=|\/embed\/|\/v\/|\.be\/|\/shorts\/)([\w-]+)(?:\S+)?$/;
    const matchResult = VideoURL.match(regex);
    const vid = matchResult ? matchResult[1] : null;
    const url = `https://www.youtube.com/watch?v=${vid}`;
    try {
    const response = await fetch(url);
    const data = await response.text();
    const regex = /var ytInitialData = ({[\s\S]*?});/;
    const match = data.match(regex);
        if (match) {
            const responsematchdata = match[1];
            const parsedData = await JSON.parse(responsematchdata);
            const number = getRandomNumber()
            const title = parsedData.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results[number].compactVideoRenderer.title.simpleText;
            const videoId = parsedData.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results[number].compactVideoRenderer.videoId;
            if (title === null && videoId === null) {
                return null
            }
            else{
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                return { title, videoUrl };
            }
        } else {
            return null;
        }
    } catch (error) {
        console.log(error);
        youtube_error(error,youtube_error_channel)
        return null;
    }
}

function getRandomNumber() {
    return Math.floor(Math.random() * (10 - 1 + 1)) + 1;
}

module.exports = { playlist, NextPlay, search }