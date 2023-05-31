const { Client, Intents, MessageEmbed } = require('discord.js');
const { joinVoiceChannel, createAudioResource, playAudioResource, AudioPlayerStatus, createAudioPlayer } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const youtubeSearch = require('youtube-search');
require('dotenv').config();

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

const token = process.env.DISCORD_TOKEN
const prefix = process.env.DISCORD_PREFIX
const YouTube_API_Key = process.env.YouTube_API_KEY

let queue = [];
let isPlaying = false;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const command = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

    if (command === 'play') {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();

        const searchOptions = {
            maxResults: 1,
            key: YouTube_API_Key,
            type: 'video'
        };

        if (arg.startsWith('https')) {
            queue_List(arg,message)
        }
        else {
            youtubeSearch(arg, searchOptions, async (err, results) => {
                if (err) {
                    message.channel.send("内部エラーが発生しました")
                return;
                }
    
                if (results && results.length > 0) {
                    const url = results[0].link;
                    queue_List(url,message)
                }
                else {
                    message.channel.send("動画が見つかりませんでした")
                }
            });
        }
    }

    if (command === "queue") {
        if (queue.length === 0) {
            const queueEmbed = new MessageEmbed()
                .setTitle('キュー')
                .setDescription('現在キューに曲はありません')
                .setColor('RED');
            message.channel.send({ embeds: [queueEmbed] });
        }
        else {
            const queueEmbed = new MessageEmbed()
                .setTitle('キュー')
                .setDescription('現在のキューには以下の曲が入っています')
                .setColor('RED');
            for (let i = 0; i < queue.length; i++) {
                const url = queue[i];
                const info = await ytdl.getInfo(url);
                const title = info.videoDetails.title;
                const position = i + 1;
                queueEmbed.addFields({ name: `No.${position}`, value: `**${title}**` });
            }
            message.channel.send({ embeds: [queueEmbed] });
        }        
    }

    if (command === "stop") {
        if (isPlaying) {
            try{
                voiceConnection.destroy();
                queue = [];
                isPlaying = false
                message.channel.send("再生を停止しました");
            }
            catch(err){
                message.channel.send("現在再生中の曲はありません");
            }
        }
    }

    if (command === "skip") {
        if (queue.length > 0) {
            play(message)
        }
        else {
            message.channel.send("キューに曲が追加されていません");
        }
    }

    if (command === "help") {
        const helpEmbed = new MessageEmbed()
            .setTitle('使い方')
            .setDescription('プレフィックスは「!」です')
            .addFields(
                { name: "コマンド", value: "説明" },
                { name: "!play", value: "音楽を再生するためのコマンドです" },
                { name: "!queue", value: "現在の再生待機リストを確認できます" }
            )
            .setColor('RED');
        message.channel.send({ embeds: [helpEmbed] });
    }
});

async function queue_List(url,message) {
    queue.push(url);
    if (isPlaying) {
        message.channel.send('キューに追加されました');
    }
    else {
        play(message);
    }
}

let voiceConnection;

async function play(message) {
    if (queue.length === 0) {
        isPlaying = false;
        return;
    }
    try {
        voiceConnection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
        });
    } catch (error) {
        message.channel.send('VCに参加してからコマンドを実行してください');
    }
    isPlaying = true;
    const queue_Now = queue.shift()
    const player = createAudioPlayer();
    voiceConnection.subscribe(player);
    const stream = ytdl(ytdl.getURLVideoID(queue_Now), {
        filter: format => format.audioCodec === 'opus' && format.container === 'webm',
        quality: 'highest',
        highWaterMark: 64 * 1024 * 1024,
    });
    const resource = createAudioResource(stream, {
        inputType: "webm/opus"
    });
    player.play(resource);
    player.once('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Playing) {
            try {
                const info = await ytdl.getInfo(queue_Now);
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
            if (queue.length > 0) {
                play(message);
            }
            else {
                setTimeout(() => {
                    voiceConnection.destroy();
                    isPlaying = false;
                }, 1000);
            }
        }
    });
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (oldState.member.id === client.user.id && oldState.channel && !newState.channel) {
            voiceConnection.disconnect();
            isPlaying = false;
            queue = [];
            message.channel.send("何か知らんけど落とされました")
        }
    });
}

function formatDuration(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

client.login(token);
