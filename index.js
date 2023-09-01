// やることリスト
// ・隠しコマンドでpsの件数を指定できるようにする
// ・/@channel/videosで全ての動画を読み込む
// ・初期の段階で動画の時間を取得する
// ・!queueですべて再生するの必要な時間を表示する

// 早急にやるべきことリスト
// ・とりあえず週のデータだけグラフで見れるけど週が変わるとみずらくなる and 月、年が未完成

const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton, InteractionCollector } = require('discord.js');
const { joinVoiceChannel, createAudioResource, AudioPlayerStatus, createAudioPlayer, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { playlist, NextPlay, search, getInfo, Spotify_playlist_search } = require('./src/api/YouTubeAPI');
const { Spotify_search, Spotify_Playlist } = require('./src/api/SpotifyAPI');
const { notice_command, notice_playing, join_left, notice_vc, error_log, express_error, discordapi_error } = require('./src/package/notification');
const resxData = require('./src/package/resx-parse');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const cron = require('node-cron');
const express = require('express')
const app = express()
app.use(express.static('public'));
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

const previousButton = new MessageButton()
    .setCustomId('previous')
    .setStyle('PRIMARY')
    .setLabel('Previous');

const nextButton = new MessageButton()
    .setCustomId('next')
    .setStyle('PRIMARY')
    .setLabel('Next');

const row = new MessageActionRow().addComponents(confirmButton, cancelButton);
const buttonRow = new MessageActionRow().addComponents(previousButton, nextButton);

const token = process.env.DISCORD_TOKEN
const prefix = process.env.DISCORD_PREFIX

const Language_data = path.join(__dirname, '/data/guildLanguage.json');
const use_data = path.join(__dirname, '/data/use.json');

const adminId = process.env.admin_id.split(",");

let command_channel, playing_channel, vc_channel, join_left_channel, error_channel, express_error_channel, discordapi_error_channel;

let queues = {};
let loopStatus = {};
let autoplayStatus = {};
let voiceConnections = {};

let useData = {};

app.get('/lang', async (req, res) => {
    const existingLocales = await guildLanguage();
    let lang = {}
    let position = 1;
    for (const guildId in existingLocales) {
        const Language = existingLocales[guildId];
        const guild = client.guilds.cache.get(guildId);
        const guildName = guild ? guild.name : "unknown guild"
        lang[position] = { ServerName: guildName, Language: Language }
        position++
    }
    res.send(lang)
})

app.get('/langfile', async (req, res) => {
    res.send(resxData)
})

app.get('/server', async (req, res) => {
    try {
        const guilds = client.guilds.cache;
        let servers = {}
        let position = 1;
        guilds.forEach(guild => {
            servers[position] = { ServerName: guild.name, Language: guild.preferredLocale, memberCount: guild.memberCount, guildId: guild.id }
            position++;
        });
        res.send(servers)
    }
    catch (err) {
        console.log(err)
        express_error(err, express_error_channel)
        res.status(500).send('Internal Server Error');
    }
})

app.get('/queue', async (req, res) => {
    try {
        const queueInfo = await Promise.all(Object.keys(queues).map(async (guildId) => {
            const guild = client.guilds.cache.get(guildId)
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
    catch (err) {
        console.log(err)
        express_error(err, express_error_channel)
        res.status(500).send('Internal Server Error');
    }
});
app.get('/vc', (req, res) => {
    try {
        const serverInfo = Object.keys(voiceConnections).map(guildId => {
            const guild = client.guilds.cache.get(guildId);
            const botUser = guild.members.cache.get(client.user.id);
            const vcMembers = botUser.voice.channel.members.size;
            return {
                name: guild ? guild.name : "Unknown Guild",
                id: guildId,
                vcMembers: vcMembers
            };
        });
        res.send(serverInfo);
    }
    catch (err) {
        console.log(err)
        express_error(err, express_error_channel)
        res.status(500).send('Internal Server Error');
    }
});

app.get('/data', (req, res) => {
    try {
        const data = fs.readFileSync(use_data, 'utf8');
        const parsedData = JSON.parse(data);
        res.json(parsedData);
    } catch (err) {
        console.log(err)
        express_error(err, express_error_channel)
        res.status(500).send('Internal Server Error');
    }
});

client.on('ready', async () => {
    updateActivity()
    console.log(`Logged in as ${client.user.tag}`);
    const existingLocales = await guildLanguage();
    let serverLocales = {};
    const guilds = client.guilds.cache;
    guilds.forEach(guild => {
        if (existingLocales[guild.id]) {
            const savedLang = existingLocales[guild.id]
            if (savedLang === guild.preferredLocale) {
                serverLocales[guild.id] = guild.preferredLocale;
            }
            else {
                serverLocales[guild.id] = savedLang
            }
        }
        else {
            serverLocales[guild.id] = guild.preferredLocale;
        }
    });

    fs.writeFile(Language_data, JSON.stringify(serverLocales, null, 2), (err) => {
        if (err) {
            error_log(err, error_channel)
        }
    });

    const data = fs.readFileSync(use_data, 'utf8');
    useData = JSON.parse(data);

    useDataSetup()

    if (process.env.enable_logging === 'true') {
        const management_guildId = client.guilds.cache.get(process.env.management_guildId.toString());
        if (!management_guildId) {
            console.log('Management Server not found')
            return;
        }
        command_channel = management_guildId.channels.cache.get(process.env.command_channel.toString());
        playing_channel = management_guildId.channels.cache.get(process.env.playing_channel.toString());
        vc_channel = management_guildId.channels.cache.get(process.env.vc_channel.toString());
        join_left_channel = management_guildId.channels.cache.get(process.env.join_left_channel.toString());
        error_channel = management_guildId.channels.cache.get(process.env.error_channel.toString());
        express_error_channel = management_guildId.channels.cache.get(process.env.express_error_channel.toString());
        discordapi_error_channel = management_guildId.channels.cache.get(process.env.discordapi_error_channel.toString());
        youtube_error_channel = management_guildId.channels.cache.get(process.env.youtube_error_channel.toString());
        if (!command_channel){
            console.log('command_channel is defined wrong in .env file')
            command_channel = null;
        }
        if (!playing_channel){
            console.log('playing_channel is defined wrong in .env file')
            playing_channel = null;
        }
        if (!vc_channel){
            console.log('vc_channel is defined wrong in .env file')
            vc_channel = null;
        }
        if (!join_left_channel){
            console.log('join_left_channel is defined wrong in .env file')
            join_left_channel = null;
        }
        if (!error_channel){
            console.log('error_channel is defined wrong in .env file')
            error_channel = null;
        }
        if (!express_error_channel){
            console.log('express_error_channel is defined wrong in .env file')
            express_error_channel = null;
        }
        if (!discordapi_error_channel){
            console.log('discordapi_error_channel is defined wrong in .env file')
            discordapi_error_channel = null;
        }
        if (!youtube_error_channel){
            console.log('youtube_error_channel is defined wrong in .env file')
            youtube_error_channel = null;
        }
    }
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const command = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();
    const guildId = message.guild.id;
    const guildName = message.guild.name;
    notice_command(guildId, message, prefix, command, command_channel)

    const now = new Date();
    const yearWeek = await getYearWeek(now);
    
    if (!useData[guildId]) {
        useData[guildId] = { name: guildName, data: {} };
    }

    if (!useData[guildId].data[yearWeek]) {
        useData[guildId].data[yearWeek] = 0;
    }

    useData[guildId].data[yearWeek]++;
    await saveData(useData);

    const gildLang = await guildLanguage()
    let lang = gildLang[guildId]
    if (!(lang in resxData)) {
        lang = 'en-US';
    }

    if (command === "guildlang") {
        if (!adminId.includes(message.author.id)) { return console.log("command is access deny") }
        const japaneseRegex = /[\u3040-\u30FF\uFF00-\uFFEF\u4E00-\u9FFF]/;
        const existingLocales = await guildLanguage();
        let serverLocales = {};
        for (const guildId in existingLocales) {
            const guild = client.guilds.cache.get(guildId);
            if (japaneseRegex.test(guild.name)) {
                serverLocales[guild.id] = "ja";
            }
            else {
                serverLocales[guild.id] = "en-US";
            }
        }
        fs.writeFile(Language_data, JSON.stringify(serverLocales, null, 2), (err) => {
            if (err) {
                return error_log(err, error_channel)
            }
        });
    }

    if (command === "kick") {
        if (!adminId.includes(message.author.id)) { return console.log("command is access deny") }
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if (!arg) { return console.log("arg is not found") }
        return disconnect(arg)
    }

    if (command === "adminlang") {
        if (!adminId.includes(message.author.id)) { return console.log("command is access deny") }
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
            const args = arg.split(/ +/);
            const arg1 = args[0];
            const arg2 = args[1];
            await setLanguage(message, arg1, arg2)
    }

    if (command === "save") {
        if (!adminId.includes(message.author.id)) { return console.log("command is access deny") }
        await saveData(useData);
        message.channel.send("データを保存しました")
    }

    if (command === "lang") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if (!arg) {
            await message.channel.send(`${resxData[lang].root.lang[0].data[0].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[1].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[2].value}`);
        }
        if (arg === "ja") {
            await setLanguage(message, guildId, "ja")
        }
        if (arg === "en") {
            await setLanguage(message, guildId, "en-US")
        }
        if (!arg === "ja" || !arg === "en") {
            await message.channel.send(`${resxData[lang].root.lang[0].data[0].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[1].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[2].value}`);
        }
    }

    if (command === 'play' || command === "p") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if (!arg) {
            const playlistItems = await playlist('PL4fGSI1pDJn4-UIb6RKHdxam-oAUULIGB', youtube_error_channel);
            const guildId = message.guild.id;
            const queue = queues[guildId] || [];
            queues[guildId] = queue;
            const fastVideo = playlistItems.videoUrls[0];
            const fastVideotitle = playlistItems.videoTitles[0];
            const queueItem = { url: fastVideo, title: fastVideotitle }
            await queue_List(queueItem, message);
            await message.channel.send(`${resxData[lang].root.play[0].data[0].value}`);
            for (let i = 1; i < playlistItems.videoUrls.length; i++) {
                const url = playlistItems.videoUrls[i];
                const title = playlistItems.videoTitles[i]
                const queueItem = { url: url, title: title }
                queue.push(queueItem)
            }
            return;
        }
        if(arg === "こえくん&むいくん はなたば"){
            if (!adminId.includes(message.author.id)) { return console.log("command is access deny") }
            const music_file = './src/sound/coe.xhotoke_hanataba.wav';
            const source = 'https://www.youtube.com/watch?v=mZGt9tl8DKg'
            const queueItem = { url: music_file, title: "こえくん&むいくん ハナタバ", source: source }
            return queue_List(queueItem, message)
        }
        if (arg.startsWith('https')) {
            if (arg.includes("youtube.com") || arg.includes("youtu.be")) {
                if (arg.includes("list=")) {
                    message.channel.send("loading...");
                    const playlistId = arg.split("list=")[1].split("&")[0];
                    const playlistItems = await playlist(playlistId, youtube_error_channel);
                    if (playlistItems && playlistItems.videoUrls.length > 0) {
                        const videoCount = playlistItems.totalResults;
                        const fastVideo = playlistItems.videoUrls[0];
                        const fastVideotitle = playlistItems.videoTitles[0];
                        const resxdata = resxData[lang].root.youtubeapi[0]
                        let mess
                        if (playlistItems.mix === "true") {
                            mess = `${resxdata.data[0].value}${videoCount}${resxdata.data[1].value}\n${resxdata.data[2].value}\n${resxdata.data[3].value}\n${resxdata.data[4].value}${fastVideotitle}\n${resxdata.data[5].value}`
                        }
                        else {
                            mess = `${resxdata.data[6].value}${videoCount}${resxdata.data[7].value}\n${resxdata.data[8].value}${fastVideotitle}\n${resxdata.data[9].value}`
                        }

                        message.channel.send({ content: mess, components: [row] });
                        const filter = (interaction) => interaction.user.id === message.author.id;
                        message.channel.awaitMessageComponent({ filter, time: 30000 })
                            .then(async (interaction) => {
                                const guildId = message.guild.id;
                                const queue = queues[guildId] || [];
                                queues[guildId] = queue;
                                if (interaction.customId === 'confirm') {
                                    const queueItem = { url: fastVideo, title: fastVideotitle }
                                    await queue_List(queueItem, message);
                                    await interaction.reply(`${resxData[lang].root.play[0].data[1].value}`);
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
                                    message.channel.send(`${resxData[lang].root.play[0].data[2].value} ${limitedVideoCount} ${resxData[lang].root.play[0].data[3].value}`);
                                }
                                if (interaction.customId === 'cancel') {
                                    const queueItem = { url: fastVideo, title: fastVideotitle }
                                    queue_List(queueItem, message);
                                    await interaction.reply(`${resxData[lang].root.play[0].data[7].value}`);
                                }
                            })
                            .catch(async () => {
                                message.channel.send(`${resxData[lang].root.play[0].data[4].value}`);
                                const queueItem = { url: fastVideo, title: fastVideotitle }
                                await queue_List(queueItem, message);
                            })
                        return;
                    }
                }
                const info = await getInfo(arg);
                const title = info.title;
                const queueItem = { url: arg, title: title }
                queue_List(queueItem, message)
                return;
            }
            if(arg.includes("spotify.com")){
                if(arg.includes("playlist")){
                    message.channel.send("loading...");
                    const playlistId = arg.match(/playlist\/(\w+)/)[1];
                    const playlistItems = await Spotify_Playlist(playlistId)
                    const guildId = message.guild.id;
                    const queue = queues[guildId] || [];
                    queues[guildId] = queue;
                    let i = 0
                    const resxdata = resxData[lang].root.youtubeapi[0]
                    for (const trackTitle of playlistItems.name) {
                        searchResult = await Spotify_playlist_search(trackTitle, youtube_error_channel);
                        if(!searchResult) searchResult = await Spotify_playlist_search(trackTitle, youtube_error_channel);
                        if(!searchResult) {
                            message.channel.send(`${resxdata.data[12].value} ${trackTitle} ${resxdata.data[11].value}`)
                            continue;
                        }
                        const queueItem = { url: searchResult.url, title: searchResult.title, sp_url: playlistItems.urls[i] };
                        if (i === 0) {
                            queue_List(queueItem, message);
                        } else {
                            queue.push(queueItem);
                        }
                        i++
                    }
                    message.channel.send(`${resxData[lang].root.playsearch[0].data[3].value}`)
                }
                return;
            }
            message.channel.send(`${resxData[lang].root.play[0].data[5].value}`)
        }
        else {
            const search_result = await Spotify_search(arg)
            const SearchResults = await search(arg, 1, youtube_error_channel)
            if (SearchResults.videoTitles.length > 0) {
                const selectedSong = {
                    title: search_result.name,
                    url: SearchResults.videoUrls[0],
                    sp_url: search_result.url
                };
                const queueItem = { url: selectedSong.url, title: selectedSong.title, sp_url: selectedSong.sp_url }
                queue_List(queueItem, message)
            }
            else {
                message.channel.send(`${resxData[lang].root.play[0].data[6].value}`)
            }
        }
    }

    if (command === "playsearch" || command === "ps") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const commandAuthor = message.author;
        if (!arg) {
            return message.channel.send(`${resxData[lang].root.playsearch[0].data[0].value}`);
        }
        const SearchResults = await search(arg, 10, youtube_error_channel)
        if (SearchResults) {
            const queueEmbed = new MessageEmbed()
                .setTitle(`${resxData[lang].root.playsearch[0].data[1].value}`)
                .setDescription(`${resxData[lang].root.playsearch[0].data[2].value}`)
                .setColor('RED');
            try {
                for (let i = 0; i < SearchResults.videoTitles.length; i++) {
                    const title = SearchResults.videoTitles[i];
                    const embed = { name: `No.${i + 1}`, value: `**${title}**` }
                    queueEmbed.addFields(embed)
                }
            } catch (error) {
                console.log(error);
                discordapi_error(error, discordapi_error_channel)
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
                        if (i === 0) {
                            const selectedSong = {
                                title: SearchResults.videoTitles[i],
                                url: SearchResults.videoUrls[i]
                            };
                            const queueItem = { url: selectedSong.url, title: selectedSong.title }
                            queue_List(queueItem, message)
                        }
                        const selectedSong = {
                            title: SearchResults.videoTitles[i],
                            url: SearchResults.videoUrls[i]
                        };
                        const queueItem = { url: selectedSong.url, title: selectedSong.title }
                        queue.push(queueItem)
                    }
                    msg.channel.send(`${resxData[lang].root.playsearch[0].data[3].value}`);
                    return collector.stop();
                }

                if (!isNaN(songIndex) && songIndex >= 1 && songIndex <= SearchResults.videoTitles.length) {
                    const selectedSong = {
                        title: SearchResults.videoTitles[songIndex - 1],
                        url: SearchResults.videoUrls[songIndex - 1]
                    };

                    const queueItem = { url: selectedSong.url, title: selectedSong.title }
                    queue_List(queueItem, message)
                    collector.stop();
                } else {
                    msg.channel.send(`${resxData[lang].root.playsearch[0].data[4].value}`);
                }
            });
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    message.channel.send(`${resxData[lang].root.playsearch[0].data[5].value}`);
                }
            });
        }
        else {
            return message.channel.send(`${resxData[lang].root.playsearch[0].data[6].value}`)
        }
    }

    if (command === "queue" || command === "q") {
        const queue = queues[guildId];
        if (!queue || queue.length === 0) {
            const queueEmbed = new MessageEmbed()
                .setTitle(`${resxData[lang].root.queue[0].data[0].value}`)
                .setDescription(`${resxData[lang].root.queue[0].data[1].value}`)
                .setColor('RED');
            message.channel.send({ embeds: [queueEmbed] });
        } else {
            const queuePages = paginateQueue(queue);
            let currentPage = 0;

            const generateQueueEmbed = () => {
                const queueEmbed = new MessageEmbed()
                    .setTitle(`${resxData[lang].root.queue[0].data[0].value}`)
                    .setDescription(`${resxData[lang].root.queue[0].data[2].value}`)
                    .setColor('RED');

                const currentQueuePage = queuePages[currentPage];
                let position = currentPage * 10 + 1;
                for (const song of currentQueuePage) {
                    const title = song.title;
                    const isFirstPageFirstItem = currentPage === 0 && position === currentPage * 10 + 1;
                    const queueField = isFirstPageFirstItem
                        ? { name: `${resxData[lang].root.queue[0].data[3].value}`, value: `**${title}**` }
                        : { name: `No.${position}`, value: `**${title}**` };

                    queueEmbed.addFields(queueField);
                    position++;
                }
                return queueEmbed;
            };
            previousButton.setDisabled(false)
            nextButton.setDisabled(false)
            const msg = await message.channel.send({ embeds: [generateQueueEmbed()], components: [buttonRow] });
            const collector = new InteractionCollector(client, { message: msg, time: 60000 });

            collector.on('collect', async (interaction) => {
                if (interaction.isButton()) {
                    if (interaction.customId === 'previous') {
                        if (currentPage > 0) {
                            currentPage--;
                        }
                    }
                    if (interaction.customId === 'next') {
                        if (currentPage < queuePages.length - 1) {
                            currentPage++;
                        }
                    }
                    await interaction.update({ embeds: [generateQueueEmbed()], components: [buttonRow] });
                }
            });
            collector.on('end', () => {
                buttonRow.components.forEach(component => component.setDisabled(true));
                msg.edit({ components: [buttonRow] });
            });
        }
    }

    if (command === "stop" || command === "dc") {
        const voiceGuildIds = Object.keys(voiceConnections);
        for (const voiceGuildId of voiceGuildIds) {
            if (voiceGuildId === guildId) {
                try {
                    disconnect(guildId)
                    return message.channel.send(`${resxData[lang].root.stop[0].data[0].value}`);
                }
                catch (err) {
                    return message.channel.send(`${resxData[lang].root.stop[0].data[1].value}`);
                }
            }
        }
        return message.channel.send(`${resxData[lang].root.stop[0].data[2].value}`);
    }

    if (command === "skip" || command === "s") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const queue = queues[guildId];
        if (loopStatus[guildId]) {
            return message.channel.send(`${resxData[lang].root.skip[0].data[0].value}`);
        }
        if (autoplayStatus[guildId]) {
            const queueItem = await processQueue(message, guildId)
            if (!queueItem) {
                await message.channel.send(`${resxData[lang].root.skip[0].data[1].value}`)
                await disconnect(guildId)
            }
            queue.push(queueItem);
            queue.shift();
            return await play(message);
        }
        if (arg) {
            if (/^\d+$/.test(arg)) {
                const int = parseInt(arg, 10) - 1
                if (int < 2) { return message.channel.send(`${resxData[lang].root.skip[0].data[6].value}`) }
                if (int > queue.length) {
                    let en_num = resxData[lang].root.skip[0].data[3].value
                    if (lang === "en-US") {
                        if (int + 1 === 3) { en_num = resxData[lang].root.skip[0].data[8].value }
                    }
                    return message.channel.send(`${resxData[lang].root.skip[0].data[2].value}${int + 1}${en_num}`)
                }
                for (let i = 0; i < int; i++) {
                    queue.shift();
                }
                if (!queue[0].url.includes('http://') && !queue[0].url.includes('https://')){
                    return await localPlay(message);
                }
                return play(message);
            }
            else {
                return message.channel.send(`${resxData[lang].root.skip[0].data[4].value}`)
            }
        }
        if (queue && queue.length > 1) {
            queue.shift();
            if (!queue[0].url.includes('http://') && !queue[0].url.includes('https://')){
                return await localPlay(message);
            }
            return play(message);
        }
        else {
            return message.channel.send(`${resxData[lang].root.skip[0].data[5].value}`);
        }
    }

    if (command === "remove") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const queue = queues[guildId];
        if (/^\d+$/.test(arg)) {
            const int = parseInt(arg, 10) - 1
            if (int >= 1 && int < queue.length) {
                queue.splice(int, 1);
                return message.channel.send(`${int + 1}${resxData[lang].root.remove[0].data[0].value}`);
            }
            else {
                return message.channel.send(`${resxData[lang].root.remove[0].data[1].value}`);
            }
        }
    }

    if (command === "loop") {
        if (!voiceConnections[guildId]) {
            return message.channel.send(`${resxData[lang].root.loop[0].data[0].value}`);
        }
        if (!loopStatus[guildId]) {
            loopStatus[guildId] = true
            message.channel.send(`${resxData[lang].root.loop[0].data[1].value}`);
        }
        else {
            loopStatus[guildId] = false
            message.channel.send(`${resxData[lang].root.loop[0].data[2].value}`);
        }
    }

    if (command === "autoplay" | command === "auto" | command === "ap") {
        if (!voiceConnections[guildId]) {
            return message.channel.send(`${resxData[lang].root.autoplay[0].data[0].value}`);
        }
        if (!autoplayStatus[guildId]) {
            autoplayStatus[guildId] = true
            message.channel.send(`${resxData[lang].root.autoplay[0].data[1].value}`);
        }
        else {
            autoplayStatus[guildId] = false
            message.channel.send(`${resxData[lang].root.autoplay[0].data[2].value}`);
        }
    }

    if (command === "help") {
        const helpEmbed = new MessageEmbed()
            .setTitle(`${resxData[lang].root.help[0].data[0].value}`)
            .setDescription(`${resxData[lang].root.help[0].data[1].value}${prefix}${resxData[lang].root.help[0].data[2].value}`)
            .addFields(
                { name: `${resxData[lang].root.help[0].data[3].value}`, value: `${resxData[lang].root.help[0].data[4].value}` },
                { name: `${prefix}play, ${prefix}p`, value: `${resxData[lang].root.help[0].data[5].value}\n${resxData[lang].root.help[0].data[6].value}` },
                { name: `${prefix}playsearch, ${prefix}ps`, value: `${resxData[lang].root.help[0].data[7].value}` },
                { name: `${prefix}play, ${prefix}playsearch${resxData[lang].root.help[0].data[8].value}`, value: `${prefix}play <URL or ${resxData[lang].root.help[0].data[9].value}>\n${prefix}playsearch <${resxData[lang].root.help[0].data[9].value}>` },
                { name: `${prefix}queue, ${prefix}q`, value: `${resxData[lang].root.help[0].data[10].value}` },
                { name: `${prefix}stop, ${prefix}dc`, value: `${resxData[lang].root.help[0].data[11].value}` },
                { name: `${prefix}skip, ${prefix}s`, value: `${resxData[lang].root.help[0].data[12].value}\n${resxData[lang].root.help[0].data[13].value}` },
                { name: `${prefix}skip${resxData[lang].root.help[0].data[8].value}`, value: `${resxData[lang].root.help[0].data[14].value} ${prefix}skip\n${resxData[lang].root.help[0].data[15].value} ${prefix}skip 15` },
                { name: `${prefix}loop`, value: `${resxData[lang].root.help[0].data[16].value}` },
                { name: `${prefix}autoplay, ${prefix}auto, ${prefix}ap`, value: `${resxData[lang].root.help[0].data[17].value}` },
                { name: `${prefix}lang`, value: `${resxData[lang].root.help[0].data[18].value}` },
                { name: `${resxData[lang].root.help[0].data[19].value}`, value: `${resxData[lang].root.help[0].data[20].value}` },
            )
            .setColor('RED');
        message.channel.send({ embeds: [helpEmbed] });
    }
});

async function queue_List(queueItem, message) {
    const guildId = message.guild.id;
    const queue = queues[guildId] || [];
    queues[guildId] = queue;
    const gildLang = await guildLanguage()
    let lang = gildLang[guildId]
    if (!(lang in resxData)) {
        lang = 'en-US';
    }

    if (!queueItem.url.includes('http://') && !queueItem.url.includes('https://')){
        if (queue.length === 0) {
            queue.push(queueItem);
            return localPlay(message);
        } else {
            queue.push(queueItem);
            return message.channel.send(`${resxData[lang].root.queue_list[0].data[0].value}\n${resxData[lang].root.queue_list[0].data[1].value}${queueItem.title}`);
        }
    }
    if (queue.length === 0) {
        queue.push(queueItem);
        play(message);
    } else {
        queue.push(queueItem);
        message.channel.send(`${resxData[lang].root.queue_list[0].data[0].value}\n${resxData[lang].root.queue_list[0].data[1].value}${queueItem.title}`);
    }
}
async function play(message) {
    const guildId = message.guild.id;
    const queue = queues[guildId];
    const gildLang = await guildLanguage()
    let lang = gildLang[guildId]
    if (!(lang in resxData)) {
        lang = 'en-US';
    }
    if (!queue || queue.length === 0) {
        return disconnect(guildId);
    }
    if (!message.member.voice.channel) {
        message.channel.send(`${resxData[lang].root.play_[0].data[0].value}`);
        return delete queues[guildId];
    }
    voiceConnections[guildId] = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
    });
    loopStatus[guildId] = loopStatus[guildId] ? loopStatus[guildId] : false;
    autoplayStatus[guildId] = autoplayStatus[guildId] ? autoplayStatus[guildId] : false;
    const connection = getVoiceConnection(guildId);
    connection.removeAllListeners(VoiceConnectionStatus.Ready);
    connection.removeAllListeners(VoiceConnectionStatus.Disconnected);
    const queue_Now = queue.shift()
    queue.unshift(queue_Now);
    const player = createAudioPlayer();
    await voiceConnections[guildId].subscribe(player);
    notice_playing(queue_Now, guildId, playing_channel)
    const info = await ytdl.getInfo(ytdl.getURLVideoID(queue_Now.url));
    let format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!format) format = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
    if (!format) format = ytdl.chooseFormat(info.formats, { filter: 'audioandvideo' });
    const stream = ytdl.downloadFromInfo(info, {
        format: format,
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
                const info = await getInfo(queue_Now.url);
                const title = queue_Now.title;
                const duration = info.duration;
                const embed = new MessageEmbed()
                    .setDescription(
                        `:musical_note: **Playing Now ${
                            queue_Now.sp_url ? `: <:Spotify:1145234821342310551> - [${title}](${queue_Now.sp_url})` : `: ${title}`
                        }**\n\n` +
                        `:alarm_clock: **${resxData[lang].root.play_[0].data[1].value} : ${formatDuration(duration)}**`
                    ) 
                    .setColor('RED');
                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.channel.send(`${resxData[lang].root.play_[0].data[2].value}`)
                return discordapi_error(error, discordapi_error_channel)
            }
        }
    });
    player.on('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            if (loopStatus[guildId]) {
                return play(message);
            }
            if (queue.length === 1) {
                if (autoplayStatus[guildId]) {
                    const queueItem = await processQueue(message, guildId)
                    if (!queueItem) {
                        await message.channel.send(`${resxData[lang].root.play_[0].data[3].value}`)
                        await disconnect(guildId)
                    }
                    queue.push(queueItem);
                    queue.shift();
                    return await play(message);
                }
            }
            queue.shift()
            if (queue.length > 0) {
                if (!queue[0].url.includes('http://') && !queue[0].url.includes('https://')){
                    return await localPlay(message);
                }
                play(message);
            } else {
                return setTimeout(() => {
                    disconnect(guildId)
                }, 1000);
            }
        }
    });
    player.on('error', async(error) => {
        console.log(error)
        if (queue.length > 0) {
            if (!queue[0].url.includes('http://') && !queue[0].url.includes('https://')){
                return localPlay(message);
            }
            play(message);
            return message.channel.send(`${resxData[lang].root.play_warning[0].data[0].value}\n${resxData[lang].root.play_warning[0].data[2].value}\nPlaying Nowが2つでるのは仕様だよ！`)
        }
        else {
            disconnect(guildId)
            return message.channel.send(`${resxData[lang].root.play_warning[0].data[0].value}\n${resxData[lang].root.play_warning[0].data[1].value}`);
        }
    });
    connection.on(VoiceConnectionStatus.Ready, () => {
        var type = 'Ready'
        return notice_vc(guildId, type, vc_channel)
    });
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        var type = 'Disconnected'
        notice_vc(guildId, type, vc_channel)
        return await disconnect(guildId)
    });
}

async function localPlay(message){
    const guildId = message.guild.id;
    const queue = queues[guildId];
    const gildLang = await guildLanguage()
    let lang = gildLang[guildId]
    if (!(lang in resxData)) {
        lang = 'en-US';
    }
    if (!queue || queue.length === 0) {
        return disconnect(guildId);
    }
    if (!message.member.voice.channel) {
        message.channel.send(`${resxData[lang].root.play_[0].data[0].value}`);
        return delete queues[guildId];
    }
    voiceConnections[guildId] = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
    });
    loopStatus[guildId] = loopStatus[guildId] ? loopStatus[guildId] : false;
    autoplayStatus[guildId] = autoplayStatus[guildId] ? autoplayStatus[guildId] : false;
    const connection = getVoiceConnection(guildId);
    connection.removeAllListeners(VoiceConnectionStatus.Ready);
    connection.removeAllListeners(VoiceConnectionStatus.Disconnected);
    const queue_Now = queue.shift()
    queue.unshift(queue_Now);
    const player = createAudioPlayer();
    await voiceConnections[guildId].subscribe(player);
    notice_playing(queue_Now, guildId, playing_channel)
    const stream = fs.createReadStream(queue_Now.url);
    const resource = createAudioResource(stream, {
        inputType: "webm/opus",
        bitrate: 64,
        inlineVolume: true
    });
    resource.volume.setVolume(0.2);
    player.play(resource);
    player.once('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Playing) {
            const metadata = await fetchMetadata(queue_Now.url);
            try {
                const embed = new MessageEmbed()
                    .setDescription(
                        `:musical_note: **Playing Now ${queue_Now.title}**\n\n`+
                        `:alarm_clock: **${resxData[lang].root.play_[0].data[1].value} : ${formatDuration(Math.floor(metadata.format.duration))}**`
                    ) 
                    .setColor('RED');
                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.channel.send(`${resxData[lang].root.play_[0].data[2].value}`)
                return discordapi_error(error, discordapi_error_channel)
            }
        }
    });
    player.on('stateChange', async (oldState, newState) => {
        if (newState.status === AudioPlayerStatus.Idle) {
            if (loopStatus[guildId]) {
                return localPlay(message);
            }
            if (queue.length === 1) {
                if (autoplayStatus[guildId]) {
                    const queueItem = await processQueue(message, guildId)
                    if (!queueItem) {
                        await message.channel.send(`${resxData[lang].root.play_[0].data[3].value}`)
                        await disconnect(guildId)
                    }
                    queue.push(queueItem);
                    queue.shift();
                    return await play(message);
                }
            }
            queue.shift()
            if (queue.length > 0) {
                if (!queue[0].url.includes('http://') && !queue[0].url.includes('https://')){
                    return await localPlay(message);
                }
                play(message);
            } else {
                return setTimeout(() => {
                    disconnect(guildId)
                }, 1000);
            }
        }
    });
    connection.on(VoiceConnectionStatus.Ready, () => {
        var type = 'Ready'
        return notice_vc(guildId, type, vc_channel)
    });
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        var type = 'Disconnected'
        notice_vc(guildId, type, vc_channel)
        return await disconnect(guildId)
    });
}

async function fetchMetadata(filePath) {
    const musicMetadata = await import('music-metadata');
    return musicMetadata.parseFile(filePath);
}

async function processQueue(message, guildId) {
    const queue = queues[guildId];
    let VideoURL = queue[0].url;
    if (!queue[0].url.includes('http://') && !queue[0].url.includes('https://')){
        VideoURL = queue[0].source;
    }
    let retryCount = 0;
    while (retryCount < 10) {
        const NextPlayVideoItem = await NextPlay(VideoURL, youtube_error_channel)
        if (NextPlayVideoItem) {
            const queueItem = { url: NextPlayVideoItem.videoUrl, title: NextPlayVideoItem.title }
            return queueItem
        }
        else {
            retryCount++;
        }
    }
    return null;
}

function paginateQueue(queue) {
    const perPage = 10;
    const pages = [];
    for (let i = 0; i < queue.length; i += perPage) {
        const page = queue.slice(i, i + perPage);
        pages.push(page);
    }
    return pages;
}

function formatDuration(duration) {
    if(duration === 0) return " Live Stream"
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
async function getYearWeek(date) {
    const timeZoneOffset = 9 * 60; 
    const adjustedDate = new Date(date.getTime() + timeZoneOffset * 60 * 1000);

    const year = adjustedDate.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1).getDay();
    const adjustment = firstDayOfYear > 1 && firstDayOfYear < 5 ? -firstDayOfYear + 1 : 0;
    const week = String(Math.ceil((adjustedDate - new Date(year, 0, 1 + adjustment)) / 86400000 / 7)).padStart(2, '0');
    return `${year}-${week}`;
}
async function guildLanguage() {
    try {
        const data = await fs.readFileSync(Language_data, 'utf-8');
        return JSON.parse(data);
    }
    catch (err) {
        error_log(err, error_channel)
        return {};
    }
}
async function setLanguage(message, guildId, newLang) {
    const existingLocales = await guildLanguage();
    existingLocales[guildId] = newLang;
    fs.writeFile(Language_data, JSON.stringify(existingLocales, null, 2), (err) => {
        if (err) {
            return error_log(err, error_channel)
        } else {
            return message.channel.send(`${resxData[newLang].root.lang[0].data[3].value}`);
        }
    });
}
async function useDataSetup() {
    const guilds = client.guilds.cache;
    const now = new Date();
    const yearWeek = await getYearWeek(now);

    for (const guild of guilds.values()) {
        const guildId = guild.id;

        if (!useData[guildId]) {
            useData[guildId] = { name: guild.name, data: {} };
        }

        if (!useData[guildId].data[yearWeek]) {
            useData[guildId].data[yearWeek] = 0;
        }
    }
    await saveData(useData);
}
async function disconnect(guildId) {
    if (voiceConnections[guildId] && !voiceConnections[guildId].destroyed) {
        await voiceConnections[guildId].disconnect();
        delete voiceConnections[guildId];
    }
    if (queues[guildId]) { delete queues[guildId]; }
    if (loopStatus[guildId]) { delete loopStatus[guildId]; }
    if (autoplayStatus[guildId]) { delete autoplayStatus[guildId]; }
    return
}

const updateActivity = () => {
    const serverCount = client.guilds.cache.size;
    const voiceCount = Object.keys(voiceConnections).length;
    return client.user.setActivity(`!help | ${voiceCount}VC ${serverCount} Servers`)
}
client.on('voiceStateUpdate', (oldState, newState) => {
    updateActivity()
    const botId = client.user.id;
    const oldVoiceChannel = oldState.channel;
    const newVoiceChannel = newState.channel;

    if (oldVoiceChannel && oldVoiceChannel.members.has(botId) && !newVoiceChannel) {
        const guildId = newState.guild.id;
        const memberCount = oldVoiceChannel ? oldVoiceChannel.members.size : 0;
        if (memberCount === 1) {
            return disconnect(guildId)
        }
    }
});
client.on('guildCreate', async (guild) => {
    var type = "join";
    updateActivity();
    join_left(guild, type, join_left_channel);
    const japaneseRegex = /[\u3040-\u30FF\uFF00-\uFFEF\u4E00-\u9FFF]/;
    if (japaneseRegex.test(guild.name)) {
        const existingLocales = await guildLanguage();
        existingLocales[guild.id] = "ja";
        fs.writeFile(Language_data, JSON.stringify(existingLocales, null, 2), (err) => {
            if (err) {
                return error_log(err, error_channel)
            }
        });
    }
});
client.on('guildDelete', (guild) => {
    var type = "left";
    updateActivity();
    join_left(guild, type, join_left_channel);
    return disconnect(guild.id)
});
client.login(token);
app.listen(3010)

process.on('uncaughtException', async(error) => {
    console.error('Uncaught Exception:', error);
    return error_log(error, error_channel)
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    return error_log(reason, error_channel)
});

const writeFileAsync = promisify(fs.writeFile);

class WriteQueue {
    constructor() {
        this.queue = [];
        this.isWriting = false;
    }

    async enqueue(data) {
        return new Promise(async (resolve, reject) => {
            this.queue.push({ data, resolve, reject });
            if (!this.isWriting) {
                this.isWriting = true;
                await this.writeNext();
            }
        });
    }

    async writeNext() {
        const entry = this.queue.shift();
        if (entry) {
            try {
                await writeFileAsync(use_data, JSON.stringify(entry.data, null, 4));
                entry.resolve();
            } catch (error) {
                entry.reject(error);
            } finally {
                await this.writeNext();
            }
        } else {
            this.isWriting = false;
        }
    }

    async autoSaveData() {
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
            await this.enqueue(useData);
        }
    }
}

const writeQueue = new WriteQueue();
writeQueue.autoSaveData();

async function saveData(data) {
    await writeQueue.enqueue(data);
}

cron.schedule('0 0 * * 0', () => {
    useDataSetup()
});