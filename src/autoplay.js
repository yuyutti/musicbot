const playdl = require('play-dl');
const ytdl = require('@distube/ytdl-core'); // distubejs/ytdl-core#pull/163/head を使用
const { queue: musicQueue } = require('./musicQueue');
const { getLoggerChannel, getErrorChannel } = require('./log');
const proxyManager = require('./proxymanager');

async function autoplay (guildId) {
    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();
    try {
        const serverQueue = musicQueue.get(guildId);
        const proxy = proxyManager.getProxy();
        let agent = null;
        if (proxy) {
            agent = ytdl.createProxyAgent( { uri: proxy } );
        }
        // const videoInfo = await playdl.video_basic_info(serverQueue.songs[0].url);
        const videoInfo = await ytdl.getBasicInfo(serverQueue.songs[0].url, { agent });
        const relatedVideos = videoInfo.related_videos;
        const randomIndex = Math.floor(Math.random() * relatedVideos.length);
        // const NextPlayingVideoInfo = await playdl.video_basic_info(relatedVideos[randomIndex]);
        const NextPlayingVideoInfo = await ytdl.getBasicInfo(`https://www.youtube.com/watch?v=${relatedVideos[randomIndex].id}`, { agent });
        serverQueue.songs.push(
            {
                title: NextPlayingVideoInfo.videoDetails.title,
                url: `https://www.youtube.com/watch?v=${relatedVideos[randomIndex].id}`,
                duration: NextPlayingVideoInfo.videoDetails.lengthSeconds,
                requestBy: '1113282204064297010'
            }
        );
        loggerChannel.send(`autoplay: **${serverQueue.guildName}**に**${serverQueue.songs.slice(-1)[0].title}**を追加しました`);
        return true
    } catch (error) {
        console.log(error)
        errorChannel.send(`autoplay: \n\`\`\`${error}\`\`\``);
        return false
    }
}


module.exports = { autoplay };