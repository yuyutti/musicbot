const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

async function notice_command(guildId,message,prefix,command,command_channel) {
    if(command_channel === null) return;
    const guild = await client.guilds.fetch(guildId);
    const userName = message.author.username;
    const guildName = guild.name
    const logMessage = `**${userName}**が**${guildName}**で**「${prefix} ${command}」**を実行しました`;
    await command_channel.send(logMessage);
}

async function notice_playing(queue_Now,guildId,playing_channel) {
    if(playing_channel === null) return;
    const guild = await client.guilds.fetch(guildId);
    const guildName = guild.name
    const logMessage = `**${guildName}**で**「${queue_Now.title}」**の再生を開始しました`;
    await playing_channel.send(logMessage);
}

async function notice_vc(guildId,type,vc_channel) {
    if(vc_channel === null) return;
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
    if(join_left_channel === null) return;
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

async function error_log(error,error_channel) {
    if(error_channel === null) return;
    return await error_channel.send(`${error}`);
}

async function express_error(err,express_error_channel) {
    if(express_error_channel === null) return;
    return await express_error_channel.send(`ExpressError: ${err}`);
}

async function discordapi_error(error,discordapi_error_channel) {
    if(discordapi_error_channel === null) return;
    return await discordapi_error_channel.send(`DiscordAPIError: ${error}`);
}

async function youtube_error(error,youtube_error_channel) {
    if(youtube_error_channel === null) return;
    return await youtube_error_channel.send(`YouTubeAPIError: ${error}`);
}

module.exports = { notice_command, notice_playing, join_left, notice_vc, error_log, express_error, discordapi_error, youtube_error };