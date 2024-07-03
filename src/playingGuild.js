const { EmbedBuilder } = require('discord.js');
const { getStatusChannel, getStatusMessage, getLoggerChannel, getErrorChannel } = require('./log');
const { queue } = require('./musicQueue');
const { updateActivity } = require('./activity');

function updatePlayingGuild() {
    const statusChannel = getStatusChannel();
    const statusMessage = getStatusMessage();
    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();
    if (!statusChannel) return loggerChannel.send('Statusチャンネルに接続できませんでした');

    const mapSize = queue.size;
    let hasValidServer = false;
    const embed = new EmbedBuilder()
        .setTitle('Bot is Online!')
        .setColor('#00ff00')
        .setTimestamp();

    queue.forEach((value, key) => {
        if (!value.songs[0].title) {
            hasValidServer = true;
            cleanupQueue(key);
        }
    });

    if (mapSize === 0 | hasValidServer) {
        embed.setTitle('現在稼働しているサーバーはありません');
        embed.setDescription(`アクティブなボイスチャンネル: ${mapSize}`);
        embed.setColor('#FF0000');
    }
    else {
        embed.setTitle('現在稼働しているサーバーリスト');
        embed.setDescription(`アクティブなボイスチャンネル: **${mapSize}VC**`);
        embed.setColor('#00ffff');
        queue.forEach((value, key) => {
            embed.addFields(
                {name: '\u200B', value: '---------------------------------'},
                {name: value.guildName, value: value.guildId},
                {name: 'Now Playing', value: `[${value.songs[0].title}](${value.songs[0].url})`},
                {name: 'Next Playing', value: value.songs[1] ? `[${value.songs[1].title}](${value.songs[1].url})` : 'なし'},
                {name: 'Queue Length', value: value.songs.length.toString(), inline: true},
                {name: `Play Time`, value: `${getTotalDuration(value)}`, inline: true},
                {name: `Request By`, value: `<@${value.songs[0].requestBy}>`, inline: true},
                {name: `status`, value: `Volume: \`${value.volume}%\` | Loop: \`${value.loop ? 'ON' : 'Off'}\` | AutoPlay: \`${value.autoPlay ? 'ON' : 'Off' }\` | removeWord : \`${value.removeWord ? 'ON' : 'Off' }\` | lang : \`${value.language}\``},
            );
        });
    }

    if (!statusMessage) {
        statusChannel.send({embeds: [embed]});
        return statusChannel.messages.fetch({limit: 1}).then(messages => {
            const lastMessage = messages.first();
            if (lastMessage) {
                lastMessage.delete();
            }
        });
    }

    return statusMessage.edit({embeds: [embed]});

}

async function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (!serverQueue) return ;
    if (serverQueue.connection && serverQueue.connection.state.status !== "destroyed") serverQueue.connection.destroy();

    if (serverQueue.time.interval) clearInterval(serverQueue.time.interval);
    if (serverQueue.ffmpegProcess) serverQueue.ffmpegProcess.kill('SIGKILL');
    musicQueue.delete(guildId);
    updateActivity();
    updatePlayingGuild();
}

function getTotalDuration(value) {
    let totalDuration = 0;
    for (const song of value.songs) {
        totalDuration += Number(song.duration) || 0;
    }
    return formatDuration(totalDuration);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsLeft = seconds % 60;

    return [
        hours,
        hours ? String(minutes).padStart(2, '0') : minutes,
        String(secondsLeft).padStart(2, '0'),
    ].filter(Boolean).join(':');
}

module.exports = { updatePlayingGuild };