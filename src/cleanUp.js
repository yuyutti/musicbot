const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { queue: musicQueue } = require('./musicQueue');
const { updateActivity } = require('./activity');
const { updatePlayingGuild } = require('./playingGuild');

async function cleanupQueue(guildId) {
    const serverQueue = musicQueue.get(guildId);
    if (!serverQueue) return ;
    serverQueue.IdolStop = true;
    if (serverQueue.audioPlayer) serverQueue.audioPlayer.stop(true);
    if (serverQueue.resource) serverQueue.resource.playStream.destroy();
    if (serverQueue.connection && serverQueue.connection.state.status !== "destroyed") serverQueue.connection.destroy();
    if (serverQueue.time.interval) clearInterval(serverQueue.time.interval);
    if (serverQueue.trafficLogInterval) clearInterval(serverQueue.trafficLogInterval);
    if (serverQueue.ffmpegProcess) serverQueue.ffmpegProcess.kill('SIGKILL');
    if (serverQueue.Throttle) serverQueue.Throttle.destroy();
    
    cleanupButtons(guildId);
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

            try {
                await serverQueue.playingMessage.edit({ components: disabledButtons });
            }
            catch (error) {
                // ChannelNotCachedError: Cannot edit a message in a channel that has been deleted
                if (error.message.includes('ChannelNotCached')) return ;
                console.error(`message edit error for guild ID: ${guildId}: ${error.message}`);
            }
        }
        catch (error) {
            console.error(`Failed to disable buttons for guild ID: ${guildId}:`, error);
        }
    }
}

module.exports = { cleanupQueue, cleanupButtons };