// TODO list
// ・queueコマンド時embedを1ずつ送信し前後のページへ行きたいときはインタラクトボタンを押す

const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { joinVoiceChannel, createAudioResource, AudioPlayerStatus, createAudioPlayer, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { playlist, NextPlay, search, getInfo } = require('./src/api/YouTubeAPI');
const { notice_command, notice_playing, join_left, notice_vc, error_log, express_error, discordapi_error } = require('./src/package/notification');
const resxData = require('./src/package/resx-parse');
const fs = require('fs');
const path = require('path');
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

const filePath = path.join(__dirname, '/data/guildLanguage.json');

const adminId = ['687374475997741075', '933314562487386122'];

let command_channel, playing_channel, vc_channel, join_left_channel, error_channel, express_error_channel, discordapi_error_channel, playing_error_channel;

let queues = {};
let loopStatus = {};
let autoplayStatus = {};
let voiceConnections = {};

app.get('/lang', async (req,res) => {
    const existingLocales = await guildLanguage();
    let lang = {}
    let position = 1;
    for (const guildId in existingLocales) {
        const Language = existingLocales[guildId];
        const guild = client.guilds.cache.get(guildId);
        lang[position] = { ServerName: guild.name, Language: Language }
        position++
    }
    res.send(lang)
})

app.get('/langfile', async (req,res) => {
    res.send(resxData)
})

app.get('/server', async (req,res) => {
    try{
        const guilds = client.guilds.cache;
        let servers = {}
        let position = 1;
        guilds.forEach(guild => {
            servers[position] = { ServerName: guild.name, Language: guild.preferredLocale, memberCount: guild.memberCount, guildId: guild.id }
            position++;
        });
        res.send(servers)
    }
    catch(err){
        console.log(err)
        express_error(err,express_error_channel)
        res.status(500).send('Internal Server Error');
    }
})

app.get('/queue', async (req, res) => {
    try{
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
    catch(err){
        console.log(err)
        express_error(err,express_error_channel)
        res.status(500).send('Internal Server Error');
    }
});
app.get('/vc', (req, res) => {
    try{
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
    catch(err){
        console.log(err)
        express_error(err,express_error_channel)
        res.status(500).send('Internal Server Error');
    }
});

client.on('ready', async() => {
    updateActivity()
    console.log(`Logged in as ${client.user.tag}`);

    const management_guildId = client.guilds.cache.get('1132198504199098458');
    command_channel = management_guildId.channels.cache.get('1132332545124606083');
    playing_channel = management_guildId.channels.cache.get('1132332665597595678');
    vc_channel = management_guildId.channels.cache.get('1132332617438601306');
    join_left_channel = management_guildId.channels.cache.get('1132604272534630440');
    error_channel = management_guildId.channels.cache.get('1132616852254773348');
    express_error_channel = management_guildId.channels.cache.get('1132604669735211039');
    discordapi_error_channel = management_guildId.channels.cache.get('1132604715105009745');
    playing_error_channel = management_guildId.channels.cache.get('1132604753654849577');
    youtube_error_channel = management_guildId.channels.cache.get('1132338080918016090');

    const existingLocales = await guildLanguage();
    let serverLocales = {};
    const guilds = client.guilds.cache;
    guilds.forEach(guild => {
        if(existingLocales[guild.id]){
            const savedLang = existingLocales[guild.id]     
            if(savedLang === guild.preferredLocale){
                serverLocales[guild.id] = guild.preferredLocale;
            }
            else{
                serverLocales[guild.id] = savedLang
            }
        }
        else{
            serverLocales[guild.id] = guild.preferredLocale;
        }
    });
    fs.writeFile(filePath, JSON.stringify(serverLocales, null, 2), (err) => {
        if (err) {
            error_log(err,error_channel)
        }
    });
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const command = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();
    const guildId = message.guild.id;
    notice_command(guildId,message,prefix,command,command_channel)

    const gildLang = await guildLanguage()
    let lang = gildLang[guildId]
    if (!(lang in resxData)){
        lang = 'en-US';
    }

    if(command === "guildlang"){
        if(!adminId.includes(message.author.id)){ return console.log("kick command is access deny") }
        const japaneseRegex = /[\u3040-\u30FF\uFF00-\uFFEF\u4E00-\u9FFF]/;
        const existingLocales = await guildLanguage();
        let serverLocales = {};
        for (const guildId in existingLocales) {
            const guild = client.guilds.cache.get(guildId);
            if(japaneseRegex.test(guild.name)){
                serverLocales[guild.id] = "ja";
            }
            else{
                serverLocales[guild.id] = "en-US";
            }
        }
        fs.writeFile(filePath, JSON.stringify(serverLocales, null, 2), (err) => {
            if (err) {
                return error_log(err,error_channel)
            }
        });
    }
    
    if(command === "kick"){
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if(!adminId.includes(message.author.id)){ return console.log("kick command is access deny") }
        if(!arg){ return console.log("arg is not found") }
        return disconnect(arg)
    }

    if(command === "adminlang"){
        if(adminId.includes(message.author.id)){
            const args = arg.split(/ +/);
            const arg1 = args[0];
            const arg2 = args[1];
            await setLanguage(message,arg1, arg2)
        }
    }

    if(command === "lang"){
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if(!arg){
            await message.channel.send(`${resxData[lang].root.lang[0].data[0].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[1].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[2].value}`);
        }
        if(arg === "ja"){
            await setLanguage(message,guildId,"ja")
        }
        if(arg === "en"){
            await setLanguage(message,guildId,"en-US")
        }
        if(!arg === "ja" || !arg === "en"){
            await message.channel.send(`${resxData[lang].root.lang[0].data[0].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[1].value}`);
            await message.channel.send(`${resxData[lang].root.lang[0].data[2].value}`);
        }
    }

    if (command === 'play' || command === "p") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        if(!arg){
            const playlistItems = await playlist('PL4fGSI1pDJn4-UIb6RKHdxam-oAUULIGB',youtube_error_channel);
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
        if (arg.startsWith('https')) {
            if (arg.includes("youtube.com") || arg.includes("youtu.be")) {
                if (arg.includes("list=")) {
                    message.channel.send("loading...");
                    const playlistId = arg.split("list=")[1].split("&")[0];
                    const playlistItems = await playlist(playlistId,youtube_error_channel);
                    if (playlistItems && playlistItems.videoUrls.length > 0) {
                        const videoCount = playlistItems.totalResults;
                        const fastVideo = playlistItems.videoUrls[0];
                        const fastVideotitle = playlistItems.videoTitles[0];
                        const resxdata = resxData[lang].root.youtubeapi[0]
                        let mess
                        if(playlistItems.mix === "true"){
                            mess = `${resxdata.data[0].value}${videoCount}${resxdata.data[1].value}\n${resxdata.data[2].value}\n${resxdata.data[3].value}\n${resxdata.data[4].value}${fastVideotitle}\n${resxdata.data[5].value}`
                        }
                        else{
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
                                await interaction.deferReply(`${resxData[lang].root.play[0].data[7].value}`);
                            }
                        })
                        .catch(async() => {
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
                queue_List(queueItem,message)
                return;
            }
            message.channel.send(`${resxData[lang].root.play[0].data[5].value}`)
        }
        else {
            const SearchResults = await search(arg,1,youtube_error_channel)
            if(SearchResults.videoTitles.length > 0){
                const selectedSong = {
                    title: SearchResults.videoTitles[0],
                    url: SearchResults.videoUrls[0]
                };
                const queueItem = { url: selectedSong.url, title: selectedSong.title }
                queue_List(queueItem,message)
            }
            else{
                message.channel.send(`${resxData[lang].root.play[0].data[6].value}`)
            }
        }
    }

    if (command === "playsearch" || command === "ps") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const commandAuthor = message.author;
        if(!arg){
            return message.channel.send(`${resxData[lang].root.playsearch[0].data[0].value}`); 
        }
        const SearchResults = await search(arg,10,youtube_error_channel)
        if(SearchResults){
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
                discordapi_error(error,discordapi_error_channel)
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
                    msg.channel.send(`${resxData[lang].root.playsearch[0].data[3].value}`);
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
                    msg.channel.send(`${resxData[lang].root.playsearch[0].data[4].value}`);
                }
            });
            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    message.channel.send(`${resxData[lang].root.playsearch[0].data[5].value}`);
                }
            });
        }
        else{
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
            const queueEmbed = new MessageEmbed()
                .setTitle(`${resxData[lang].root.queue[0].data[0].value}`)
                .setDescription(`${resxData[lang].root.queue[0].data[2].value}`)
                .setColor('RED');
                
            let position = 1;
            try {
                for (let i = 0; i < queue.length; i++) {
                    const title = queue[i].title;
                    const queueField = i === 0 ? { name: `${resxData[lang].root.queue[0].data[3].value}`, value: `**${title}**` } : { name: `No.${position}`, value: `**${title}**` };
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
                discordapi_error(error,discordapi_error_channel)
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
                    return message.channel.send(`${resxData[lang].root.stop[0].data[0].value}`);
                }
                catch(err) {
                    return message.channel.send(`${resxData[lang].root.stop[0].data[1].value}`);
                }
            }
        }
        return message.channel.send(`${resxData[lang].root.stop[0].data[2].value}`);
    }

    if (command === "skip" || command === "s") {
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const queue = queues[guildId];
        if(loopStatus[guildId]){
            return message.channel.send(`${resxData[lang].root.skip[0].data[0].value}`);
        }
        if(autoplayStatus[guildId]){
            const queueItem = await processQueue(message, guildId)
            if(!queueItem){
                await message.channel.send(`${resxData[lang].root.skip[0].data[1].value}`)
                await disconnect(guildId)
            }
            queue.push(queueItem);
            queue.shift();
            return await play(message);
        }
        if (arg) {
            if(/^\d+$/.test(arg)){
                const int = parseInt(arg, 10)-1
                if(int < 2){ return message.channel.send(`${resxData[lang].root.skip[0].data[6].value}`) }
                if(int > queue.length){
                    let en_num = resxData[lang].root.skip[0].data[3].value
                    if(lang === "en-US"){
                        if(int+1 === 3){ en_num = resxData[lang].root.skip[0].data[8].value }
                    }
                    return message.channel.send(`${resxData[lang].root.skip[0].data[2].value}${int+1}${en_num}`)
                }
                for (let i = 0; i < int; i++) {
                    queue.shift();
                }
                return play(message);
            }
            else{
                return message.channel.send(`${resxData[lang].root.skip[0].data[4].value}`)
            }
        }
        if(queue && queue.length > 1){
            queue.shift();
            return play(message);
        }
        else {
            return message.channel.send(`${resxData[lang].root.skip[0].data[5].value}`);
        }
    }

    if (command === "remove"){
        const arg = message.content.slice(prefix.length + command.length + 1).trim();
        const queue = queues[guildId];
        if(/^\d+$/.test(arg)){
            const int = parseInt(arg, 10)-1
            if (int >= 1 && int < queue.length) {
                queue.splice(int, 1);
                return message.channel.send(`${int+1}${resxData[lang].root.remove[0].data[0].value}`);
            }
            else {
                return message.channel.send(`${resxData[lang].root.remove[0].data[1].value}`);
            }
        }
    }

    if (command === "loop") {
        if(!voiceConnections[guildId]){
            return message.channel.send(`${resxData[lang].root.loop[0].data[0].value}`);
        }
        if(!loopStatus[guildId]){
            loopStatus[guildId] = true
            message.channel.send(`${resxData[lang].root.loop[0].data[1].value}`);
        }
        else{
            loopStatus[guildId] = false
            message.channel.send(`${resxData[lang].root.loop[0].data[2].value}`);
        }
    }

    if (command === "autoplay" | command === "auto" | command === "ap") {
        if(!voiceConnections[guildId]){
            return message.channel.send(`${resxData[lang].root.autoplay[0].data[0].value}`);
        }
        if(!autoplayStatus[guildId]){
            autoplayStatus[guildId] = true
            message.channel.send(`${resxData[lang].root.autoplay[0].data[1].value}`);
        }
        else{
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
    if (!(lang in resxData)){
        lang = 'en-US';
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
    if (!(lang in resxData)){
        lang = 'en-US';
    }
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
        message.channel.send(`${resxData[lang].root.play_[0].data[0].value}`);
        return delete queues[guildId];
    }
    loopStatus[guildId] = loopStatus[guildId] ? loopStatus[guildId] : false;
    autoplayStatus[guildId] = autoplayStatus[guildId] ? autoplayStatus[guildId] : false;
    const connection = getVoiceConnection(guildId);
    connection.removeAllListeners(VoiceConnectionStatus.Ready);
    connection.removeAllListeners(VoiceConnectionStatus.Disconnected);
    const queue_Now = queue.shift()
    queue.unshift(queue_Now);
    const player = createAudioPlayer();
    await voiceConnections[guildId].subscribe(player);
    notice_playing(queue_Now,guildId,playing_channel)
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
                const info = await getInfo(queue_Now.url);
                const title = info.title;
                const duration = info.duration;
                const embed = new MessageEmbed()
                    .setTitle(`:musical_note: **Playing Now : ${title}**`)
                    .setDescription(`:alarm_clock: **${resxData[lang].root.play_[0].data[1].value} : ${formatDuration(duration)}**`)
                    .setColor('RED');
                message.channel.send({ embeds: [embed] });
            } catch (error) {
                message.channel.send(`${resxData[lang].root.play_[0].data[2].value}`)
                return discordapi_error(error,discordapi_error_channel)
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
                    const queueItem = await processQueue(message, guildId)
                    if(!queueItem){
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
        return notice_vc(guildId,type,vc_channel)
    });
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        var type = 'Disconnected'
        notice_vc(guildId,type,vc_channel)
        return await disconnect(guildId)
    });
}

async function processQueue(message, guildId) {
    const queue = queues[guildId];
    const VideoURL = queue[0].url;
    let retryCount = 0;
    while (retryCount < 10) {
        const NextPlayVideoItem = await NextPlay(VideoURL,youtube_error_channel)
        if (NextPlayVideoItem) {
            const queueItem = { url: NextPlayVideoItem.videoUrl, title: NextPlayVideoItem.title }
            return queueItem
        }
        else{
            retryCount++;
        }
    }
    return null;
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
async function guildLanguage() {
    try {
        const data = await fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    catch (err) {
        error_log(err,error_channel)
        return {};
    }
}
async function setLanguage(message,guildId,newLang) {
    const existingLocales = await guildLanguage();
    existingLocales[guildId] = newLang;
    fs.writeFile(filePath, JSON.stringify(existingLocales, null, 2), (err) => {
        if (err) {
            return error_log(err,error_channel)
        } else {
            return message.channel.send(`${resxData[newLang].root.lang[0].data[3].value}`);
        }
    });
}
async function disconnect(guildId) {
    if (voiceConnections[guildId] && !voiceConnections[guildId].destroyed) {
        await voiceConnections[guildId].disconnect();
        delete voiceConnections[guildId];
    }
    if (queues[guildId]) {delete queues[guildId];}
    if (loopStatus[guildId]) {delete loopStatus[guildId];}
    if (autoplayStatus[guildId]) {delete autoplayStatus[guildId];}
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
        if(memberCount === 1){
            return disconnect(guildId)
        }
    }
});
client.on('guildCreate', async (guild) => {
    var type = "join";
    updateActivity();
    join_left(guild,type,join_left_channel);
    const japaneseRegex = /[\u3040-\u30FF\uFF00-\uFFEF\u4E00-\u9FFF]/;
    if(japaneseRegex.test(guild.name)){
        const existingLocales = await guildLanguage();
        existingLocales[guild.id] = "ja";
        fs.writeFile(filePath, JSON.stringify(existingLocales, null, 2), (err) => {
            if (err) {
                return error_log(err,error_channel)
            }
        });
    }
});
client.on('guildDelete', (guild) => {
    var type = "left";
    updateActivity();
    join_left(guild,type,join_left_channel);
    return disconnect(guild.id)
});
client.login(token);
app.listen(3010)

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    return error_log(error,error_channel)
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    return error_log(reason,error_channel)
});