const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const playdl = require("play-dl");
const language = require("../lang/commands/play");

const ytdl = require("@distube/ytdl-core");

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
    
                worker.on('message', (result) => {
                    if(result.content) {
                        return data.interactionOrMessage.reply({ content: result.content, ephemeral: result.ephemeral });
                    }
                    resolve(result);
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
        async function handleSongType(stringType, songString, userId, lang) {

            let songs = [];
            let name = "";
            switch (stringType) {
                case "yt_video":
                    songs = await addYouTubeVideo(songString, userId, lang);
                    break;
                case "yt_playlist":
                    songs = await addYouTubePlaylist(songString, userId, lang);
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
                case false:
                    parentPort.postMessage({ content: language.unLink[lang], ephemeral: true });
                    break;
                default:
                    parentPort.postMessage({ content: language.notSupportService[lang], ephemeral: true });
                    break;
            }
            return { addedCount: songs.length, songs, name };
        }

        async function addYouTubeVideo(songString, userId, lang) {
            try {
                // const videoInfo = await playdl.video_basic_info(songString);
                const videoInfo = await ytdl.getBasicInfo(songString);
                return [{
                    title: videoInfo.videoDetails.title,
                    url: songString,
                    duration: videoInfo.videoDetails.lengthSeconds,
                    requestBy: userId
                }];
            } catch {
                parentPort.postMessage({ content: language.notFoundVoiceChannel[lang], ephemeral: true });
                return 0;
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
            const sp_track = await playdl.spotify(songString);
            const trackName = sp_track.name;
            const sp_trackSearchResult = await playdl.search(trackName, { source: { youtube: "video" }, limit: 1, language: lang });
            if (sp_trackSearchResult.length > 0) {
                const video = sp_trackSearchResult[0];
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

        async function addSpotifyTrackListToQueue(songString, userId, lang) {
            const result = await playdl.spotify(songString);
            const name = result.name;
            const artist = result.artists && result.artists.length > 0 ? result.artists[0].name : "";
            const resultTracksList = result.fetched_tracks.get('1');
        
            if (resultTracksList && resultTracksList.length > 0) {
                const firstTrack = resultTracksList[0];
                const firstTrackName = firstTrack.name;
                const firstSearchResult = await playdl.search(firstTrackName + ' ' + artist, { source: { youtube: "video" }, limit: 1, language: lang });
        
                if (firstSearchResult.length > 0) {
                    const firstVideo = firstSearchResult[0];
                    const songs = [{
                        title: firstVideo.title,
                        url: firstVideo.url,
                        duration: firstVideo.durationInSec,
                        requestBy: userId
                    }];
        
                    const trackPromises = resultTracksList.slice(1).map(async spotifyTrack => {
                        const trackName = spotifyTrack.name;
                        let searchResult = await playdl.search(trackName + ' ' + artist, { source: { youtube: "video" }, limit: 1, language: lang });
        
                        if (searchResult.length === 0) {
                            console.log(`No results found for track: ${trackName} by artist: ${artist}, retrying without artist`);
                            searchResult = await playdl.search(trackName, { source: { youtube: "video" }, limit: 1, language: lang });
                        }

                        if (searchResult.length > 0) {
                            const video = searchResult[0];
                            return {
                                title: video.title,
                                url: video.url,
                                duration: video.durationInSec,
                                requestBy: userId
                            };
                        }
        
                        return null;
                    });
        
                    const tracks = await Promise.all(trackPromises);
                    const validTracks = tracks.filter(track => track !== null);
                    songs.push(...validTracks);
                    return { name, songs };
                } else {
                    parentPort.postMessage({ content: language.aNotHit[lang](firstTrackName), ephemeral: true });
                    return { name, songs: [] };
                }
            }
            return { name, songs: [] };
        }        

        try {
            parentPort.on("message", async (data) => {
                const { stringType, songString, userId, lang, interactionOrMessage } = data;
                const result = await handleSongType(stringType, songString, userId, lang, interactionOrMessage);
                parentPort.postMessage(result);
            });
        } catch (error) {
            console.error("Worker processing error:", error);
            parentPort.postMessage({ error: error.message });
        }
    })();
}