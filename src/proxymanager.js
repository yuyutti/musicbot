const fs = require('fs');
const path = require('path');

class ProxyManager {
    constructor() {
        this.proxyFilePath = path.join(__dirname, '..', '.data', 'proxy.json');
        const data = fs.readFileSync(this.proxyFilePath, 'utf8');
        const json = JSON.parse(data);
        this.proxyDefaultList = json.proxy;
        this.proxyList = [...this.proxyDefaultList];
        this.blockedProxies = new Map();
        this.shuffleProxy();
    }

    shuffleProxy() {
        const array = [...this.proxyList];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        this.proxyList = array;
    }

    resetProxy() {
        this.proxyList = [...this.proxyDefaultList];
        this.shuffleProxy();
    }

    getBanDuration(proxyInfo) {
        const now = Date.now();
        const elapsedSinceRelease = proxyInfo.lastReleaseTime ? now - proxyInfo.lastReleaseTime : Infinity;

        if (elapsedSinceRelease > 6 * 60 * 60 * 1000) {
            proxyInfo.count = 0; // 前歴リセット
        }

        proxyInfo.count += 1;

        // 3回目以降で再犯（釈放後1時間以内）
        if (proxyInfo.count >= 3 && elapsedSinceRelease <= 60 * 60 * 1000) {
            return 2 * 60 * 60 * 1000; // 2時間BAN
        }

        if (proxyInfo.count === 1) return 10 * 60 * 1000;     // 10分
        if (proxyInfo.count === 2 && elapsedSinceRelease <= 60 * 60 * 1000) return 60 * 60 * 1000; // 1時間
        if (proxyInfo.count === 2) return 30 * 60 * 1000;      // 30分
        return 3 * 60 * 60 * 1000;                             // 3時間（3回目以降）
    }

    blacklistProxy(proxy) {
        const now = Date.now();
        const proxyInfo = this.blockedProxies.get(proxy) || {
            count: 0,
            lastBanTime: 0,
            lastReleaseTime: 0,
        };

        const banDuration = this.getBanDuration(proxyInfo);
        proxyInfo.lastBanTime = now;
        proxyInfo.banDuration = banDuration;

        this.blockedProxies.set(proxy, proxyInfo);
        console.log(`Proxy ${proxy} is blacklisted for ${banDuration / 60000} minutes.`);
        process.dashboardData.proxy.blackList = Array.from(this.blockedProxies);
    }

    isProxyBlocked(proxy) {
        const proxyInfo = this.blockedProxies.get(proxy);
        if (!proxyInfo) return false;

        const now = Date.now();
        const bannedUntil = proxyInfo.lastBanTime + proxyInfo.banDuration;

        if (now > bannedUntil) {
            proxyInfo.lastReleaseTime = now;
            this.blockedProxies.set(proxy, proxyInfo);
            return false;
        }

        return true;
    }

    getProxyList() {
        return this.proxyList;
    }

    getBlockedProxyList() {
        return Array.from(this.blockedProxies);
    }

    getProxy() {
        if (process.env.ENABLE_PROXY === "false") {
            return "";
        }

        process.dashboardData.proxy.currentList = this.proxyList;

        while (this.proxyList.length > 0) {
            const proxy = this.proxyList.shift();
            if (!this.isProxyBlocked(proxy)) {
                return proxy;
            }
        }

        this.resetProxy();
        while (this.proxyList.length > 0) {
            const proxy = this.proxyList.shift();
            if (!this.isProxyBlocked(proxy)) {
                return proxy;
            }
        }

        return "";
    }
}

module.exports = new ProxyManager();