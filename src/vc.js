const { PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const language = require('../lang/commands/play');
const { queue: musicQueue } = require('./musicQueue');

const { getLoggerChannel } = require('./log');

function checkPermissions(permissions, interactionOrMessage, lang) {
    const loggerChannel = getLoggerChannel();
    if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) {
        interactionOrMessage.reply({ content: language.ViewChannelPermission[lang], ephemeral: true });
        loggerChannel.send(`permission: **${interactionOrMessage.guild.name}**でVCに参加しようとしましたが、**「チャンネルの表示」**権限がありません`);
        return false;
    }
    if (!permissions.has(PermissionsBitField.Flags.Connect)) {
        interactionOrMessage.reply({ content: language.ConnectPermission[lang], ephemeral: true });
        loggerChannel.send(`permission: **${interactionOrMessage.guild.name}**でVCに参加しようとしましたが、**「接続」**権限がありません`);
        return false;
    }
    if (!permissions.has(PermissionsBitField.Flags.Speak)) {
        interactionOrMessage.reply({ content: language.SpeakPermission[lang], ephemeral: true });
        loggerChannel.send(`permission: **${interactionOrMessage.guild.name}**でVCに参加しようとしましたが、**「発言」**権限がありません`);
        return false;
    }
    if (interactionOrMessage.member.voice.channel.full) {
        interactionOrMessage.reply({ content: language.fullVoiceChannel[lang], ephemeral: true });
        loggerChannel.send(`permission: **${interactionOrMessage.guild.name}**でVCに参加しようとしましたが、VCが満員です`);
        return false;
    }
    return true;
}

function joinVC(guildId) {
    const serverQueue = musicQueue.get(guildId);
    const connection = getVoiceConnection(guildId);
    if (connection) {
        console.log("BOTは既にVCに接続しています");
    }
    else {
        console.log("BOTはVCに接続していません。新しく接続します");
        serverQueue.connection = joinVoiceChannel({
            channelId: serverQueue.voiceChannel.id,
            guildId,
            adapterCreator: serverQueue.voiceChannel.guild.voiceAdapterCreator,
        });
    }
}

async function reconnectVC() {
    for (const [guildId, serverQueue] of musicQueue.entries()) {
        if (serverQueue) {
            joinVC(guildId);
            await playSong(guildId, serverQueue.songs[0]);
        }
    }
}

module.exports = { checkPermissions, joinVC, reconnectVC };