require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { createTable, isOfflineMode } = require('./SQL/connection');
const { updateVolume, updateLang, updateRemoveWord, updateLogChannel } = require('./SQL/setdata');
const { removeData } = require('./SQL/removedata');
const { lang, volume, LogChannel } = require('./SQL/lockup');
const { sendLogger } = require('./src/guildLogger');


const globalLanguage = require('./lang/commands/global');
const { updateActivity, setClientInstant, startActivity } = require('./src/activity');
const { updatePlayingGuild } = require('./src/playingGuild');
const { cleanupQueue, cleanupButtons } = require('./src/cleanUp');
const { fetchChannel, getLoggerChannel, getErrorChannel } = require('./src/log');

const { loadQueueFromFile } = require('./src/shutdownHandler');

const { playSong } = require('./src/playsong');
const { queue: musicQueue } = require('./src/musicQueue');

createTable();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();
const prefix = "!";

let loggerChannel;
let errorChannel;

let isReady = false;

client.once('ready', async() => {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        
        if (command.alias) {
            for (const alias of command.alias) {
                client.commands.set(alias, command);
            }
        }
        client.commands.set(command.data.name, command);
        
        if (file === 'cleanup.js') continue;
    
        if (command.alias && Array.isArray(command.alias)) {
            for (const alias of command.alias) {
                commands.push({
                    ...command.data,
                    name: alias,
                    name_localizations: command.data.name_localizations ? 
                        Object.fromEntries(Object.entries(command.data.name_localizations).map(([key, value]) => [key, alias])) : undefined,
                });
            }
        }
    
        commands.push(command.data);
    }
    // コマンド登録 テストするときはここにguildIdを指定する
    await client.application.commands.set(commands); // 本番環境
    //await client.application.commands.set(commands, process.env.GUILD_ID); // テスト環境
    //await client.application.commands.set([], process.env.GUILD_ID); // テスト環境コマンドの削除(グローバルコマンドで定義済みのため)
    await fetchChannel(client);
    loggerChannel = getLoggerChannel();
    errorChannel = getErrorChannel();

    console.log(`Logged in as ${client.user.tag}`);
    loggerChannel.send('Logged in as ' + client.user.tag);
    if (isOfflineMode()) errorChannel.send('login is offline mode');

    setClientInstant(client);
    startActivity();
    updatePlayingGuild();
    isReady = true;

    loadQueueFromFile(client);
});

// コマンド待ち受け //
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const language = await lang(message.guildId);
    if (!isReady) return message.reply(globalLanguage.isReady[language]);
    
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) return;
    const guildLoggerChannel = await LogChannel(message.guildId);

    try {
        loggerChannel.send(`command: **${message.guild.name}**で**!${commandName}**が実行されました`);
        if (guildLoggerChannel) sendLogger(message, language, commandName, guildLoggerChannel, "!");
        await command.execute(message, args, language);
    }
    catch (error) {
        console.error(error);
        errorChannel.send(`Error: \n\`\`\`${error}\`\`\``);
        message.reply({ content: globalLanguage.error[language] , ephemeral: true });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const guildLoggerChannel = await LogChannel(interaction.guildId);
    const language = await lang(interaction.guildId);
    if (!isReady) return interaction.reply(globalLanguage.isReady[language]);

    if (interaction.deferred || interaction.replied) {
        return console.log('このインタラクションは既に応答されています。');
    }

    const args = "いんたらくしょんだからないよ～ん"
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        loggerChannel.send(`command: **${interaction.guild.name}**で/**${interaction.commandName}**が実行されました`);
        if (guildLoggerChannel) sendLogger(interaction, language, interaction.commandName, guildLoggerChannel, "/");
        await command.execute(interaction, args, language);
    }
    catch (error) {
        console.error(error);
        errorChannel.send(`Error: \n\`\`\`${error}\`\`\``);
        await interaction.reply({ content: globalLanguage.error[language], ephemeral: true });
    }
});

// 音楽再生中のボタン待ち受け //
client.on('interactionCreate', async interaction => {
    if (interaction.deferred || interaction.replied) {
        return console.log('このインタラクションは既に応答されています。');
    }

    if (!interaction.isButton()) return;
    const { customId } = interaction;
    if (customId === 'next' || customId === 'prev') return;
    let args = [];
    const language = await lang(interaction.guildId);
    const guildVolume = await volume(interaction.guildId);

    switch (customId) {
        case 'volumeSmall':
            args = [Math.max(0, guildVolume - 5)];
            break;
        case 'volumeDefault':
            args = [10];
            break;
        case 'volumeBig':
            args = [Math.min(100, guildVolume + 5)];
            break;
        default:
            await executeCommand(customId, interaction, [], language);
            return;
    }

    await executeCommand('volume', interaction, args, language);

    async function executeCommand(commandName, interaction, args, language) {
        const guildLoggerChannel = await LogChannel(interaction.guildId);
        loggerChannel.send(`button: **${interaction.guild.name}**で**${commandName}**ボタンが押されました`);
        if (guildLoggerChannel) sendLogger(interaction, language, commandName, guildLoggerChannel, "#");
        const command = client.commands.get(commandName);
        if (command) await command.execute(interaction, args, language);
    }
});

// 自身への返信メッセージを削除する
client.on('messageCreate', async message => {
    if (message.author.bot && message.reference) {
        try {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMessage.author.id === client.user.id) {
                setTimeout(() => {
                    message.delete().catch(console.error);
                }, 3000);
            }
        }
        catch (error) {
            if (error.code === 10008) console.error('The message was not found.');
            else {
                console.error('Error fetching replied message:', error);
                errorChannel.send(`Error fetching replied message: \n\`\`\`${error}\`\`\``);
            }
        }
    }
});

client.on('voiceStateUpdate', async(oldState, newState) => {
    const oldVoiceChannel = oldState.channel;
    const newVoiceChannel = newState.channel;

    if (oldVoiceChannel && (!newVoiceChannel || newVoiceChannel.id !== oldVoiceChannel.id)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        updateActivity();
        updatePlayingGuild();

        const isOnlyBotsLeft = oldVoiceChannel.members.filter(member => !member.user.bot).size === 0;

        if (oldVoiceChannel.members.size === 0 || isOnlyBotsLeft) {
            return cleanupButtons(newState.guild.id) && cleanupQueue(newState.guild.id);
        }
    }
});

client.on('guildCreate', guild => {
    if (guild.preferredLocale === 'ja') {
        updateLang(guild.id, 'ja');
    }
    updateActivity();
    loggerChannel.send(`info: ${guild.name} に参加しました。`);
});

client.on('guildDelete', guild => {
    cleanupButtons(guild.id);
    cleanupQueue(guild.id);
    removeData(guild.id);
    updateActivity();
    loggerChannel.send(`info: ${guild.name} から退出しました。`);
});

// 30秒おきにアクティビティを更新
setInterval(() => {
    updateActivity();
    updatePlayingGuild();
}, 30000);

// 2時間おきにログを削除
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000; // 現在時刻から1時間前のタイムスタンプ

    // 1時間以内のデータだけを保持
    process.customData.traffic = process.customData.traffic.filter(log => log.timestamp >= oneHourAgo);

    console.log(`Filtered customData: ${process.customData.traffic.length} entries remaining.`);
}, 2 * 3600000);

process.on('uncaughtException', (err) => {
    console.error(err);
    errorChannel.send(`uncaughtException: \n\`\`\`${err}\`\`\``);
});

client.login(process.env.DISCORD_TOKEN);