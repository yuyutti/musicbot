const { EmbedBuilder } = require('discord.js');
const { getPlayingGuildChannel } = require('./log');
const { queue } = require('./musicQueue');

function updatePlayingGuild() {
    const channel = getPlayingGuildChannel();
    if (!channel) return console.log('Statusチャンネルに接続できませんでした');

    const mapSize = queue.size;

    const embed = new EmbedBuilder()
        .setTitle('Bot is Online!')
        .setColor('#00ff00')
        .setTimestamp();

    if (mapSize === 0) {
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
                {name: value.voiceChannel.guild.name, value: key.toString()},
                {name: 'Now Playing', value: `[${value.songs[0].title}](${value.songs[0].url})`},
                {name: 'Next Playing', value: value.songs[1] ? `[${value.songs[1].title}](${value.songs[1].url})` : 'なし'},
                {name: 'Queue Length', value: value.songs.length.toString(), inline: true},
                {name: `Play Time`, value: `${getTotalDuration(value)}`, inline: true},
                {name: `Request By`, value: `<@${value.songs[0].requestBy}>`, inline: true},
                {name: `status`, value: `Volume: \`${value.volume}%\` | Loop: \`${value.loop ? 'ON' : 'Off'}\` | AutoPlay: \`${value.autoPlay ? 'ON' : 'Off' }\` | removeWord : \`${value.removeWord ? 'ON' : 'Off' }\` | lang : \`${value.language}\``},
            );
        });
    }

    channel.edit({embeds: [embed]});
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

module.exports = updatePlayingGuild;