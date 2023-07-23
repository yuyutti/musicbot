const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

async function notice_command(guildId,message,prefix,command,command_channel) {
    const guild = await client.guilds.fetch(guildId);
    const userName = message.author.username;
    const guildName = guild.name
    const logMessage = `**${userName}**が**${guildName}**で**「${prefix} ${command}」**を実行しました`;
    await command_channel.send(logMessage);
}

async function notice_playing(queue_Now,guildId,playing_channel) {
    const guild = await client.guilds.fetch(guildId);
    const guildName = guild.name
    const logMessage = `**${guildName}**で**「${queue_Now.title}」**の再生を開始しました`;
    await playing_channel.send(logMessage);
}

async function notice_vc(guildId,type,vc_channel) {
    const guild = await client.guilds.fetch(guildId);
    const guildName = guild.name
    if(type === "Ready"){
        const logMessage = `**${guildName}**のVCに参加しました`;
        return await vc_channel.send(logMessage);
    }
    if(type === "Disconnected"){
        const logMessage = `**${guildName}**のVCから退出しました`;
        return await vc_channel.send(logMessage);
    }
}

async function join_left(guild,type,join_left_channel) {
    const guildName = guild.name
    if(type === "join"){
        const logMessage = `**${guildName}**に参加しましたしました`;
        return await join_left_channel.send(logMessage);
    }
    if(type === "left"){
        const logMessage = `**${guildName}**から退出しました`;
        return await join_left_channel.send(logMessage);
    }
}

async function error(error,error_channel) {
    return await error_channel.send(error);
}

async function express_error(err,express_error_channel) {
    return await express_error_channel.send(err);
}

async function discordapi_error(error,discordapi_error_channel) {
    return await discordapi_error_channel.send(error);
}

async function youtube_error(error,youtube_error_channel) {
    return await youtube_error_channel.send(error);
}

module.exports = { notice_command, notice_playing, join_left, notice_vc, error, express_error, discordapi_error, youtube_error };