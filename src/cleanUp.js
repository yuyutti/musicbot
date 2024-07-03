const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { queue: musicQueue } = require('./musicQueue');
const { updateActivity } = require('./activity');
const { updatePlayingGuild } = require('./playingGuild');

async function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (!serverQueue) return ;
    if (serverQueue.connection && serverQueue.connection.state.status !== "destroyed") serverQueue.connection.destroy();

    if (serverQueue.time.interval) clearInterval(serverQueue.time.interval);
    if (serverQueue.ffmpegProcess) serverQueue.ffmpegProcess.kill('SIGKILL');
    musicQueue.delete(guildId);
    updateActivity();
    updatePlayingGuild();
}

async function cleanupButtons(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (!serverQueue) return ;
    
    if (serverQueue.playingMessage && serverQueue.playingMessage.components) {
        try {
            const components = serverQueue.playingMessage.components;
            const disabledButtons = components.map(actionRow =>
                new ActionRowBuilder().addComponents(
                    actionRow.components.map(button =>
                        ButtonBuilder.from(button).setDisabled(true)
                    )
                )
            );

            serverQueue.playingMessage.edit({ components: disabledButtons }).catch(console.error);
        }
        catch (error) {
            console.error(`Failed to disable buttons for guild ID: ${guildId}:`, error);
        }
    }
}

module.exports = { cleanupQueue, cleanupButtons };