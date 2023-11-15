const moment = require('moment');
const cheerio = require('cheerio');
require('dotenv').config();
const { youtube_error } = require('../package/notification')
const YouTubeAPIKey = process.env.YouTube_API_KEY.split(",")
let Key_number = 0
async function YouTube_API_Key() {
    if(Key_number === YouTubeAPIKey.length){
        Key_number = 0
    }
    const YouTube_API_key = YouTubeAPIKey[Key_number]
    Key_number++
    return YouTube_API_key
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

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));
            totalResults = videoUrls.length;
            mix = true
            return { videoUrls, videoTitles, totalResults, mix };
        }

        do {
            const YouTube_API_key = await YouTube_API_Key()
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${YouTube_API_key}&pageToken=${nextPageToken}`;
            const response = await fetch(url);
            const data = await response.json();

            nextPageToken = data.nextPageToken;

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));
            iterations++;
        } while (nextPageToken && iterations < 4);
        totalResults = videoUrls.length;
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

async function Spotify_playlist_search(searchQuery,youtube_error_channel){
    try{
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}+%23music`);
        const html = await response.text();
        const $ = cheerio.load(html);
    
        const scripts = $('script').toArray();
        let ytInitialDataScript = null;
        for (const script of scripts) {
            const content = $(script).html();
            if (content.includes('ytInitialData')) {
                ytInitialDataScript = content;
                break;
            }
        }
        if (ytInitialDataScript) {
            const start = ytInitialDataScript.indexOf('{');
            const end = ytInitialDataScript.lastIndexOf(';');
            if (start !== -1 && end !== -1) {
                const ytInitialDataString = ytInitialDataScript.substring(start, end);
                const ytInitialData = JSON.parse(ytInitialDataString);
                const json = ytInitialData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents[1].videoRenderer
                const url = `https://www.youtube.com/watch?v=${json.videoId}`
                const title = json.title.runs[0].text
                return { title, url };
            }
        }
    }
    catch(error){
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

async function getInfo(VideoURL) {
    const regex = /(?:\?v=|\/embed\/|\/v\/|\.be\/|\/shorts\/)([\w-]+)(?:\S+)?$/;
    const matchResult = VideoURL.match(regex);
    const vid = matchResult ? matchResult[1] : null;
    const YouTube_API_key = await YouTube_API_Key()
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${vid}&key=${YouTube_API_key}&part=snippet,contentDetails`;
    try {
    const response = await fetch(url)
    const data = await response.json();
    const title = data.items[0].snippet.title
    const duration = moment.duration(data.items[0].contentDetails.duration).asSeconds();
    return { title, duration }
    }
    catch{
        console.log(error);
        youtube_error(error,youtube_error_channel)
        return null;
    }
}

function getRandomNumber() {
    return Math.floor(Math.random() * (10 - 1 + 1)) + 1;
}

module.exports = { playlist, NextPlay, search, getInfo, Spotify_playlist_search }