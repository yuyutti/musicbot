const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { joinVoiceChannel, createAudioResource, AudioPlayerStatus, createAudioPlayer, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { playlist, NextPlay, search } = require('./YouTubeAPI');
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

let queues = {};
let loopStatus = {};
let autoplayStatus = {};
let voiceConnections = {};

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
                autoplay: autoplayStatus[guildId],
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
            const playlistItems = await playlist('PL4fGSI1pDJn4-UIb6RKHdxam-oAUULIGB');
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
                    const playlistItems = await playlist(playlistId);
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
                                if(interaction.locale === 'ja'){
                                    await interaction.reply(`最初の曲をキューに追加しました`);
                                }
                                else{
                                    await interaction.reply(`Add first song to queue!`);
                                }
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
                                if(interaction.locale === 'ja'){
                                    return message.channel.send(`${limitedVideoCount}曲をすべてキューに追加しました`);
                                }
                                else{
                                    return message.channel.send(`All ${limitedVideoCount} songs have been added to the queue!`);
                                }
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
            const SearchResults = await search(arg,1)
            if(SearchResults.videoTitles.length > 0){
                const selectedSong = {
                    title: SearchResults.videoTitles[0],
                    url: SearchResults.videoUrls[0]
                };
                const queueItem = { url: selectedSong.url, title: selectedSong.title }
                queue_List(queueItem,message)
            }
            else{
                message.channel.send("動画が見つかりませんでした")
            }
        }
    }

    if (command === "playsearch" || command === "ps") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const commandAuthor = message.author;
        if(!arg){
            return message.channel.send("キーワードが入力されていません"); 
        }
        const SearchResults = await search(arg,10)
        if(SearchResults){
            const queueEmbed = new MessageEmbed()
            .setTitle('検索結果')
            .setDescription('追加したい曲番号を送信してください')
            .setColor('RED');
            try {
                for (let i = 0; i < SearchResults.videoTitles.length; i++) {
                    const title = SearchResults.videoTitles[i];
                    const embed = { name: `No.${i + 1}`, value: `**${title}**` }
                    queueEmbed.addFields(embed)
                }
            } catch (error) {
                console.log(error);
            }
            await message.channel.send({ embeds: [queueEmbed] });
            const filter = (msg) => {
                return !msg.author.bot && msg.author.id === commandAuthor.id;
            };
            const collector = message.channel.createMessageCollector({ filter, time: 30000 });
        
            collector.on('collect', (msg) => {
                const input = msg.content.trim();
                const songIndex = parseInt(input, 10);
                const queue = queues[guildId] || [];
                queues[guildId] = queue;
                if (input.toLowerCase() === 'all') {
                    for (let i = 0; i < SearchResults.videoTitles.length; i++) {
                        if(i === 0){
                            const selectedSong = {
                                title: SearchResults.videoTitles[i],
                                url: SearchResults.videoUrls[i]
                            };
                            const queueItem = { url: selectedSong.url, title: selectedSong.title }
                            queue_List(queueItem,message)
                        }
                        const selectedSong = {
                            title: SearchResults.videoTitles[i],
                            url: SearchResults.videoUrls[i]
                        };
                        const queueItem = { url: selectedSong.url, title: selectedSong.title }
                        queue.push(queueItem)
                    }
                    msg.channel.send('全ての曲をキューに追加しました。');
                    return collector.stop();
                }

                if (!isNaN(songIndex) && songIndex >= 1 && songIndex <= SearchResults.videoTitles.length) {
                    const selectedSong = {
                    title: SearchResults.videoTitles[songIndex - 1],
                    url: SearchResults.videoUrls[songIndex - 1]
                    };

                    const queueItem = { url: selectedSong.url, title: selectedSong.title }
                    queue_List(queueItem,message)
                    collector.stop();
                } else {
                    msg.channel.send('正しい曲番号を送信してください');
                }
            });
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    message.channel.send('入力がタイムアウトしました');
                }
            });
        }
        else{
            return message.channel.send("一致する動画が見つかりませんでした")
        }
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
                    disconnect(guildId)
                    return message.channel.send("再生を停止しました");
                }
                catch(err) {
                    return message.channel.send("現在再生中の曲はありません");
                }
            }
        }
        return message.channel.send("現在再生中ではありません");
    }

    if (command === "skip" || command === "s") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const queue = queues[guildId];
        if(loopStatus[guildId]){
            message.channel.send("リピート再生が有効状態のためスキップは利用できません");
            return;
        }
        if(autoplayStatus[guildId]){
            const queue = queues[guildId];
            const VideoURL = queue[0].url
            const NextPlayVideoItem = await NextPlay(VideoURL)
            if(!NextPlayVideoItem){
                return message.channel.send("**高確率で発生するエラーを引き当てました!**\n再度スキップコマンドを使用してください!\n何回か連続でエラー出るかもしれないです!")
            }
            const queueItem = { url: NextPlayVideoItem.videoUrl, title: NextPlayVideoItem.title }
            queue.push(queueItem);
            queue.shift();
            return await play(message);
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
        if(!voiceConnections[guildId]){
            return message.channel.send("VCに参加してからコマンドを実行してください");
        }
        if(!loopStatus[guildId]){
            loopStatus[guildId] = true
            message.channel.send("リピート再生が有効になりました");
        }
        else{
            loopStatus[guildId] = false
            message.channel.send("リピート再生が無効になりました");
        }
    }

    if (command === "autoplay" | command === "auto" | command === "ap") {
        if(!voiceConnections[guildId]){
            return message.channel.send("VCに参加してからコマンドを実行してください");
        }
        if(!autoplayStatus[guildId]){
            autoplayStatus[guildId] = true
            message.channel.send("自動再生が有効になりました");
        }
        else{
            autoplayStatus[guildId] = false
            message.channel.send("自動再生が無効になりました");
        }
    }

    if (command === "help") {
        const helpEmbed = new MessageEmbed()
            .setTitle('使い方')
            .setDescription(`コマンドプレフィックスは「${prefix}」です`)
            .addFields(
                { name: `コマンド`, value: `説明` },
                { name: `${prefix}play, ${prefix}p`, value: `音楽を再生するためのコマンドです\nコマンド単体で実行すると日本のトレンド曲を自動再生します` },
                { name: `${prefix}playsearch, ${prefix}ps`, value: `音楽を再生するためのコマンドです、検索上位10を表示します` },
                { name: `${prefix}play, ${prefix}playsearchコマンドの使用例`, value: `${prefix}play <URL or キーワード>\n${prefix}playsearch <キーワード>` },
                { name: `${prefix}queue, ${prefix}q`, value: `現在の再生待機リストを確認できます` },
                { name: `${prefix}stop, ${prefix}dc`, value: `現在再生中の曲を停止してVCから切断します(キューもクリアされます)` },
                { name: `${prefix}skip, ${prefix}s`, value: `キューが入っていた場合次の曲を再生します\n再生待機リストの曲順を指定するとその曲までスキップします` },
                { name: `${prefix}skipコマンドの使用例`, value: `次の曲にスキップしたい場合 例: ${prefix}skip\n15曲目の曲にスキップしたい場合 例: ${prefix}skip 15` },
                { name: `${prefix}loop`, value: `リピート再生を有効化、無効化します デフォルト: 無効` },
                { name: `${prefix}autoplay, ${prefix}auto, ${prefix}ap`, value: `自動再生を有効化、無効化します デフォルト: 無効` },
                { name: `短縮コマンドに関して`, value: `短縮コマンドが設定されているコマンドは、短縮コマンドでも同様の動作を行うため使用して頂いて問題ありません` },
            )
            .setColor('RED');
        message.channel.send({ embeds: [helpEmbed] });
    }
});

async function queue_List(queueItem, message) {
    const guildId = message.guild.id;
    const queue = queues[guildId] || [];
    queues[guildId] = queue;
    if (queue.length === 0) {
        queue.push(queueItem);
        play(message);
    } else {
        queue.push(queueItem);
        message.channel.send(`キューに追加されました\nタイトル: ${queueItem.title}`);
    }
}
async function play(message) {
    const guildId = message.guild.id;
    const queue = queues[guildId];
    if (!queue || queue.length === 0) {
        return disconnect(guildId);
    }
    try {
        voiceConnections[guildId] = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });
    } catch (error) {
        message.channel.send('VCに参加してからコマンドを実行してください');
        delete queues[guildId];
        return;
    }
    loopStatus[guildId] = loopStatus[guildId] ? loopStatus[guildId] : false;
    autoplayStatus[guildId] = autoplayStatus[guildId] ? autoplayStatus[guildId] : false;
    const queue_Now = queue.shift()
    queue.unshift(queue_Now);
    const player = createAudioPlayer();
    await voiceConnections[guildId].subscribe(player);
    const stream = ytdl(ytdl.getURLVideoID(queue_Now.url), {
        filter: format => format.audioCodec === 'opus',
        quality: 'highestaudio',
        highWaterMark: 64 * 1024 * 1024,
    });
    const resource = createAudioResource(stream, {
        inputType: "webm/opus",
        bitrate: 64,
        inlineVolume: true
    });
    resource.volume.setVolume(0.05);
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
    player.on('stateChange', async(oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            if(loopStatus[guildId]){
                return play(message);
            }
            if (queue.length === 1){
                if(autoplayStatus[guildId]){
                    async function processQueue(message, guildId) {
                        const queue = queues[guildId];
                        const VideoURL = queue[0].url
                        const NextPlayVideoItem = await NextPlay(VideoURL)
                        if (!NextPlayVideoItem) {
                            message.channel.send("ちょっとしたエラーが発生したため次の曲の再生までに少し時間がかかる場合があります\n(このメッセージが何度も表示される場合その回数分ちょっとしたエラーが起きてるため不具合ではありません)")
                            return await processQueue(message, guildId);
                        }
                        const queueItem = { url: NextPlayVideoItem.videoUrl, title: NextPlayVideoItem.title }
                        queue.push(queueItem);
                        queue.shift();
                        return await play(message);
                    }
                    processQueue(message, guildId)
                }
            }
            queue.shift()
            if (queue.length > 0) {
                play(message);
            } else {
                setTimeout(() => {
                    disconnect(guildId)
                }, 1000);
            }
        }
    });
    const connection = getVoiceConnection(guildId);
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        disconnect(guildId)
        connection.destroy();
    });
}

function formatDuration(duration) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
function disconnect(guildId) {
    voiceConnections[guildId].disconnect();
    delete voiceConnections[guildId];
    delete queues[guildId];
    delete loopStatus[guildId];
    delete autoplayStatus[guildId];
}

const updateActivity = () => {
    const serverCount = client.guilds.cache.size;
    const voiceCount = Object.keys(voiceConnections).length;
    client.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`)
}
client.on('voiceStateUpdate', (oldState, newState) => {
    updateActivity()
    const botId = client.user.id;
    const oldVoiceChannel = oldState.channel;
    const newVoiceChannel = newState.channel;
    
    if (oldVoiceChannel && oldVoiceChannel.members.has(botId) && !newVoiceChannel) {
        const guildId = newState.guild.id;
        const memberCount = oldVoiceChannel ? oldVoiceChannel.members.size : 0;
        if(memberCount === 1){
            voiceConnections[guildId].disconnect();
            delete voiceConnections[guildId];
            delete queues[guildId];
            delete loopStatus[guildId];
            delete autoplayStatus[guildId];
        }
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