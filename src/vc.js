const { PermissionsBitField } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const language = require('../lang/commands/play');
const { queue: musicQueue } = require('./musicQueue');

function checkPermissions(permissions, interactionOrMessage, lang) {
    if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) {
        interactionOrMessage.reply({ content: language.ViewChannelPermission[lang], ephemeral: true });
        return false;
    }
    if (!permissions.has(PermissionsBitField.Flags.Connect)) {
        interactionOrMessage.reply({ content: language.ConnectPermission[lang], ephemeral: true });
        return false;
    }
    if (!permissions.has(PermissionsBitField.Flags.Speak)) {
        interactionOrMessage.reply({ content: language.SpeakPermission[lang], ephemeral: true });
        return false;
    }
    if (interactionOrMessage.member.voice.channel.full) {
        interactionOrMessage.reply({ content: language.fullVoiceChannel[lang], ephemeral: true });
        return false;
    }
    return true;
}

function joinVC(guildId) {
    const serverQueue = musicQueue.get(guildId);

    serverQueue.connection = joinVoiceChannel({
        channelId: serverQueue.voiceChannel.id,
        guildId,
        adapterCreator: serverQueue.voiceChannel.guild.voiceAdapterCreator,
    });
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