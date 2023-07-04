async function playlist(playlistId, apiKey) {
    try {
        const maxResults = 50;
        let nextPageToken = '';
        let iterations = 0;

        let videoUrls = [];
        let videoTitles = [];
        let totalResults = 0;

        if (playlistId.length === 13){
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${apiKey}`;
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
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${apiKey}&pageToken=${nextPageToken}`;
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

module.exports = { playlist }