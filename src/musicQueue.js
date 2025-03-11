const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const { commandStatus } = require('../events/event');
const { volume, lang, removeWord, filter } = require('../SQL/lockup');

const queue = new Map();

async function CreateServerQueue(guildId, voiceChannel, textChannel) {
    const serverQueue = {
        textChannel,
        playingMessage: null,
        voiceChannel,
        connection: null,
        moveVc: false,
        guildName: voiceChannel.guild.name,
        guildId: guildId,
        language: await lang(guildId) || 'en',
        removeWord: await removeWord(guildId) || false,
        filter: await filter(guildId) || 'auto',
        loop: false,
        autoPlay: false,
        pause: false,
        volume: await volume(guildId) || 10,
        IdolStop: null,
        pauseTimeout: null,
        commandStatus: new commandStatus(),
        editTimeout: null,
        songs: [],
        ffmpegProcess: null,
        itag: null,
        LiveItag: [93, 94, 92, 91, 140],
        Throttle: null,
        resource: null,
        stream: null,
        audioPlayer: createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        }),
        time: {
            start: 0,
            end: 0,
            current: 0,
            interval: null
        },
        game: null
    };
    queue.set(guildId, serverQueue);
    return serverQueue;
}

module.exports = { queue, CreateServerQueue };
