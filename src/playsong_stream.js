const path = require("path");
const { spawn } = require("child_process");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const ytdlpPath = path.join(
    __dirname,
    "..",
    "yt-dlp",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp_linux"
);

let ffmpegProcess = null;

process.on('message', async (msg) => {
    if (msg.type === "kill") process.exit(0);
    if (msg.type !== "getStream") return;

    const { song, seekPosition, vcSize, filterList, currentFilter, guildName, proxy } = msg;

    let retries = 3;
    let delayMs = 6000;
    let attemptCount = 0;

    while (attemptCount < retries) {
        try {
            attemptCount++;
            process.send({ type: "logger", message: `Playing song (Attempt ${attemptCount}): ${song.title}` });

            process.send({ type: "log", message: "yt-dlpでストリーム取得中..." });

            // =========================
            // yt-dlp
            // =========================
            const ytdlpArgs = [
                "-f", "bestaudio",
                "-o", "-",
                "--quiet",
                "--no-warnings",
                song.url
            ];

            if (proxy) {
                ytdlpArgs.unshift("--proxy", proxy);
            }

            const ytdlp = spawn(ytdlpPath, ytdlpArgs, {
                stdio: ["ignore", "pipe", "pipe"]
            });

            let ytdlpStderr = '';
            ytdlp.stderr.on("data", (d) => {
                ytdlpStderr += d.toString();
                process.send({ type: "log", message: `yt-dlp: ${d.toString()}` });
            });

            ytdlp.on("close", (code) => {
                if (code !== 0) {
                    if (ytdlpStderr.includes('Sign in to confirm')) {
                        process.send({ type: "singInToConfirmYouReNotABot" });
                    } else {
                        process.send({ type: "error", message: `yt-dlp exited with code ${code}: ${ytdlpStderr.trim()}` });
                    }
                }
            });

            process.send({ type: "ytdlok" });

            // =========================
            // フィルター決定
            // =========================
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

            // =========================
            // ffmpeg
            // =========================
            ffmpegProcess = ffmpeg(ytdlp.stdout)
                .setStartTime(seekPosition)
                .noVideo()
                .audioFilters(serverQueue_filter.filter)
                .audioFrequency(48000)
                .inputOptions([
                    '-thread_queue_size', '512',
                ])
                .outputOptions([
                    '-c:a', 'libopus',
                    '-b:a', '128k',
                    '-application', 'audio',
                    '-frame_duration', '20',
                    '-loglevel', 'error',
                ])
                .format('ogg');

            ffmpegProcess
                .on('start', (cmd) => {
                    process.send({ type: "log", message: `[ffmpeg] started: ${cmd}` });
                    process.send({ type: "ready" });
                })
                .on('end', () => {
                    process.send({ type: "log", message: "[ffmpeg] end" });
                    process.send({ type: "done", data: { ok: true } });
                })
                .on('stderr', (stderr) => {
                    process.send({ type: "log", message: `[ffmpeg stderr] ${stderr}` });
                })
                .on('error', (error) => {
                    if (error.message.includes('SIGKILL')) {
                        process.send({ type: "replaySong" });
                    }
                    process.send({
                        type: "error",
                        message: `**${guildName}**でFFmpegエラー\n\`\`\`${error}\`\`\``
                    });
                });

            const outputStream = ffmpegProcess.pipe(process.stdout, { end: true });

            let firstOutputChunk = false;
            outputStream.on('data', (d) => {
                if (!firstOutputChunk) {
                    firstOutputChunk = true;
                    process.send({ type: "log", message: `[ffmpeg] 最初の出力チャンク size=${d.length}` });
                }
            });

            await new Promise((resolve, reject) => {
                outputStream.once('end', resolve);
                outputStream.once('close', resolve);
                outputStream.once('error', reject);
            });

            process.send({ type: "log", message: `FFmpeg 完了` });

        } catch (error) {
            process.send({ type: "logger", message: `Error: ${error.message}` });

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
    try { ffmpegProcess?.kill('SIGINT'); } catch {}
});

process.on('uncaughtException', err =>
    process.send({ type: 'log', message: `uncaughtException: ${err.stack}` })
);

process.on('unhandledRejection', (reason) =>
    process.send({ type: 'log', message: `unhandledRejection: ${reason}` })
);
