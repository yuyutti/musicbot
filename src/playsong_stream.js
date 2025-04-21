require('global-agent/bootstrap');
const https = require('https');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

process.on('message', async (msg) => {
    if (msg.type !== "getStream") return;

    const { song, LiveItag, seekPosition, vcSize, filter, currentFilter, guildName } = msg;

    https.get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            process.send({ type: "log", message: `IP Address: ${JSON.parse(data).ip}` });
        });
        }).on('error', (err) => {
            process.send({ type: "log", message: `Error fetching IP address: ${err.message}` });
        });

    let currentItagList = []
    let retries = 3;
    let delayMs = 1500;
    let attemptCount = 0;

    while (attemptCount < retries) {
        try {
            attemptCount++;
            process.send({ type: "logger", message: `Playing song (Attempt ${attemptCount}): ${song.title}` });

            const defaultItagList = [251, 250, 249, 18, 93, 94, 92, 91, 140];
            if (!currentItagList) {
                currentItagList = [...defaultItagList];
            }

            const info = await ytdl.getInfo(song.url);
            const formats = info.formats;

            while (currentItagList.length > 0) {
                const currentItag = currentItagList[0];
                process.send({ type:"itag", itag: currentItag });
                
                const format = formats.find(f => f.itag === currentItag);
                if (!format) {
                    currentItagList.shift();
                    process.send({ type: "itagList", itagList: currentItagList });
                    continue;
                }
                
                try {
                    const stream = ytdl(song.url, {
                        quality: currentItag,
                        highWaterMark: 1 << 28,
                        dlChunkSize: LiveItag.includes(currentItag) ? 1024 * 1024 * 75 : undefined
                    });
                    process.send({ type: "stream", stream: stream });
                    currentItagList = [...defaultItagList];

                    let serverQueue_filter

                    if (currentFilter === 'auto') {
                        serverQueue_filter = filter
                            .filter(f => f.auto)
                            .sort((a, b) => a.minVCSize - b.minVCSize)
                            .find(f => vcSize <= f.minVCSize);
                    } else {
                        serverQueue_filter = filter.find(f => f.value === currentFilter);
                        if (!serverQueue_filter) {
                            serverQueue_filter = filter
                                .filter(f => f.auto)
                                .sort((a, b) => a.minVCSize - b.minVCSize)
                                .find(f => vcSize <= f.minVCSize);
                        }
                        else {
                            serverQueue_filter.auto = false;
                        }
                    }

                    process.send({ type: "filter", filter: serverQueue_filter });

                    const ffmpegStream = ffmpeg(stream)
                        .setStartTime(seekPosition)
                        .noVideo()
                        .audioFilters(serverQueue_filter.filter)
                        .audioFrequency(48000)
                        .outputOptions([
                            '-reconnect_at_eof', '1',
                            '-reconnect_streamed', '1',
                            '-fflags', '+genpts',
                            '-loglevel', 'info',
                        ])
                        .format('opus')
                        .on('stderr', (stderr) => {
                            process.send({ type: "log", message: `FFmpeg stdout: ${stderr}` });
                        })
                        .on('error', (error) => {
                            if (error.message.includes('Sign in to confirm your age')) {
                                process.send({ type: "handleStreamError", isAgeRestricted: true })
                                process.exit(1);
                            }
                            if (error.message.includes('SIGKILL')) return;
                            if (error.message.includes('Output stream error: Premature close')) return;
                            if (error.message.includes('Status code: 403')) {
                                process.send({ type: "replaySong" })
                                process.exit(1);
                            }
                            if (error.message.includes('ffmpeg exited with code 1')) {
                                currentItagList.shift();
                                process.send({ type: "itagList", itagList: currentItagList });
                                process.send({ type: "replaySong" })
                                process.exit(1);
                            }
                            if (error.message.includes('No such format found')) {
                                currentItagList.shift();
                                process.send({ type: "itagList", itagList: currentItagList });
                                process.send({ type: "replaySong" })
                                process.exit(1);
                            }
                            if (error.message.includes('ECONNRESET')) {
                                currentItagList.shift();
                                process.send({ type: "itagList", itagList: currentItagList });
                                process.send({ type: "replaySong" })
                                process.exit(1);
                            }
                            process.send({ type: "error", message: `**${guildName}**でFFmpegエラーが発生しました\n\`\`\`${error}\`\`\``});
                        })
                        .pipe(process.stdout);

                        ffmpegStream.on('end', () => {
                            process.exit(0);
                        });
                        ffmpegStream.on('close', () => {
                            process.exit(0);
                        });
                } catch (err) {
                    process.send({ type: "logger", message: `itag ${currentItag} の stream に失敗しました: ${err.message}` });
                    currentItagList.shift();
                    process.send({ type: "itagList", itagList: currentItagList });
                    continue;
                }
            }

        } catch (error) {
            process.send({ type: "error", message: `Error while fetching stream for ${song.title}: ${error.message}` });
            if (error.message.includes('Sign in to confirm your age')) {
                process.send({ type: "handleStreamError", isAgeRestricted: true })
                process.exit(1);
            }
            if (error.message.includes('Sign in to confirm you’re not a bot')) {
                // IPを帰るってことができないんよね...
            }

            if (attemptCount === retries) {
                process.send({ type: "handleStreamError", isAgeRestricted: false})
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
});
