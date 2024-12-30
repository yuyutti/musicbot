// embed
const { EmbedBuilder } = require('discord.js');

const language = require('../lang/src/guildLogger');

async function sendLogger(interactionOrMessage, lang, command, guildLoggerChannel, commandType) {
    if (!guildLoggerChannel) return;
    const channel = await interactionOrMessage.guild.channels.fetch(guildLoggerChannel);

    const user = interactionOrMessage.user || interactionOrMessage.author;

    const embed = new EmbedBuilder()
    .setColor('#7289DA')
    .setTitle(language.title[lang])
    .addFields(
        { name: language.command[lang], value: `\`${commandType}${command}\``, inline: true },
        { name: language.executor[lang], value: `<@${user.id}>`, inline: false },
        { name: language.channel[lang], value: `<#${interactionOrMessage.channel.id}>`, inline: false },
        { name: language.timestamp[lang], value: `<t:${ Number(((BigInt(interactionOrMessage.id) >> 22n) + 1420070400000n) / 1000n) }:F>`, inline: false }
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: 'DJ-Music', iconURL: 'https://cdn.discordapp.com/app-icons/1113282204064297010/9934a13736d8e8e012d6cb71a5f2107a.png?size=256' })
    .setTimestamp();

    await channel.send({ embeds: [embed] });
    return true;
}

module.exports = { sendLogger }