const { queue: musicQueue } = require('./musicQueue');
const { getLoggerChannel, getErrorChannel } = require('./log');
const proxyManager = require('./proxymanager');
const { ytdlpJson, getYouTubeVideoId } = require('./ytdlp');

async function autoplay (guildId) {
    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();
    try {
        const serverQueue = musicQueue.get(guildId);
        const proxy = proxyManager.getProxy();

        const currentUrl = serverQueue.songs[0].url;
        const videoId = getYouTubeVideoId(currentUrl);
        if (!videoId) throw new Error(`Could not extract videoId from: ${currentUrl}`);

        // YouTube Radio Mix (RD) から2曲目を取得 → 自動再生の次曲
        const radioUrl = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
        const nextVideo = await ytdlpJson(radioUrl, ['--playlist-start', '2', '--playlist-end', '2'], proxy);

        const video = Array.isArray(nextVideo) ? nextVideo[0] : nextVideo;

        serverQueue.songs.push({
            title: video.title,
            url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`,
            duration: video.duration,
            requestBy: '1113282204064297010'
        });
        loggerChannel.send(`autoplay: **${serverQueue.guildName}**に**${serverQueue.songs.slice(-1)[0].title}**を追加しました`);
        return true;
    } catch (error) {
        console.log(error);
        errorChannel.send(`autoplay: \n\`\`\`${error}\`\`\``);
        return false;
    }
}


module.exports = { autoplay };