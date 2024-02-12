const { ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { queue: musicQueue } = require('../src/musicQueue');
const language = require('../lang/commands/queue');

module.exports = {
    data: {
        name: 'queue',
        description: {
            english: 'Displays the current music queue',
            japanese: '現在の音楽キューを表示します'
        }
    },
    alias: ['q'],
    async execute(interactionOrMessage, args, lang) {
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) {
            return interactionOrMessage.reply(language.notQueue[lang]);
        }

        let currentPage = 0;
        const maxPages = Math.ceil(serverQueue.songs.length / 5);

        const embeds = createQueueEmbed(serverQueue, currentPage, maxPages, lang);
        const components = [createPaginationRow(currentPage, maxPages, lang)];

        const sentMessage = await interactionOrMessage.reply({
            embeds: embeds,
            components: components,
            fetchReply: true
        });

        const collector = interactionOrMessage.channel.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (interaction.customId === 'next') {
                currentPage = Math.min(maxPages - 1, currentPage + 1);
            }
            const embeds = createQueueEmbed(serverQueue, currentPage, maxPages, lang);
            const components = [createPaginationRow(currentPage, maxPages, lang)];
            await sentMessage.edit({ embeds: embeds, components: components });
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        });

        collector.on('end', () => {
            const disabledComponents = components.map(component => {
                const disabledButton = component.components.map(button => {
                    return ButtonBuilder.from(button).setDisabled(true);
                });
                return ActionRowBuilder.from({ components: disabledButton });
            });
            sentMessage.edit({ components: disabledComponents });
        });
    },
};

function createQueueEmbed(serverQueue, currentPage, maxPages, lang) {
    const start = currentPage * 5;
    const end = start + 5;
    const currentSongs = serverQueue.songs.slice(start, end);

    const totalDuration = getTotalDuration(serverQueue);
    const embed = new EmbedBuilder()
        .setTitle(language.title[lang])
        .setDescription(language.description[lang](totalDuration, serverQueue.songs.length))
        .setColor('#FF0000')
        .setFooter({ text: language.footer[lang](currentPage, maxPages) });

    currentSongs.forEach((song, index) => {
        const name = index === 0 ? `${language.nowPlaying[lang]} - ${formatDuration(song.duration)}` : `No${start + index} - ${formatDuration(song.duration)}`;
        embed.addFields(
            { name: name, value: `${song.title}` }
        );
    });

    return [embed];
}

function getTotalDuration(serverQueue) {
    let totalDuration = 0;
    for (const song of serverQueue.songs) {
        totalDuration += Number(song.duration) || 0;
    }
    return formatDuration(totalDuration);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secondsLeft = seconds % 60;

    return [
        hours,
        hours ? String(minutes).padStart(2, '0') : minutes,
        String(secondsLeft).padStart(2, '0'),
    ].filter(Boolean).join(':');
}

function createPaginationRow(currentPage, maxPages, lang) {
    const prevButton = new ButtonBuilder()
        .setLabel(language.prev[lang])
        .setStyle(ButtonStyle.Primary)
        .setCustomId('prev')
        .setDisabled(currentPage === 0);

    const nextButton = new ButtonBuilder()
        .setLabel(language.next[lang])
        .setStyle(ButtonStyle.Primary)
        .setCustomId('next')
        .setDisabled(currentPage === maxPages - 1);

    return new ActionRowBuilder().addComponents(prevButton, nextButton);
}