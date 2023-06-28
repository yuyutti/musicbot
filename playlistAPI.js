async function playlist(playlistId, apiKey) {
    try {
        const maxResults = 50; // 1回のリクエストで取得する最大数
        let nextPageToken = ''; // 次のページのトークン

        let videoUrls = [];
        let videoTitles = [];
        let totalResults = 0;

        do {
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&part=contentDetails&key=${apiKey}&pageToken=${nextPageToken}`;
            const response = await fetch(url);
            const data = await response.json();

            totalResults = data.pageInfo.totalResults;
            nextPageToken = data.nextPageToken;

            const videos = data.items;
            videoUrls = videoUrls.concat(videos.map(video => `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`));
            videoTitles = videoTitles.concat(videos.map(video => video.snippet.title));
        } while (nextPageToken);

        return { videoUrls, videoTitles, totalResults };
    } catch (error) {
        console.error('Failed to get playlist videos:', error);
    }
}

module.exports = { playlist }