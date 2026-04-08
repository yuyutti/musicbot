const path = require('path');
const { spawn } = require('child_process');

const ytdlpPath = path.join(__dirname, '..', 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_linux');

function getYouTubeVideoId(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1);
        if (u.searchParams.has('v')) return u.searchParams.get('v');
        const m = u.pathname.match(/\/(?:shorts|embed|v)\/([^/?]+)/);
        if (m) return m[1];
    } catch {}
    return null;
}

function ytdlpJson(url, extraArgs = [], proxy = null) {
    return new Promise((resolve, reject) => {
        const args = ['--dump-json', '--no-warnings', '--quiet'];
        if (proxy) args.push('--proxy', proxy);
        args.push(...extraArgs, url);

        const proc = spawn(ytdlpPath, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            if (code !== 0) return reject(new Error(`yt-dlp exited ${code}: ${stderr.trim()}`));
            try {
                const lines = stdout.trim().split('\n').filter(Boolean);
                const parsed = lines.map(l => JSON.parse(l));
                resolve(parsed.length === 1 ? parsed[0] : parsed);
            } catch (e) {
                reject(new Error(`JSON parse error: ${e.message}`));
            }
        });
        proc.on('error', reject);
    });
}

// yt-dlpの出力を1行ずつストリーミングで処理する（プレイリスト向け）
function ytdlpJsonStream(url, extraArgs = [], proxy = null, onItem) {
    return new Promise((resolve, reject) => {
        const args = ['--dump-json', '--no-warnings', '--quiet'];
        if (proxy) args.push('--proxy', proxy);
        args.push(...extraArgs, url);

        const proc = spawn(ytdlpPath, args);
        let buffer = '';
        let stderr = '';

        proc.stdout.on('data', d => {
            buffer += d.toString();
            let nl;
            while ((nl = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line) continue;
                try { onItem(JSON.parse(line)); } catch {}
            }
        });
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            if (buffer.trim()) {
                try { onItem(JSON.parse(buffer.trim())); } catch {}
            }
            if (code !== 0) return reject(new Error(`yt-dlp exited ${code}: ${stderr.trim()}`));
            resolve();
        });
        proc.on('error', reject);
    });
}

module.exports = { ytdlpJson, ytdlpJsonStream, getYouTubeVideoId };
