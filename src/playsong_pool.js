// playsong_pool.js
const { fork } = require('child_process');
const path = require('path');

class ForkPool {
    /**
     * @param {object} opt
     * @param {string} opt.workerPath  - 子プロセスのパス
     * @param {string} [opt.name="stream"] - ダッシュボード表示名（例: "stream"）
     * @param {number} [opt.warmMin=2] - 常にキープしたい idle ワーカー数（minIdle）
     * @param {number|null} [opt.hardMax=null] - 総数の上限（null で無制限）
     * @param {number} [opt.idleTtlMs=60*60*1000] - アイドルTTL
     */
    constructor({ workerPath, name = 'stream', warmMin = 2, hardMax = null, idleTtlMs = 60 * 60 * 1000 }) {
        this.workerPath = path.resolve(workerPath);
        this.name = name;
        this.warmMin = Math.max(0, warmMin);   // = minIdle ターゲット
        this.hardMax = hardMax;                // 総数の安全上限
        this.idleTtlMs = idleTtlMs;

        this.idle = [];         // 待機中の child（配列: LIFO）
        this.busy = new Set();  // 稼働中の child
        this.alive = new Set(); // 生存中の child（busy + idle）

        // ダッシュボードの初期器
        if (!process.dashboardData) process.dashboardData = {};
        if (!process.dashboardData.WorkerPool) process.dashboardData.WorkerPool = {};

        // まず minIdle を満たすまで spawn
        for (let i = 0; i < this.warmMin; i++) this._spawn();

        this._publish();
    }

    // ====== public: 状態をざっと返したい時に使える ======
    stats() {
        return {
            counts: {
                alive: this.alive.size,
                busy: this.busy.size,
                idle: this.idle.length,
            },
            targets: {
                minIdle: this.warmMin,
                hardMax: this.hardMax,
                idleTtlMs: this.idleTtlMs,
            },
        };
    }

    // ====== internal: ダッシュボード更新 ======
    _publish() {
        const name = this.name || 'stream';
        const allWorkers  = Array.from(this.alive);
        const busyWorkers = Array.from(this.busy);
        const idleWorkers = this.idle.filter(c => !this.busy.has(c));

        const pidAll  = allWorkers.map(c => c.pid);
        const pidBusy = busyWorkers.map(c => c.pid);
        const pidIdle = idleWorkers.map(c => c.pid);

        const widAll  = allWorkers.map(c => c._wid);
        const widBusy = busyWorkers.map(c => c._wid);
        const widIdle = idleWorkers.map(c => c._wid);

        process.dashboardData.WorkerPool[name] = {
            counts: {
                alive: this.alive.size,
                busy : this.busy.size,
                idle : idleWorkers.length,
            },
            targets: { minIdle: this.warmMin, hardMax: this.hardMax, idleTtlMs: this.idleTtlMs },
            lists: {
                pids: { all: pidAll, busy: pidBusy, idle: pidIdle },
                wids: { all: widAll, busy: widBusy, idle: widIdle },
            },
        };
    }

    _spawn(envOverride = {}) {
        if (this.hardMax != null && this.alive.size >= this.hardMax) {
            throw new Error(`Hard max (${this.hardMax}) reached`);
        }
        const child = fork(this.workerPath, [], {
            execArgv: [],
            serialization: 'advanced',
            env: { ...process.env, ...envOverride },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });

        // ワーカーIDっぽいもの（連番）
        if (typeof this._widSeq !== 'number') this._widSeq = 0;
        child._wid = this._widSeq++;

        child._alive = true;
        child._idleTimer = null;

        // 終了フック
        child.on('exit', () => {
            child._alive = false;
            this.busy.delete(child);
            this.alive.delete(child);
            this.idle = this.idle.filter(c => c !== child);
            try { clearTimeout(child._idleTimer); } catch {}
            this._ensureWarm(); // minIdle を満たすよう補充
            this._publish();
        });

        this.alive.add(child);
        this._markIdle(child); // 生成直後は idle に
        this._publish();
        return child;
    }

    _markIdle(child) {
        if (!child?._alive) return;

        if (this.busy.has(child)) this.busy.delete(child);
        this.idle = this.idle.filter(x => x !== child);
        this.idle.push(child);

        try { clearTimeout(child._idleTimer); } catch {}
        child._idleTimer = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch {}
        }, this.idleTtlMs);

        this._publish();
        this._ensureWarm();
    }

    /**
     * acquire: idle から 1つ取り出す。なければ spawn。
     * @param {object} opts
     * @param {object} [opts.env] - 生成時に乗せたい環境変数
     */
    acquire(opts = {}) {
        const { env } = opts;
        while (this.idle.length > 0) {
            const c = this.idle.shift();
            if (c?._alive && c.connected && c.killed !== true) {
                try { clearTimeout(c._idleTimer); } catch {}
                this.idle = this.idle.filter(x => x !== c); 
                this.busy.add(c);
                this._publish();
                this._ensureWarm();
                return c;
            }
        }
        const c = this._spawn(env);
        this.busy.add(c);
        this._publish();
        this._ensureWarm();
        return c;
    }

    _ensureWarm() {
        // idle の数を warmMin まで補充。hardMax は alive 総数で制限
        while (
            this.idle.length < this.warmMin &&
            (this.hardMax == null || this.alive.size < this.hardMax)
        ) {
            this._spawn();
        }
    }

    /**
     * release: 使い終わった child を“破棄”して、minIdle を満たすよう補充
     * （あなたの方針に合わせて、戻さず kill して補充）
     */
    release(child) {
        if (!child) return;
        this.busy.delete(child);
        try { child.removeAllListeners(); } catch {}
        try { clearTimeout(child._idleTimer); } catch {}
        try { child.kill('SIGKILL'); } catch {}
        this.alive.delete(child);
        this.idle = this.idle.filter(c => c !== child);
        this._ensureWarm();
        this._publish();
    }

    // 互換（dispose=release）
    dispose(child) {
        this.release(child);
    }

    /**
     * 完結型ジョブの場合に便利なヘルパ
     */
    async run(payload, { timeoutMs = 180000 } = {}) {
        const child = this.acquire();
        return new Promise((resolve, reject) => {
            let finished = false;

            const finish = (err, data) => {
                if (finished) return; finished = true;
                child.off('message', onMsg);
                child.off('error', onErr);
                child.off('exit', onExit);
                try { clearTimeout(timer); } catch {}
                this.release(child); // 破棄＋補充
                return err ? reject(err) : resolve(data);
            };

            const onMsg = (m) => {
                if (!m) return;
                if (m.type === 'done')  return finish(null, m.data ?? true);
                if (m.type === 'error') return finish(new Error(m.message || 'worker error'));
            };
            const onErr = (e) => finish(e || new Error('worker IPC error'));
            const onExit = () => finish(new Error('worker exited'));

            const timer = setTimeout(() => {
                try { child.kill('SIGKILL'); } catch {}
            }, timeoutMs);

            child.on('message', onMsg);
            child.on('error', onErr);
            child.on('exit', onExit);
            child.send({ type: 'getStream', ...payload });
        });
    }

    shutdown() {
        for (const c of this.alive) {
            try { c.kill('SIGKILL'); } catch {}
        }
        this.idle.length = 0;
        this.busy.clear();
        this.alive.clear();
        this._publish();
    }
}

module.exports = { ForkPool };