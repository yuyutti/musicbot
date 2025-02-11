const { Worker, BroadcastChannel } = require('worker_threads');

class WorkerManager {
    constructor(workerIds) {
        this.allWorkerIds = new Set([...workerIds]);
        this.aliveWorkerIds = new Set();
        this.Workers = {};
        this.broadcast = new BroadcastChannel('mainChannel');

        this.initWorkers();
    }

    initWorkers() { // Workerの初期化
        this.allWorkerIds.forEach((id) => this.createWorker(id));
    }

    createWorker(id) { // Workerの生成
        if (this.Workers[id]) {
            console.error(`[${id}] はすでに存在します`);
            return;
        }
    
        const worker = new Worker(`./Worker${id.charAt(0).toUpperCase() + id.slice(1)}.js`);

        worker.on("message", (msg) => {
            console.log(`[${id}] からのメッセージ:`, msg);
            if (msg.status === "ready") {
                this.aliveWorkerIds.add(id);
            }
        });

        worker.on("error", (err) => {
            console.error(`[${id}] でエラー発生:`, err);
            this.restartWorker(id);
        });

        worker.on("exit", (code) => {
            console.log(`[${id}] が終了しました (コード: ${code})`);
            this.aliveWorkerIds.delete(id); // 生存リストから削除
            this.restartWorker(id);
        });

        this.Workers[id] = worker;
        console.log(`[${id}] が起動しました`);

    }

    restartWorker(id) { // Workerの再起動
        console.log(`[${id}] を再起動します`);
        this.terminateWorker(id);
        this.createWorker(id);
    }

    terminateWorker(id) {
        if (this.Workers[id]) {
            this.Workers[id].terminate();
            delete this.Workers[id];
        }
    }
    
    broadcastMessage(targets, data) { // Workerへのメッセージ送信
        this.broadcast.postMessage({ ...data, target: targets });
    }
}

module.exports = WorkerManager;