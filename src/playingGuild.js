const { EmbedBuilder } = require('discord.js');
const { getStatusChannel, getStatusMessage, getLoggerChannel, getErrorChannel } = require('./log');
const { queue } = require('./musicQueue');
const { updateActivity } = require('./activity');

const { getClientInstant } = require('./activity');


async function updatePlayingGuild() {
    const client = getClientInstant();

    if (parseInt(process.env.SHARDS, 10) !== 1) {
        // 他のシャードからのリクエスト時、シャード1に委任
        return await client.shard.broadcastEval(
            async (c, { shardId }) => {
                if (parseInt(shardId, 10) === 1) {
                    await c.updatePlayingGuild(); // シャード1で処理を実行
                }
            },
            { context: { shardId: process.env.SHARDS } } // SHARDS を context 経由で渡す
        );
    }

    // シャード1自身が実行する処理
    const statusChannel = getStatusChannel();
    const statusMessage = getStatusMessage();
    const loggerChannel = getLoggerChannel();

    if (!statusChannel) {
        loggerChannel.send('Statusチャンネルに接続できませんでした');
        return;
    }

    process.customData = []; // データを初期化

    // 全シャードのデータを収集
    const results = await client.shard.broadcastEval(() => {
        const { queue } = require('./musicQueue');
        const data = [];

        queue.forEach((value, key) => {
            const membersInfo = value.voiceChannel?.members.map(member => ({
                name: member.user.username,
                id: member.user.id,
            }));

            const requestByUser = membersInfo?.find(member => member.id === value.songs[0]?.requestBy);

            data.push({
                guildName: value.guildName,
                guildId: key,
                listener: (value.voiceChannel.members.size - 1).toString(),
                nowPlaying: value.songs[0] ? `[${value.songs[0].title}](${value.songs[0].url})` : 'なし',
                nextPlaying: value.songs[1] ? `[${value.songs[1].title}](${value.songs[1].url})` : 'なし',
                queue: value.songs,
                queueLength: value.songs.length.toString(),
                playTime: `${getTotalDuration(value)}`,
                duration: value.time,
                member: membersInfo || [],
                requestBy: requestByUser || { name: 'Unknown', id: 'Unknown' },
                status: {
                    volume: `${value.volume}%`,
                    loop: value.loop ? 'ON' : 'Off',
                    autoPlay: value.autoPlay ? 'ON' : 'Off',
                    removeWord: value.removeWord ? 'ON' : 'Off',
                    lang: value.language,
                },
            });
        });

        return data;
    });

    // 全シャードのデータを統合
    const combinedData = results.flat();
    process.customData = combinedData; // Web用に保存

    const mapSize = combinedData.length;
    const listener = combinedData.reduce((sum, guild) => sum + parseInt(guild.listener, 10), 0);

    const embed = new EmbedBuilder()
        .setTitle('Bot is Online!')
        .setColor(mapSize > 0 ? '#00ff00' : '#FF0000')
        .setTimestamp()
        .setDescription(`アクティブなボイスチャンネル: **${mapSize}VC** | 総リスナー: **${listener}人**`);

    if (mapSize === 0) {
        embed.setTitle('現在稼働しているサーバーはありません');
    } else {
        combinedData.forEach(guild => {
            embed.addFields({
                name: guild.guildName,
                value: `Listeners: ${guild.listener}\nNow Playing: ${guild.nowPlaying}\nNext: ${guild.nextPlaying}`,
                inline: false,
            });
        });
    }

    if (!statusMessage) {
        return statusChannel.send({ embeds: [embed] });
    }

    return statusMessage.edit({ embeds: [embed] });
}

// function updatePlayingGuild() {
//     const statusChannel = getStatusChannel();
//     const statusMessage = getStatusMessage();
//     const loggerChannel = getLoggerChannel();
//     const errorChannel = getErrorChannel();
//     if (!statusChannel) return loggerChannel.send('Statusチャンネルに接続できませんでした');

//     process.customData = [];

//     const mapSize = queue.size;
//     let listener = 0;
//     let membersInfo = [];

//     let hasValidServer = false;
//     const embed = new EmbedBuilder()
//         .setTitle('Bot is Online!')
//         .setColor('#00ff00')
//         .setTimestamp();

//     queue.forEach((value, key) => {

//         if (!value.songs || value.songs.length === 0 || !value.songs[0]?.title) {
//             hasValidServer = true;
//             cleanupQueue(key);
//         }

//         if (value.voiceChannel && value.voiceChannel.members) {
//             listener += value.voiceChannel.members.size -1;
//             membersInfo = value.voiceChannel.members.map(member => ({
//                 name: member.user.username,
//                 id: member.user.id
//             }));
//         }

//     });

//     if (mapSize === 0 | hasValidServer) {
//         embed.setTitle('現在稼働しているサーバーはありません');
//         embed.setDescription(`アクティブなボイスチャンネル: **${mapSize}VC** | 総リスナー: **${listener}人**`);
//         embed.setColor('#FF0000');
//     }
//     else {
//         embed.setTitle('現在稼働しているサーバーリスト');
//         embed.setDescription(`アクティブなボイスチャンネル: **${mapSize}VC** | 総リスナー: **${listener}人**`);
//         embed.setColor('#00ffff');
//         queue.forEach((value, key) => {
//             // embed.addFields(
//             //     {name: '\u200B', value: '---------------------------------'},
//             //     {name: value.guildName, value: value.guildId, inline: true },
//             //     {name: 'listener', value: (value.voiceChannel.members.size - 1).toString(), inline: true },
//             //     {name: 'Now Playing', value: `[${value.songs[0].title}](${value.songs[0].url})`},
//             //     {name: 'Next Playing', value: value.songs[1] ? `[${value.songs[1].title}](${value.songs[1].url})` : 'なし'},
//             //     {name: 'Queue Length', value: value.songs.length.toString(), inline: true},
//             //     {name: `Play Time`, value: `${getTotalDuration(value)}`, inline: true},
//             //     {name: `Request By`, value: `<@${value.songs[0].requestBy}>`, inline: true},
//             //     {name: `status`, value: `Volume: \`${value.volume}%\` | Loop: \`${value.loop ? 'ON' : 'Off'}\` | AutoPlay: \`${value.autoPlay ? 'ON' : 'Off' }\` | removeWord : \`${value.removeWord ? 'ON' : 'Off' }\` | lang : \`${value.language}\``},
//             // );
//             const requestByUser = membersInfo.find(member => member.id === value.songs[0].requestBy);
//             const guildData = {
//                 guildName: value.guildName,
//                 guildId: value.guildId,
//                 listener: (value.voiceChannel.members.size - 1).toString(),
//                 nowPlaying: `[${value.songs[0].title}](${value.songs[0].url})`,
//                 nextPlaying: value.songs[1] ? `[${value.songs[1].title}](${value.songs[1].url})` : 'なし',
//                 queue: value.songs,
//                 queueLength: value.songs.length.toString(),
//                 playTime: `${getTotalDuration(value)}`,
//                 duration: {
//                     start: value.time.start,
//                     end: value.time.end,
//                     current: value.time.current,
//                 },
//                 member: membersInfo,
//                 requestBy: requestByUser ? { name: requestByUser.name, id: requestByUser.id } : { name: 'Unknown', id: 'Unknown' },
//                 status: {
//                     volume: `${value.volume}%`,
//                     loop: value.loop ? 'ON' : 'Off',
//                     autoPlay: value.autoPlay ? 'ON' : 'Off',
//                     removeWord: value.removeWord ? 'ON' : 'Off',
//                     lang: value.language,
//                 },
//             };
        
//             process.customData.push(guildData);
//         });
//     }

//     if (!statusMessage) {
//         statusChannel.send({embeds: [embed]});
//         return statusChannel.messages.fetch({limit: 1}).then(messages => {
//             const lastMessage = messages.first();
//             if (lastMessage) {
//                 lastMessage.delete();
//             }
//         });
//     }

//     return statusMessage.edit({embeds: [embed]});
// }

async function cleanupQueue(guildId) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue) return ;
    if (serverQueue.connection && serverQueue.connection.state.status !== "destroyed") serverQueue.connection.destroy();

    if (serverQueue.time.interval) clearInterval(serverQueue.time.interval);
    if (serverQueue.ffmpegProcess) serverQueue.ffmpegProcess.kill('SIGKILL');
    queue.delete(guildId);
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