const { Worker, isMainThread, parentPort } = require("worker_threads");

const language = require("../lang/commands/play");
const { getPreview, getDetails } = require("spotify-url-info")(fetch);
const proxyManager = require("./proxymanager");
const { safeReply } = require("./reply");
const { ytdlpJson, ytdlpJsonStream } = require("./ytdlp");

class WorkerPool {
    constructor(poolSize, workerPath) {
        this.poolSize = poolSize;
        this.allWorkerIds = new Set([...Array(poolSize).keys()]);
        this.workerPath = workerPath;
        this.pool = [];
        this.taskQueue = [];
        this.aliveWorker = new Set();

        this.syncInterval = setInterval(() => {
            this.syncDashboardData();
        }, 10000);
    }

    getNewWorkerId() {
        const availableIds = [...this.allWorkerIds].filter(id => !this.aliveWorker.has(id));
        if (availableIds.length === 0) return null;
        const newId = Math.min(...availableIds);
        this.aliveWorker.add(newId);
        return newId;
    }

    syncDashboardData() {
        process.dashboardData.WorkerPool.search = {
            poolSize: this.poolSize,
            allWorkerIds: [...this.allWorkerIds],
            aliveWorkers: [...this.aliveWorker],
            waitWorkers: this.pool.length,
            taskQueue: this.taskQueue.length,
        };
    }

    getWorker() {
        return new Promise((resolve, reject) => {
            this.syncDashboardData();

            if (this.pool.length > 0) {
                const worker = this.pool.pop();
                return resolve(worker);
            }

            if (this.pool.length < this.poolSize) {
                const workerId = this.getNewWorkerId();
                if (workerId !== null) {
                    const worker = new Worker(this.workerPath);
                    worker.workerId = workerId;
                    return resolve(worker);
                }
            }

            this.taskQueue.push({ resolve, reject });
        });
    }

    runStreamingTask(data, interactionOrMessage, onItem) {
        return new Promise((resolve, reject) => {
            this.getWorker().then((worker) => {
                worker.postMessage(data);
                worker.removeAllListeners("message");
                worker.removeAllListeners("error");

                worker.on("message", (msg) => {
                    if (msg.type === "getProxy") {
                        const proxy = proxyManager.getProxy();
                        worker.postMessage({ type: "proxy", proxy });
                        return;
                    }
                    if (msg.type === "backListProxy") {
                        proxyManager.blacklistProxy(msg.proxy);
                        return;
                    }
                    if (msg.content) {
                        safeReply(interactionOrMessage, msg.content, msg.ephemeral);
                        return;
                    }
                    if (msg.type === "playlist_item") {
                        onItem?.(msg.song, msg.isFirst);
                        return;
                    }
                    if (msg.type === "playlist_items") {
                        for (const song of msg.songs || []) {
                            onItem?.(song, false);
                        }
                        return;
                    }
                    if (msg.type === "playlist_done") {
                        this.pool.push(worker);
                        resolve({ addedCount: msg.addedCount, name: msg.name });
                        return;
                    }
                    resolve(msg);
                    this.pool.push(worker);
                });

                worker.on("error", async (error) => {
                    console.error(`Worker ${worker.workerId} でエラー発生:`, error);
                    reject(error);
                    this.aliveWorker.delete(worker.workerId);
                    worker.terminate();
                });
            }).catch(reject);
        });
    }

    runTask(data, interactionOrMessage, retries = 3) {
        return new Promise((resolve, reject) => {
            this.getWorker().then((worker) => {
                worker.postMessage(data);
                worker.removeAllListeners("message");
                worker.removeAllListeners("error");

                worker.on("message", (msg) => {
                    if (msg.type === "getProxy") {
                        const proxy = proxyManager.getProxy();
                        worker.postMessage({ type: "proxy", proxy });
                        return;
                    }
                    if (msg.type === "backListProxy") {
                        proxyManager.blacklistProxy(msg.proxy);
                        return;
                    }
                    if (msg.content) {
                        return safeReply(interactionOrMessage, msg.content, msg.ephemeral);
                    }
                    resolve(msg);
                    this.pool.push(worker);
                });

                worker.on("error", async (error) => {
                    console.error(`Worker ${worker.workerId} でエラー発生:`, error);

                    if (error.message.includes("401") && retries > 0) {
                        this.aliveWorker.delete(worker.workerId);
                        worker.terminate();
                        await new Promise(res => setTimeout(res, 1000));
                        return resolve(this.runTask(data, interactionOrMessage, retries - 1));
                    }

                    reject(error);
                    this.aliveWorker.delete(worker.workerId);
                    worker.terminate();
                });
            }).catch(reject);
        });
    }
}

if (isMainThread) {
    const workerPool = new WorkerPool(4, __filename);

    async function handleSongTypeWorker(stringType, songString, userId, lang, interactionOrMessage, options = {}) {
        const data = { stringType, songString, userId, lang, ...options };
        return workerPool.runTask(data, interactionOrMessage);
    }

    async function handlePlaylistWorker(songString, userId, lang, interactionOrMessage, onItem, options = {}) {
        const data = { stringType: "yt_playlist", songString, userId, lang, ...options };
        return workerPool.runStreamingTask(data, interactionOrMessage, onItem);
    }

    module.exports = { handleSongTypeWorker, handlePlaylistWorker };
} else {
    (async () => {
        async function handleSongType(stringType, songString, userId, lang, options = {}) {
            let songs = [];
            let name = "";

            switch (stringType) {
                case "yt_video":
                    ({ songs, name } = await addYouTubeVideo(songString, userId, lang, proxy));
                    break;
                case "yt_playlist":
                    ({ songs, name } = await addYouTubePlaylist(songString, userId, options.playlistMode));
                    break;
                case "search":
                    songs = await addSearchResult(songString, userId, lang);
                    break;
                case "sp_track":
                    songs = await addSpotifyTrack(songString, userId, lang);
                    break;
                case "sp_album":
                case "sp_playlist":
                case "sp_artist":
                    ({ songs, name } = await addSpotifyTrackListToQueue(songString, userId, lang));
                    break;
                case false:
                    parentPort.postMessage({ content: language.unLink[lang], ephemeral: true });
                    break;
                default:
                    parentPort.postMessage({ content: language.notSupportService[lang], ephemeral: true });
                    break;
            }

            return { addedCount: songs.length, songs, name };
        }

        async function addYouTubeVideo(songString, userId, lang, proxy) {
            try {
                const videoInfo = await ytdlpJson(songString, [], proxy);
                return {
                    songs: [{
                        title: videoInfo.title,
                        url: songString,
                        duration: videoInfo.duration,
                        requestBy: userId
                    }],
                    name: videoInfo.title
                };
            } catch (error) {
                console.error("YouTube動画の取得に失敗:", error);
                if (error.message.includes("Sign in to confirm you") && error.message.includes("not a bot")) {
                    return { songs: [], name: "singInToConfirmYouReNotABot" };
                }
                parentPort.postMessage({ content: language.notFoundVoiceChannel[lang], ephemeral: true });
                return { songs: [], name: "" };
            }
        }

        async function fetchFirstPlaylistSong(songString, userId) {
            let playlistName = "";

            const firstItemResult = await ytdlpJson(
                songString,
                ["--flat-playlist", "--playlist-start", "1", "--playlist-end", "1"],
                proxy
            );

            const firstItem = Array.isArray(firstItemResult) ? firstItemResult[0] : firstItemResult;
            if (!firstItem) return { songs: [], name: playlistName };

            playlistName = firstItem.playlist_title || firstItem.playlist || "";
            const firstUrl = firstItem.url || `https://www.youtube.com/watch?v=${firstItem.id}`;

            try {
                const info = await ytdlpJson(firstUrl, [], proxy);
                return {
                    songs: [{
                        title: info.title || firstItem.title,
                        url: firstUrl,
                        duration: info.duration || firstItem.duration || 0,
                        requestBy: userId
                    }],
                    name: playlistName
                };
            } catch {
                return {
                    songs: [{
                        title: firstItem.title,
                        url: firstUrl,
                        duration: firstItem.duration || 0,
                        requestBy: userId
                    }],
                    name: playlistName
                };
            }
        }

        async function fetchPlaylistSongs(songString, userId, { skipFirst = false } = {}) {
            let playlistName = "";
            const mappedSongs = [];

            const extraArgs = ["--flat-playlist"];
            if (skipFirst) {
                extraArgs.push("--playlist-start", "2");
            }

            await ytdlpJsonStream(songString, extraArgs, proxy, (video) => {
                if (!playlistName && video.playlist_title) playlistName = video.playlist_title;
                mappedSongs.push({
                    title: video.title,
                    url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
                    duration: video.duration || 0,
                    requestBy: userId
                });
            });

            return { songs: mappedSongs, name: playlistName };
        }

        async function addYouTubePlaylist(songString, userId, playlistMode = "bulk") {
            if (playlistMode === "first_only") {
                return fetchFirstPlaylistSong(songString, userId);
            }

            return fetchPlaylistSongs(songString, userId, {
                skipFirst: playlistMode === "skip_first"
            });
        }

        async function ytdlpSearch(query, proxy) {
            const results = await ytdlpJson(`ytsearch1:${query}`, [], proxy);
            const list = Array.isArray(results) ? results : [results];
            if (list.length === 0) return null;
            const video = list[0];
            return {
                title: video.title,
                url: video.webpage_url || `https://www.youtube.com/watch?v=${video.id}`,
                duration: video.duration || 0,
            };
        }

        async function addSearchResult(songString, userId, lang, retries = 3) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const video = await ytdlpSearch(songString, proxy);
                    if (video) return [{ ...video, requestBy: userId }];
                    parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                    return 0;
                } catch (err) {
                    console.error(`Search attempt ${attempt} failed:`, err.message);
                    if (attempt === retries) {
                        parentPort.postMessage({ content: language.notArray[lang], ephemeral: true });
                        return 0;
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }

        async function addSpotifyTrack(songString, userId, lang) {
            try {
                const spTrack = await getPreview(songString);
                const video = await ytdlpSearch(`${spTrack.title} ${spTrack.artist}`, proxy);
                if (video) return [{ ...video, requestBy: userId }];
                parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                return 0;
            } catch (err) {
                console.error("Failed to load Spotify track:", err);
                parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                return 0;
            }
        }

        async function addSpotifyTrackListToQueue(songString, userId, lang) {
            try {
                const result = await getDetails(songString);
                const name = result.preview.title;
                const tracks = result.tracks;

                if (!tracks || tracks.length === 0) return { name, songs: [] };

                const songs = await Promise.all(tracks.map(async track => {
                    const trackName = track.name;
                    const artistName = track.artists?.[0]?.name || "";
                    let video = await ytdlpSearch(`${trackName} ${artistName}`, proxy);
                    if (!video) {
                        video = await ytdlpSearch(trackName, proxy);
                    }
                    if (video) return { ...video, requestBy: userId };
                    return null;
                }));

                return { name, songs: songs.filter(Boolean) };
            } catch (err) {
                console.error("Failed to load Spotify track list:", err);
                parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                return { name: "Unknown", songs: [] };
            }
        }

        let proxy = null;
        let taskData = null;
        let retries = 0;

        parentPort.on("message", async (data) => {
            if (data.type === "proxy") {
                proxy = data.proxy;
                if (proxy !== null && proxy !== undefined) {
                    proceedTask();
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    retries++;
                    if (retries < 5) {
                        requestProxy();
                    }
                }
                return;
            }

            taskData = data;
            requestProxy();
        });

        function requestProxy() {
            parentPort.postMessage({ type: "getProxy" });
        }

        async function proceedTask() {
            const { stringType, songString, userId, lang, ...options } = taskData;

            try {
                const result = await handleSongType(stringType, songString, userId, lang, options);

                if (result.name === "singInToConfirmYouReNotABot") {
                    if (retries === 0) {
                        parentPort.postMessage({ content: language.singInToConfirmYouReNotABot[lang], ephemeral: true });
                    }
                    parentPort.postMessage({ type: "backListProxy", proxy });
                    proxy = null;
                    retries++;
                    if (retries < 5) {
                        requestProxy();
                    } else {
                        parentPort.postMessage({ error: "All proxy attempts failed." });
                    }
                    return;
                }

                parentPort.postMessage(result);
            } catch (error) {
                console.error("Worker processing error:", error);
                parentPort.postMessage({ error: error.message });
            }
        }
    })();
}
