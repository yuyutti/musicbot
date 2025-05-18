const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const playdl = require("play-dl");

const language = require("../lang/commands/play");
const { getData, getPreview, getTracks, getDetails } = require('spotify-url-info')(fetch)
const ytdl = require("@distube/ytdl-core");
const proxyManager = require("./proxymanager");

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

    // ワーカー取得
    getWorker() {
        return new Promise((resolve, reject) => {
            this.syncDashboardData();

            if (this.pool.length > 0) {
                const worker = this.pool.pop();
                resolve(worker);
            }

            else if (this.pool.length < this.poolSize) {
                const workerId = this.getNewWorkerId();
                if (workerId !== null) {
                    const worker = new Worker(this.workerPath);
                    worker.workerId = workerId;
                    return resolve(worker);
                }
            }

            else {
                this.taskQueue.push({ resolve, reject });
            }
        });
    }

    // タスク実行
    runTask(data, retries = 3) {
        return new Promise((resolve, reject) => {
            this.getWorker().then((worker) => {
                worker.postMessage(data);
                worker.removeAllListeners('message');
                worker.removeAllListeners('error');
    
                worker.on('message', (msg) => {
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
                        return data.interactionOrMessage.reply({ content: msg.content, ephemeral: msg.ephemeral });
                    }
                    resolve(msg);
                    this.pool.push(worker);
                });
    
                worker.on('error', async (error) => {
                    console.error(`Worker ${worker.workerId} でエラー発生:`, error);
    
                    if (error.message.includes("401") && retries > 0) {
                        console.log(`再試行します... 残り回数: ${retries}`);
                        this.aliveWorker.delete(worker.workerId);
                        worker.terminate();
                        
                        await new Promise(res => setTimeout(res, 1000)); 
                        return resolve(this.runTask(data, retries - 1));
                    }
    
                    reject(error);
                    this.aliveWorker.delete(worker.workerId);
                    worker.terminate();
                });
    
            }).catch(reject);
        });
    }    
}

// メインスレッド側の処理
if (isMainThread) {
    const workerPool = new WorkerPool(4, __filename);

    async function handleSongTypeWorker(stringType, songString, userId, lang, interactionOrMessage) {
        const data = { stringType, songString, userId, lang, interactionOrMessage };
        return workerPool.runTask(data);
    }

    module.exports = { handleSongTypeWorker };
}
else {
    (async () => {
        async function handleSongType(stringType, songString, userId, lang, agent) {

            let songs = [];
            let name = "";

            switch (stringType) {
                case "yt_video":
                    ({ songs, name } = await addYouTubeVideo(songString, userId, lang, agent));
                    break;
                case "yt_playlist":
                    songs= await addYouTubePlaylist(songString, userId, lang);
                    break;
                case "search":
                    songs = await addSearchResult(songString, userId, lang);
                    break;
                case "sp_track":
                    songs = await addSpotifyTrack(songString, userId, lang);
                    break;
                case "sp_album":
                    ({ songs, name } = await addSpotifyTrackListToQueue(songString, userId, lang));
                    break;
                case "sp_playlist":
                    ({ songs, name } = await addSpotifyTrackListToQueue(songString, userId, lang));
                    break;
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

        async function addYouTubeVideo(songString, userId, lang, agent) {
            try {
                const videoInfo = await ytdl.getBasicInfo(songString, { agent });
                return { songs: [{
                    title: videoInfo.videoDetails.title,
                    url: songString,
                    duration: videoInfo.videoDetails.lengthSeconds,
                    requestBy: userId
                }], name: videoInfo.videoDetails.title };
            } catch(error) {
                console.error("YouTube動画の取得に失敗:", error);
                if(error.message.includes("Sign in to confirm you’re not a bot")) {
                    return { songs: [], name: "singInToConfirmYouReNotABot" };
                }
                parentPort.postMessage({ content: language.notFoundVoiceChannel[lang], ephemeral: true });
                return { songs: [], name: "" };
            }
        }

        async function addYouTubePlaylist(songString, userId, lang) {
            const playlistInfo = await playdl.playlist_info(songString, { incomplete: true, language: lang });
            return playlistInfo.videos.map(video => ({
                title: video.title,
                url: video.url,
                duration: video.durationInSec,
                requestBy: userId
            }));
        }

        async function addSearchResult(songString, userId, lang) {
            const searchResult = await playdl.search(songString, { source: { youtube: "video" }, limit: 1, language: lang });
            if (searchResult.length > 0) {
                const video = searchResult[0];
                return [{
                    title: video.title,
                    url: video.url,
                    duration: video.durationInSec,
                    requestBy: userId
                }];
            }
            else {
                parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                return 0;
            }
        }

        async function addSpotifyTrack(songString, userId, lang) {
            try {
                const spTrack = await getPreview(songString);
                const trackName = spTrack.title;
                const artistName = spTrack.artist;
        
                const ytQuery = `${trackName} ${artistName}`;
                const sp_trackSearchResult = await playdl.search(ytQuery, {
                    source: { youtube: "video" },
                    limit: 1,
                    language: lang
                });
        
                if (sp_trackSearchResult.length > 0) {
                    const video = sp_trackSearchResult[0];
                    return [{
                        title: video.title,
                        url: video.url,
                        duration: video.durationInSec,
                        requestBy: userId
                    }];
                } else {
                    parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                    return 0;
                }
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
                    let ytResult = await playdl.search(`${trackName} ${artistName}`, {
                        source: { youtube: "video" },
                        limit: 1,
                        language: lang
                    });
        
                    if (ytResult.length === 0) {
                        console.log(`No results for ${trackName}, retrying...`);
                        ytResult = await playdl.search(trackName, {
                            source: { youtube: "video" },
                            limit: 1,
                            language: lang
                        });
                    }
        
                    if (ytResult.length > 0) {
                        const video = ytResult[0];
                        return {
                            title: video.title,
                            url: video.url,
                            duration: video.durationInSec,
                            requestBy: userId
                        };
                    }
        
                    return null;
                }));
        
                return { name, songs: songs.filter(s => s !== null) };
            } catch (err) {
                console.error("Failed to load Spotify track list:", err);
                parentPort.postMessage({ content: language.notHit[lang], ephemeral: true });
                return { name: 'Unknown', songs: [] };
            }
        }

        let proxy = null;
        let taskData = null;
        let agent = null;
        let retries = 0;

        parentPort.on("message", async (data) => {
            if (data.type === "proxy") {
                proxy = data.proxy;
                if (proxy !== null && proxy !== undefined) {
                    proceedTask();
                } else {
                    console.log(`No proxy received. Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    retries++;
                    console.log(`Retrying... Attempt: ${retries}`);
                    if (retries < 5) {
                        requestProxy();
                    }
                }
                return;
            }
        
            // 最初のリクエストデータを保持
            taskData = data;
            requestProxy(); // プロキシ取りに行く
        });
        
        function requestProxy() {
            parentPort.postMessage({ type: "getProxy" });
        }
        
        async function proceedTask() {
            const { stringType, songString, userId, lang, interactionOrMessage } = taskData;
        
            try {
                if (proxy) {
                    agent = ytdl.createProxyAgent({ uri: proxy });
                }
                result = await handleSongType(stringType, songString, userId, lang, agent, interactionOrMessage);

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