const { EmbedBuilder } = require('discord.js');
const { getPlayingGuildChannel } = require('./log');
const { queue } = require('./musicQueue');

function updatePlayingGuild() {
    const mapSize = queue.size;

    const embed = new EmbedBuilder()
        .setTitle('Now Playing')
        .setColor('#FF0000')
        .setTimestamp();

    queue.forEach((value, key) => {
        embed.setDescription(`アクティブなボイスチャンネル: ${mapSize}`);
        embed.addFields(
            {name: value.voiceChannel.guild.name, value: key.toString()},
            {name: 'Now Playing', value: `[${value.songs[0].title}](${value.songs[0].url})`},
            {name: 'Queue Length', value: value.songs.length.toString()},
            {name: `status`, value: `Volume: \`${value.volume}%\` | Loop: \`${value.loop ? 'on' : 'off'}\` | AutoPlay: \`${value.autoPlay}\` | lang : \`${value.language}\``}
        );
    });

    getPlayingGuildChannel.edit({embeds: [embed]});
}

module.exports = updatePlayingGuild;