const playdl = require('play-dl');
const { queue: musicQueue } = require('./musicQueue');
const { getLoggerChannel, getErrorChannel } = require('./log');

async function autoplay (guildId) {
    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();
    try {
        const serverQueue = musicQueue.get(guildId);
        const videoInfo = await playdl.video_basic_info(serverQueue.songs[0].url);
        const relatedVideos = videoInfo.related_videos;
        const randomIndex = Math.floor(Math.random() * (8 - 1 + 1)) + 3;
        const NextPlayingVideoInfo = await playdl.video_basic_info(relatedVideos[randomIndex]);
        serverQueue.songs.push(
            {
                title: NextPlayingVideoInfo.video_details.title,
                url: relatedVideos[randomIndex],
                duration: NextPlayingVideoInfo.video_details.durationInSec,
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