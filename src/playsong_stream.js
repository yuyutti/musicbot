const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

let ffmpegProcess = null;

process.on('message', async (msg) => {
    if (msg.type === "kill") process.exit(0);
    if (msg.type !== "getStream") return;

    const { song, LiveItag, seekPosition, vcSize, filter, filterList, currentFilter, guildName, itag, proxy } = msg;

    let agent = null;
    if (proxy) {
        agent = ytdl.createProxyAgent({ uri: proxy });
    }
    
    let currentItagList = [];
    let currentItag = 0;
    let retries = 3;
    let delayMs = 6000;
    let attemptCount = 0;

    // const VIDMap = {
    //     "ZFoJYI7Q4iA": "dlFA0Zq1k2A"
    // }
    // const videoID = song.url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    // song.url = videoID && VIDMap[videoID] ? `https://www.youtube.com/watch?v=${VIDMap[videoID]}` : song.url;

    while (attemptCount < retries) {
        try {
            attemptCount++;
            process.send({ type: "logger", message: `Playing song (Attempt ${attemptCount}): ${song.title}` });

            // const defaultItagList = [251, 18, 250, 249, 93, 94, 92, 91, 140];
            const defaultItagList = [18];
            if (currentItagList.length === 0) {
                currentItagList = [...defaultItagList];
            }
            process.send({ type: "log", message: "YouTubeからの情報取得しています" });

            const info = await ytdl.getInfo(song.url, { agent });
            const formats = info.formats;
            process.send({ type: "log", message: `YouTubeからの情報取得が完了しました` });
            process.send({ type: "ytdlok" });

            while (currentItagList.length > 0) {                
                try {
                    currentItag = currentItagList[0];
                    process.send({ type: "itag", itag: currentItag });

                    const format = formats.find(f => f.itag === currentItag);
                    
                    if (!format) {
                        currentItagList.shift();
                        process.send({ type: "itagList", itagList: currentItagList });
                        continue;
                    }

                    process.send({ type: "log", message: `itag ${currentItag} の stream を取得中...` });
                    const stream = ytdl.downloadFromInfo(info, {
                        format,
                        agent,
                        highWaterMark: 1 << 25,
                        dlChunkSize: 1 << 20
                    });

                    stream.once('response', (res) => {
                        process.send({ type: "log", message: `ytdl response ${res.statusCode}` });
                        if (res.statusCode !== 200 && res.statusCode !== 206) {
                            process.send({ type: "replaySong" });
                            return;
                        }
                    });

                    currentItagList = [...defaultItagList];
                    let serverQueue_filter;

                    if (currentFilter === 'auto') {
                        serverQueue_filter = filterList
                            .filter(f => f.auto)
                            .sort((a, b) => a.minVCSize - b.minVCSize)
                            .find(f => vcSize <= f.minVCSize);
                    } else {
                        serverQueue_filter = filterList.find(f => f.value === currentFilter);
                        if (!serverQueue_filter) {
                            serverQueue_filter = filterList
                                .filter(f => f.auto)
                                .sort((a, b) => a.minVCSize - b.minVCSize)
                                .find(f => vcSize <= f.minVCSize);
                        } else {
                            serverQueue_filter.auto = false;
                        }
                    }

                    process.send({ type: "filter", filter: serverQueue_filter });

                    const CHUNK_LIMIT = 1 * 1024 * 1024;
                    let totalReceivedBytes = 0;
                    let currentReceivedBytes = 0;

                    function formatBytes(bytes) {
                        if (bytes >= 1024 * 1024 * 1024) {
                            return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
                        } else if (bytes >= 1024 * 1024) {
                            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
                        } else if (bytes >= 1024) {
                            return (bytes / 1024).toFixed(2) + ' KB';
                        }
                        return bytes + ' B';
                    }
                    
                    stream.on('data', chunk => {
                        // youtubeでダウンロードされたstream量を測定
                        const chunkSizeInBytes = Buffer.byteLength(chunk);
                        const chunkSizeInKB = chunkSizeInBytes / 1024;
                        process.send({ type: "downloading", size: chunkSizeInKB });
                        
                        totalReceivedBytes += chunk.length;
                        currentReceivedBytes += chunk.length;
                    
                        if (currentReceivedBytes >= CHUNK_LIMIT) {
                            const formattedSize = formatBytes(totalReceivedBytes);
                            process.send({
                                type: 'log',
                                message: `Accumulated data: ${formattedSize}`
                            });
                            currentReceivedBytes = 0;
                        }
                    });
                    
                    stream.on('end', () => {
                        if (totalReceivedBytes > 0) {
                            const formattedSize = formatBytes(totalReceivedBytes);
                            process.send({
                                type: 'log',
                                message: `Final accumulated data: ${formattedSize}`
                            });
                        }
                    });
                                        
                    stream.on('error', (err) => {
                        process.send({ type: 'log', message: `Stream error: ${err.message}` });
                        if (err.message.includes("403")) {
                            process.send({ type: "handleStreamError", isAgeRestricted: false });
                            return process.send({ type: 'error', message: 'stream 403' });
                        }
                        if (err.message.includes("Invalid format given, did you use")) {
                            process.send({ type: "itagList", itagList: currentItagList });
                            process.send({ type: "replaySong" });
                            return process.send({ type: 'error', message: 'invalid format' });
                        }
                        return process.send({ type: 'error', message: err.message });
                    });

                    process.send({ type: "log", message: `itag ${currentItag} の stream を取得しました` });

                    ffmpegProcess = ffmpeg(stream)
                        .setStartTime(seekPosition)
                        .noVideo()
                        .audioFilters(serverQueue_filter.filter)
                        .audioFrequency(48000)
                        .inputOptions([
                            '-thread_queue_size', '1024',
                            '-analyzeduration', '0',
                            '-probesize', '32',
                            '-fflags', 'nobuffer',
                            '-flags', 'low_delay',
                        ])
                        .outputOptions([
                            '-c:a', 'libopus',
                            '-reconnect_at_eof', '1',
                            '-reconnect_streamed', '1',
                            '-reconnect_on_network_error', '1',
                            '-fflags', '+genpts',
                            '-loglevel', 'info',
                        ])
                        .format('opus');

                    process.send({ type: "ready" });

                    ffmpegProcess
                        .on('start', () => {
                            process.send({ type: "log", message: "FFmpeg started" });
                        })
                        .on('end', () => {
                            process.send({ type: "done", data: { ok: true } });
                        })
                        .on('stderr', (stderr) => {
                            process.send({ type: "log", message: `FFmpeg stdout: ${stderr}` });
                        })
                        .on('error', (error) => {
                            if (error.message.includes('Sign in to confirm your age')) {
                                process.send({ type: "handleStreamError", isAgeRestricted: true });
                            }
                            if (error.message.includes('SIGKILL')){
                                process.send({ type: "replaySong" });
                            }
                            if (error.message.includes('Output stream error: Premature close')) {
                                process.send({ type: "replaySong" });
                            }
                            if (error.message.includes('Status code: 403')) {
                                process.send({ type: "replaySong" });
                            }
                            if (error.message.includes('ffmpeg exited with code 1')) {
                                currentItagList.shift();
                                process.send({ type: "itagList", itagList: currentItagList });
                                process.send({ type: "replaySong" });
                            }
                            if (error.message.includes('No such format found')) {
                                currentItagList.shift();
                                process.send({ type: "itagList", itagList: currentItagList });
                                process.send({ type: "replaySong" });
                            }
                            if (error.message.includes('ECONNRESET')) {
                                currentItagList.shift();
                                process.send({ type: "itagList", itagList: currentItagList });
                                process.send({ type: "replaySong" });
                            }
                            process.send({ type: "error", message: `**${guildName}**でFFmpegエラーが発生しました\n\`\`\`${error}\`\`\`` });
                        });

                    const outputStream = ffmpegProcess.pipe(process.stdout, { end: true });

                    await new Promise((resolve, reject) => {
                        outputStream.once('end', () => {
                            process.send({ type: "log", message: '✅ FFmpeg finished' });
                            resolve();
                        });
                    
                        outputStream.once('close', () => {
                            process.send({ type: "log", message: '📴 FFmpeg closed' });
                            resolve();
                        });
                    
                        outputStream.once('error', (error) => {
                            process.send({ type: "log", message: `❌ FFmpeg error: ${error.message}` });
                            reject(error);
                        });
                    
                        ffmpegProcess.once('exit', (code) => {
                            process.send({ type: "log", message: `FFmpegプロセスがコード ${code} で終了しました` });
                            resolve();
                        });
                    });

                    process.send({ type: "log", message: `FFmpeg での変換が完了しました` });
                } catch (err) {
                    process.send({ type: "logger", message: `itag ${currentItag} の stream に失敗しました: ${err.message}` });
                    currentItagList.shift();
                    process.send({ type: "itagList", itagList: currentItagList });
                    process.send({ type: 'error', message: `itag try failed: ${err.message}` });
                }
            }

        } catch (error) {
            process.send({ type: "logger", message: `Error while fetching stream for ${song.title}: ${error.message}` });
            if (error.message.includes('Sign in to confirm your age')) {
                process.send({ type: "handleStreamError", isAgeRestricted: true });
            }

            if (error.message.includes('Video unavailable')) {
                process.send({ type: "unavailable" });
            }

            if (error.message.includes('Sign in to confirm you’re not a bot')) {
                process.send({ type: "singInToConfirmYouReNotABot" });
            }

            if (attemptCount === retries) {
                process.send({ type: "handleStreamError", isAgeRestricted: false });
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
});

process.on('SIGINT', () => {
    process.send({ type: "log", message: 'SIGINTを受け取りました。終了します。' });
    try { ffmpegProcess?.kill('SIGINT'); } catch {}
});

process.on('uncaughtException', err =>
    process.send({ type: 'log', message: `⚠️ uncaughtException: ${err.stack}` })
);
process.on('unhandledRejection', (reason, p) =>
    process.send({ type: 'log', message: `⚠️ unhandledRejection: ${reason}` })
);