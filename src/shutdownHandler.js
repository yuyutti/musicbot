const { createAudioPlayer, NoSubscriberBehavior } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const { queue: musicQueue } = require('./musicQueue');
const { commandStatus } = require('../events/event');
const { volume, lang, removeWord, filter } = require('../SQL/lockup');

const { playSong } = require('./playsong');
const queueFilePath = path.join(__dirname, '..','serverQueue.json');
const language = require('../lang/src/shutdownHandler');

const { shutdownActivity } = require('./activity');

const loadQueueFromFile = async (client) => {
    if (!fs.existsSync(queueFilePath)) {
        console.log('Queue file does not exist.');
        return;
    }
    const data = fs.readFileSync(queueFilePath);
    const queueData = JSON.parse(data);
    console.log('Loaded queue data from file');

    for (const [key, value] of queueData) {
        if (!value.guildId) {
            console.error(`Invalid guildId for key ${key}`);
            continue;
        }

        try {
            const guild = await client.guilds.cache.get(value.guildId);
            const voiceChannel = await guild.channels.cache.get(value.voiceChannel.id);
            const textChannel = await guild.channels.cache.get(value.textChannel.id);
            if (!voiceChannel || !textChannel) {
                console.error(`Failed to find voice or text channel for guild ${key}`);
                continue;
            }
            const botMember = voiceChannel.members.get(client.user.id);
            const nonBotMembers = voiceChannel.members.filter(m => !m.user.bot);
            if (!botMember || nonBotMembers.size === 0) {
                console.log(`Skipping guild ${value.guildId}: Only bots in the voice channel.`);
                continue;
            }
            const serverQueue = {
                textChannel: textChannel,
                playingMessage: null,
                voiceChannel: voiceChannel,
                connection: null,
                moveVc: false,
                guildName: value.guildName,
                guildId: value.guildId,
                language: await lang(value.guildId) || 'en',
                removeWord: await removeWord(value.guildId) || false,
                filter: await filter(value.guildId) || 'auto',
                loop: value.loop,
                autoPlay: value.autoPlay,
                pause: value.pause,
                volume: await volume(value.guildId) || 10,
                IdolStop: value.IdolStop,
                pauseTimeout: null,
                commandStatus: new commandStatus(),
                editTimeout: null,
                songs: value.songs,
                ffmpegProcess: null,
                itag: null,
                itagList: null,
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
                    start: value.time.start,
                    end: value.time.end, 
                    current: value.time.current, 
                    interval: null 
                },
                game: value.game
            };
            musicQueue.set(key, serverQueue);
            playSong(value.guildId, serverQueue.songs[0]);
            textChannel.send(language.reconnected[serverQueue.language]);
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

const saveQueueToFile = async(queue) => {
    console.log('Saving queue to file...');
    await shutdownActivity();  // 非同期関数を待機

    const queueCopy = new Map(
        Array.from(queue.entries())
        .map(([key, value]) => {
            const { textChannel, voiceChannel, guildName, guildId, loop, autoPlay, pause, IdolStop, songs, time, game } = value;
            return [key, { textChannel, voiceChannel, guildName, guildId, loop, pause, autoPlay, IdolStop, songs, time: { start: time.start, end: time.end, current: time.current }, game }];
        })
    );

    fs.writeFileSync(queueFilePath, JSON.stringify(Array.from(queueCopy.entries()), getCircularReplacer(), 4));
    console.log('Queue saved successfully.');
};

let shutdownInitiated = false;

const handleShutdown = async (signal) => {
    if (!shutdownInitiated) {
        shutdownInitiated = true;
        console.log(`${signal} received, shutting down...`);
        await saveQueueToFile(musicQueue);  // 非同期関数を待機
        process.exit();
    }
};

// 各シグナルに対してシャットダウンハンドラを設定
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
    process.on(signal, () => handleShutdown(signal));
});

// 他のプロセス終了イベントにも対応
process.on('exit', (code) => {
    if (!shutdownInitiated) {
        handleShutdown('exit');
    }
});

module.exports = {
    saveQueueToFile,
    loadQueueFromFile
};