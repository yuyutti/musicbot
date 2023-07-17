// やることリスト
// ・VCメンバーがBOTのみになると退出
// ・VCから切断された場合の退出処理処理

const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { joinVoiceChannel, createAudioResource, playAudioResource, AudioPlayerStatus, createAudioPlayer } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const youtubeSearch = require('youtube-search');
const { playlist } = require('./playlistAPI');
const express = require('express')
const app = express()
require('dotenv').config();

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const confirmButton = new MessageButton()
    .setCustomId('confirm')
    .setLabel('✔')
    .setStyle('SUCCESS');

const cancelButton = new MessageButton()
    .setCustomId('cancel')
    .setLabel('✖')
    .setStyle('DANGER');

const row = new MessageActionRow().addComponents(confirmButton, cancelButton);


const token = process.env.DISCORD_TOKEN
const prefix = process.env.DISCORD_PREFIX
const YouTube_API_Key = process.env.YouTube_API_KEY

const searchOptions = {
    maxResults: 1,
    key: YouTube_API_Key,
    type: 'video'
};

let queues = {};
let loopStatus = {};
const voiceConnections = {};

app.get('/queue', async (req, res) => {
    try{
        const queueInfo = await Promise.all(Object.keys(queues).map(async (guildId) => {
            const guild = client.guilds.cache.get(guildId);
            const queue = queues[guildId];
            let queuery = {};
            let position = 1;
            for (let i = 0; i < queue.length; i++) {
                const url = queue[i].url;
                const title = queue[i].title;
                queuery[i === 0 ? "Playing" : "No" + position] = [title, url];
                position++;
            }
            return {
                id: guildId,
                name: guild ? guild.name : "Unknown Guild",
                loop: loopStatus[guildId],
                queue: queuery
            };
        }));
        res.send(queueInfo);
    }
    catch(err){
        console.log(err)
        res.status(500).send('Internal Server Error');
    }
});
app.get('/vc', (req, res) => {
    try{
        const serverInfo = Object.keys(voiceConnections).map(guildId => {
        const guild = client.guilds.cache.get(guildId);
            return {
                id: guildId,
                name: guild ? guild.name : "Unknown Guild"
            };
        });
    res.send(serverInfo);
    }
    catch(err){
        console.log(err)
        res.status(500).send('Internal Server Error');
    }
});

client.on('ready', () => {
    updateActivity()
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const command = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();
    const guildId = message.guild.id;
    
    if (command === 'play' || command === "p") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if(!arg){
            const playlistItems = await playlist('PL4fGSI1pDJn4-UIb6RKHdxam-oAUULIGB',YouTube_API_Key);
            const guildId = message.guild.id;
            const queue = queues[guildId] || [];
            queues[guildId] = queue;
            const fastVideo = playlistItems.videoUrls[0];
            const fastVideotitle = playlistItems.videoTitles[0];
            const queueItem = { url: fastVideo, title: fastVideotitle }
            await queue_List(queueItem, message);
            await message.channel.send("日本のトレンド曲を再生します");
            for (let i = 1; i < playlistItems.videoUrls.length; i++) {
                const url = playlistItems.videoUrls[i];
                const title = playlistItems.videoTitles[i]
                const queueItem = { url: url, title: title }
                queue.push(queueItem)
            }
            return;
        }
        if (arg.startsWith('https')) {
            if (arg.includes("youtube.com") || arg.includes("youtu.be")) {
                if (arg.includes("list=")) {
                    message.channel.send("loading...");
                    const playlistId = arg.split("list=")[1].split("&")[0];
                    const playlistItems = await playlist(playlistId,YouTube_API_Key);
                    if (playlistItems && playlistItems.videoUrls.length > 0) {
                        const videoCount = playlistItems.totalResults;
                        const fastVideo = playlistItems.videoUrls[0];
                        const fastVideotitle = playlistItems.videoTitles[0];
                        message.channel.send({ content: playlistItems.mess, components: [row] });
                        const filter = (interaction) => interaction.user.id === message.author.id;
                        message.channel.awaitMessageComponent({ filter, time: 30000 })
                        .then(async (interaction) => {
                            const guildId = message.guild.id;
                            const queue = queues[guildId] || [];
                            queues[guildId] = queue;
                            if (interaction.customId === 'confirm') {
                                const queueItem = { url: fastVideo, title: fastVideotitle }
                                await queue_List(queueItem, message);
                                await interaction.reply(`最初の曲をキューに追加しました`);
                                for (let i = 1; i < playlistItems.videoUrls.length; i++) {
                                    const url = playlistItems.videoUrls[i];
                                    const title = playlistItems.videoTitles[i]
                                    const queueItem = { url: url, title: title }
                                    queue.push(queueItem)
                                }
                                let limitedVideoCount = videoCount;
                                if (videoCount > 1000) {
                                    limitedVideoCount = 1000;
                                }
                                return message.channel.send(`${limitedVideoCount}曲をすべてキューに追加しました`);
                            }
                            if (interaction.customId === 'cancel') {
                                const queueItem = { url: fastVideo, title: fastVideotitle }
                                queue_List(queueItem, message);
                                await interaction.deferReply();
                            }
                        })
                        .catch(async() => {
                            message.channel.send("インタラクトがなかったためタイムアウトしました\n最初の曲を再生します");
                            const queueItem = { url: fastVideo, title: fastVideotitle }
                            await queue_List(queueItem, message);
                        })
                        return;
                    }
                }
                const info = await ytdl.getInfo(arg);
                const title = info.videoDetails.title;
                const queueItem = { url: arg, title: title }
                queue_List(queueItem,message)
                return;
            }
            message.channel.send("指定されたURLには対応していません")
        }
        else {
            youtubeSearch(arg, searchOptions, async (err, results) => {
                if (err) {
                    message.channel.send("内部エラーが発生しました")
                    console.log(err)
                return;
                }
    
                if (results && results.length > 0) {
                    const url = results[0].link;
                    const info = await ytdl.getInfo(url);
                    const title = info.videoDetails.title;
                    const queueItem = { url: url, title: title }
                    queue_List(queueItem,message)
                }
                else {
                    message.channel.send("動画が見つかりませんでした")
                }
            });
        }
    }

    if (command === "playsearch" || command === "ps") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if(!arg){
            return message.channel.send("キーワードが入力されていません"); 
        }
        youtubeSearch(arg, searchOptions, async (err, results) => {
            if (err) {
                message.channel.send("内部エラーが発生しました")
                console.log(err)
            return;
            }

            if (results && results.length > 0) {
                if (results.length < 50) {
                    for (let i = 0; i < results.length; i++) {
                        const url = results[i].link;
                        const info = await ytdl.getInfo(url);
                        const title = info.videoDetails.title;
                        const queueItem = { url: url, title: title };
                        queue_List(queueItem, message);
                    }
                    message.channel.send(`${results.length} 曲をキューに追加しました。`);
                } else {
                    for (let i = 0; i < 50; i++) {
                        const url = results[i].link;
                        const info = await ytdl.getInfo(url);
                        const title = info.videoDetails.title;
                        const queueItem = { url: url, title: title };
                        queue_List(queueItem, message);
                    }
                    message.channel.send("50曲をキューに追加しました。");
                }
            } else {
                message.channel.send("動画が見つかりませんでした。");
            }
        });
    }

    if (command === "queue" || command === "q") {
        const queue = queues[guildId];
        if (!queue || queue.length === 0) {
            const queueEmbed = new MessageEmbed()
                .setTitle('キュー')
                .setDescription('現在キューに曲はありません')
                .setColor('RED');
            message.channel.send({ embeds: [queueEmbed] });
        } else {
            const queueEmbed = new MessageEmbed()
                .setTitle('キュー')
                .setDescription('現在のキューには以下の曲が入っています')
                .setColor('RED');
                
            let position = 1;
            try {
                for (let i = 0; i < queue.length; i++) {
                    const title = queue[i].title;
                    const queueField = i === 0 ? { name: "再生中", value: `**${title}**` } : { name: `No.${position}`, value: `**${title}**` };
                    queueEmbed.addFields(queueField);
                    position++;
                    if ((i + 1) % 25 === 0) {
                        message.channel.send({ embeds: [queueEmbed] });
                        queueEmbed.setTitle('\u0020');
                        queueEmbed.setDescription('\u0020');
                        queueEmbed.setColor('RED');
                        queueEmbed.fields = [];
                    }
                }
            } catch (error) {
                console.log(error);
            }
            message.channel.send({ embeds: [queueEmbed] });
        }
    }

    if (command === "stop" || command === "dc") {
        const voiceGuildIds = Object.keys(voiceConnections);
        for (const voiceGuildId of voiceGuildIds) {
        if (voiceGuildId === guildId) {
            try {
            voiceConnections[guildId].disconnect();
            delete voiceConnections[guildId];
            delete queues[guildId];
            message.channel.send("再生を停止しました");
            }
            catch(err) {
            message.channel.send("現在再生中の曲はありません");
            }
        }
        }
    }

    if (command === "skip" || command === "s") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const queue = queues[guildId];
        if(loopStatus[guildId]){
            message.channel.send("リピート再生が有効状態のためスキップは利用できません");
            return;
        }
        if(!arg){
            queue.shift();
            play(message);
            return;
        }
        if (queue && queue.length > 1) {
            if(/^\d+$/.test(arg)){
                const int = parseInt(arg, 10)-1
                for (let i = 0; i < int; i++) {
                    queue.shift();
                }
                play(message);
                return;
            }
            else{
                message.channel.send("整数で入力してください")
            }
        } else {
            message.channel.send("キューに曲が追加されていません");
        }
    }

    if (command === "loop") {
        if(!loopStatus[guildId]){
            loopStatus[guildId] = true
            message.channel.send("リピート再生が有効になりました");
        }
        else{
            loopStatus[guildId] = false
            message.channel.send("リピート再生が無効になりました");
        }
    }

    if (command === "help") {
        const helpEmbed = new MessageEmbed()
            .setTitle('使い方')
            .setDescription('プレフィックスは「!」です')
            .addFields(
                { name: "コマンド", value: "説明" },
                { name: "!play, !p", value: "音楽を再生するためのコマンドです" },
                { name: "!queue, !q", value: "現在の再生待機リストを確認できます" },
                { name: "!stop, !dc", value: "現在再生中の曲を停止してVCから切断します(キューもクリアされます)" },
                { name: "!skip, !s", value: "キューが入っていた場合次の曲を再生します 再生待機リストの曲順を指定するとその曲までスキップします" },
                { name: "!loop", value: "リピート再生を有効化、無効化します デフォルト: 無効" }
            )
            .setColor('RED');
        message.channel.send({ embeds: [helpEmbed] });
    }
});

async function queue_List(queueItem, message) {
    const guildId = message.guild.id;
    const queue = queues[guildId] || [];
    queues[guildId] = queue;
    if (!isPlaying(guildId)) {
        queue.push(queueItem);
        play(message);
    } else {
        queue.push(queueItem);
        message.channel.send(`キューに追加されました\nタイトル: ${queueItem.title}`);
    }
}

function isPlaying(guildId) {
    const queue = queues[guildId];
    return queue && queue.length > 0;
}

async function play(message) {
    const guildId = message.guild.id;
    const queue = queues[guildId];
    if (!queue || queue.length === 0) {
        voiceConnections[guildId].disconnect();
        delete voiceConnections[guildId];
        delete queues[guildId];
        delete loopStatus[guildId];
        return;
    }
    try {
        voiceConnections[guildId] = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
        });  
    } catch (error) {
        message.channel.send('VCに参加してからコマンドを実行してください');
        delete queues[guildId];
        return;
    }
    if(loopStatus[guildId]){
    }
    else{
        loopStatus[guildId] = false
    }
    const queue_Now = queue.shift()
    queue.unshift(queue_Now);
    const player = createAudioPlayer();
    await voiceConnections[guildId].subscribe(player);
    const stream = ytdl(ytdl.getURLVideoID(queue_Now.url), {
        filter: format => format.audioCodec === 'opus',
        quality: 'highest',
        highWaterMark: 64 * 1024 * 1024,
    });
    const resource = createAudioResource(stream, {
        inputType: "webm/opus",
        bitrate: 64,
    });
    player.play(resource);
    player.once('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Playing) {
            try {
                const info = await ytdl.getInfo(queue_Now.url);
                const title = info.videoDetails.title;
                const duration = info.videoDetails.lengthSeconds;
                const embed = new MessageEmbed()
                    .setTitle(`:musical_note: **Playing Now : ${title}**`)
                    .setDescription(`:alarm_clock: **Duration : ${formatDuration(duration)}**`)
                    .setColor('RED');
                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.channel.send('動画データの取得に失敗しました')
            }
        }
    });
    player.on('stateChange', (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            if(loopStatus[guildId]){
                return play(message);
            }
            queue.shift()
            if (queue.length > 0) {
                play(message);
            } else {
                setTimeout(() => {
                    voiceConnections[guildId].disconnect();
                    delete voiceConnections[guildId];
                    delete queues[guildId];
                    delete loopStatus[guildId];
                }, 1000);
            }
        }
    });
}

function formatDuration(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const updateActivity = () => {
    const serverCount = client.guilds.cache.size;
    const voiceCount = Object.keys(voiceConnections).length;
    client.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`)
}
client.on('voiceStateUpdate', (oldState, newState) => {
    updateActivity()
    const voiceChannel = newState.channel;
    const guildId = newState.guild.id;

    if (voiceChannel && voiceChannel.members.length === 1 && voiceChannel.members.has(client.user.id)) {
        voiceConnections[guildId].disconnect();
        delete voiceConnections[guildId];
        delete queues[guildId];
        delete loopStatus[guildId];
    }
});
client.on('guildCreate', () => {updateActivity()});
client.on('guildDelete', () => {updateActivity()});
client.login(token);
app.listen(3010)

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});