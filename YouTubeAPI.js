require('dotenv').config();
const YouTube_API_Key = process.env.YouTube_API_KEY

async function playlist(playlistId) {
    try {
        const maxResults = 50;
        let nextPageToken = '';
        let iterations = 0;

        let videoUrls = [];
        let videoTitles = [];
        let totalResults = 0;

        if (playlistId.length === 13){
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${YouTube_API_Key}`;
            const response = await fetch(url);
            const data = await response.json();

            totalResults = data.pageInfo.totalResults;

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));

            const videoCount = totalResults;
            const fastVideotitle = videoTitles[0];
            const mess = `ミックスリストを${videoCount}曲読み込みました\nYouTubeの仕様によりミックスリストではユーザーによって異なるリストが生成されます\nミックスリストをキューに追加しますか？\n最初の曲: ${fastVideotitle}\nミックスリストを追加する場合は「✔」 | 最初の曲のみ追加する場合は「✖」`
            return { videoUrls, videoTitles, totalResults, mess };
        }

        do {
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${YouTube_API_Key}&pageToken=${nextPageToken}`;
            const response = await fetch(url);
            const data = await response.json();

            totalResults += data.pageInfo.totalResults;
            nextPageToken = data.nextPageToken;

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));
            iterations++;
        } while (nextPageToken && iterations < 20);

        const videoCount = totalResults;
        const fastVideotitle = videoTitles[0];
        let warning = ''
        if(videoCount > 1000){
            warning = "\n1度に取得できる最大曲数は1000曲です。"
        }
        const mess = `再生リストから${videoCount}曲が見つかりました。${warning}\n最初の曲: ${fastVideotitle}\n再生リストを追加する場合は「✔」 | 最初の曲のみ追加する場合は「✖」`
        return { videoUrls, videoTitles, totalResults, mess };
    } catch (error) {
        console.error('Failed to get playlist videos:', error);
    }
}

async function search(searchQuery) {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(searchQuery)}&key=${YouTube_API_Key}`;
    console.log(searchUrl)
    try {
        const response = await fetch(searchUrl);
        const data = await response.json();

        const videoUrls = data.items.map(item => `https://www.youtube.com/watch?v=${item.id.videoId}`);
        const videoTitles = data.items.map(item => item.snippet.title);
        const totalResults = data.pageInfo.totalResults;

        return { videoUrls, videoTitles, totalResults };
    } catch (error) {
        console.error(error);
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
            const parsedData = JSON.parse(responsematchdata);
            const title = parsedData.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results[0].compactVideoRenderer.title.simpleText;
            const videoId = parsedData.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results[0].compactVideoRenderer.videoId;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            return { title, videoUrl };
        } else {
            return null;
        }
    } catch (error) {
        console.log(error);
        return null;
    }
}

module.exports = { playlist, NextPlay, search }