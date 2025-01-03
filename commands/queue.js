const { ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { queue: musicQueue } = require('../src/musicQueue');
const language = require('../lang/commands/queue');

module.exports = {
    data: {
        name: 'queue',
        description: 'Displays the current music queue',
        name_localizations: {
            ja: 'queue',
        },
        description_localizations: {
            ja: '現在の音楽キューを表示します',
        }
    },
    alias: ['q'],
    async execute(interactionOrMessage, args, lang) {
        interactionOrMessage.channel.sendTyping();
        const serverQueue = musicQueue.get(interactionOrMessage.guildId);
        if (!serverQueue) return interactionOrMessage.reply(language.notQueue[lang]);

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
            await interaction.deferUpdate();
            if (interaction.customId === 'prev') {
                currentPage = Math.max(0, currentPage - 1);
            }
            else if (interaction.customId === 'next') {
                currentPage = Math.min(maxPages - 1, currentPage + 1);
            }
            const embeds = createQueueEmbed(serverQueue, currentPage, maxPages, lang);
            const components = [createPaginationRow(currentPage, maxPages, lang)];
            await sentMessage.edit({ embeds: embeds, components: components });
        });

        collector.on('end', async () => {
            const disabledComponents = components.map(component => {
                const disabledButton = component.components.map(button => {
                    return ButtonBuilder.from(button).setDisabled(true);
                });
                return ActionRowBuilder.from({ components: disabledButton });
            });
            await sentMessage.edit({ components: disabledComponents });
        });
    },
};

function createQueueEmbed(serverQueue, currentPage, maxPages, lang) {
    const songsPerPage = 5; // 1ページあたりの曲数
    const start = currentPage * songsPerPage;
    const end = start + songsPerPage;
    const currentSongs = serverQueue.songs.slice(start, end);

    const totalDuration = getTotalDuration(serverQueue);
    const embed = new EmbedBuilder()
        .setTitle(language.title[lang])
        .setDescription(language.description[lang](totalDuration, serverQueue.songs.length))
        .setColor('#FF0000')
        .setFooter({ text: language.footer[lang](currentPage, maxPages) });

    currentSongs.forEach((song, index) => {
        const isNowPlaying = serverQueue.songs[0] === song;
        const name = isNowPlaying ? `${language.nowPlaying[lang]} - ${formatDuration(song.duration)}` : `No.${start + index + 1} - ${formatDuration(song.duration)}`;
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