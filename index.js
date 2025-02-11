const WorkerManager = require("./worker/WorkerManager");

// Worker の ID リスト
const workerIds = ["command", "discord", "streaming", "search", "sql", "logger"];

// WorkerManager のインスタンスを作成（workerIds を渡す）
const workerManager = new WorkerManager(workerIds);

// **テスト用: `command` と `discord` に `init` を送る**
setTimeout(() => {
    workerManager.broadcastMessage("command,discord", { action: "init", message: "システムを開始" });
}, 2000);
