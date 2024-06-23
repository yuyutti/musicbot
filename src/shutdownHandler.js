const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const { queue: musicQueue } = require('./musicQueue');
const { commandStatus } = require('../events/event');
const { volume, lang, removeWord } = require('../SQL/lockup');

const { playSong } = require('./playsong');

const queueFilePath = path.join(__dirname, '..','serverQueue.json');

const saveQueueToFile = (queue) => {
    console.log('Saving queue to file...');

    const queueCopy = new Map(
        Array.from(queue.entries()).map(([key, value]) => {
            const { textChannel, voiceChannel, guildName, guildId, loop, autoPlay, songs, time, game } = value;
            return [key, { textChannel, voiceChannel, guildName, guildId, loop, autoPlay, songs, time: { start: time.start, end: time.end, current: time.current }, game }];
        })
    );

    fs.writeFileSync(queueFilePath, JSON.stringify(Array.from(queueCopy.entries()), getCircularReplacer(), 4));
    console.log('Queue saved successfully.');
};

const loadQueueFromFile = async (client) => {
    if (!fs.existsSync(queueFilePath)) {
        console.log('Queue file does not exist.');
        return;
    }
    const data = fs.readFileSync(queueFilePath);
    const queueData = JSON.parse(data);
    console.log('Loaded queue data from file:', queueData.slice(0, 20));

    for (const [key, value] of queueData) {
        if (!value.guildId) {
            console.error(`Invalid guildId for key ${key}`);
            continue;
        }

        try {
            const guild = await client.guilds.cache.get(value.guildId);
            const voiceChannel = await guild.channels.cache.get(value.voiceChannel.id);
            const textChannel = await guild.channels.cache.get(value.textChannel.id);
            const serverQueue = {
                textChannel: textChannel,
                playingMessage: null,
                voiceChannel: voiceChannel,
                connection: null,
                guildName: value.guildName,
                guildId: value.guildId,
                language: await lang(value.guildId) || 'en',
                removeWord: await removeWord(value.guildId) || false,
                loop: value.loop,
                autoPlay: value.autoPlay,
                volume: await volume(value.guildId) || 10,
                commandStatus: new commandStatus(),
                songs: value.songs,
                audioPlayer: createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Pause
                    }
                }),
                time: { 
                    start: value.time.start,
                    end: value.time.end, 
                    current: value.time.current, 
                    interval: null 
                },
                game: value.game
            };
            musicQueue.set(key, serverQueue);
            playSong(value.guildId, serverQueue.songs[0]);
            textChannel.send('再生を再開します。');
            console.log(`Restored queue for guild ${key}`);
        } catch (error) {
            console.error(`Failed to restore queue for guild ${key}:`, error);
        }
    }
};

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                console.log(`Circular reference detected at key: ${key}`);
                return;
            }
            seen.add(value);
        }
        return value;
    };
};

process.on('exit', (code) => {
    saveQueueToFile(musicQueue);
});

process.on('beforeExit', (code) => {
    saveQueueToFile(musicQueue);
});

process.on('SIGINT', () => {
    saveQueueToFile(musicQueue);
    process.exit();
});

process.on('SIGTERM', () => {
    saveQueueToFile(musicQueue);
    process.exit();
});

process.on('SIGHUP', () => {
    saveQueueToFile(musicQueue);
    process.exit();
});

module.exports = {
    saveQueueToFile,
    loadQueueFromFile
};