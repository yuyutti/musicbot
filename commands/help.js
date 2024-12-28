const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');
const language = require('../lang/commands/help');
require('dotenv').config();

module.exports = {
    data: {
        name: 'help',
        description: 'Displays the usage and command list of the BOT',
        name_localizations: {
            ja: 'help',
        },
        description_localizations: {
            ja: 'BOTの使い方やコマンド一覧を表示します',
        }
    },
    async execute(interactionOrMessage, args, lang) {
        interactionOrMessage.channel.sendTyping();
        const topUrl = lang === 'ja' ? process.env.TOP_URL_JA : process.env.TOP_URL_EN;
        const privacyUrl = lang === 'ja' ? process.env.PRIVACY_URL_JA : process.env.PRIVACY_URL_EN;
        const helpPages = [
            new EmbedBuilder()
                .setTitle(language.page1Title[lang])
                .addFields(
                    { name: language.page1_addFields_name1[lang], value: language.page1_addFields_value1[lang] },
                    { name: language.page1_addFields_name2[lang], value: language.page1_addFields_value2[lang] },
                    { name: language.page1_addFields_name3[lang], value: language.page1_addFields_value3[lang] },
                    { name: language.page1_addFields_name4[lang], value: language.page1_addFields_value4[lang] },
                    { name: language.page1_addFields_name5[lang], value: language.page1_addFields_value5[lang] }
                ),
            new EmbedBuilder()
                .setTitle(language.page2Title[lang])
                .addFields(
                    { name: language.page2_addFields_name1[lang], value: language.page2_addFields_value1[lang] },
                    { name: language.page2_addFields_name2[lang], value: language.page2_addFields_value2[lang] },
                    { name: language.page2_addFields_name3[lang], value: language.page2_addFields_value3[lang] },
                    { name: language.page2_addFields_name4[lang], value: language.page2_addFields_value4[lang] },
                    { name: language.page2_addFields_name5[lang], value: language.page2_addFields_value5[lang] }
                ),
            new EmbedBuilder()
                .setTitle(language.page3Title[lang])
                .addFields(
                    { name: language.page3_addFields_name1[lang], value: language.page3_addFields_value1[lang] },
                    { name: language.page3_addFields_name2[lang], value: language.page3_addFields_value2[lang] },
                    { name: language.page3_addFields_name3[lang], value: language.page3_addFields_value3[lang] }
                )
        ];
        helpPages.forEach(page => {
            page.addFields(
                {
                    name: '\u200B',
                    value: language.footer1[lang] + '\n' + language.footer2[lang](topUrl, privacyUrl) + " / " + "v2.4.2"
                },
            );
        });
        await sendHelpMessage(interactionOrMessage, helpPages, lang);
    }
};

async function sendHelpMessage(interactionOrMessage, helpPages, lang) {
    let pageIndex = 0;

    async function updateMessageComponents(pageIndex,lang) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('<')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`${pageIndex + 1} / ${helpPages.length}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('>')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === helpPages.length - 1)
            );

        const linkRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel(language.inviteButton[lang])
                    .setStyle(ButtonStyle.Link)
                    .setURL(process.env.BOT_INVITE_URL),
                new ButtonBuilder()
                    .setLabel(language.supportButton[lang])
                    .setStyle(ButtonStyle.Link)
                    .setURL(process.env.BOT_SUPPORT_URL),
                new ButtonBuilder()
                    .setLabel(language.paypalButton[lang])
                    .setStyle(ButtonStyle.Link)
                    .setURL(process.env.PAYPAL_URL)
            );

        return [row, linkRow];
    }

    const message = await interactionOrMessage.reply({
        embeds: [helpPages[pageIndex]],
        components: await updateMessageComponents(pageIndex,lang),
        fetchReply: true
    });

    const filter = i => {
        const userId = i.user ? i.user.id : i.author.id;
        return ['prev', 'next'].includes(i.customId) && userId === interactionOrMessage.user?.id || userId === interactionOrMessage.author?.id;
    };

    const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async i => {
        if (i.customId === 'prev' && pageIndex > 0) pageIndex--;
        else if (i.customId === 'next' && pageIndex < helpPages.length - 1) pageIndex++;

        await i.update({
            embeds: [helpPages[pageIndex]],
            components: await updateMessageComponents(pageIndex,lang)
        });
    });
}