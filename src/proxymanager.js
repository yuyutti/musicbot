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
        this.blockDuration = 1000 * 60 * 60 * 6; // 6時間ブロック
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

    blacklistProxy(proxy) {
        this.blockedProxies.set(proxy, Date.now());
        console.log(`Proxy ${proxy} is blacklisted.`);
    }

    isProxyBlocked(proxy) {
        const blockedAt = this.blockedProxies.get(proxy);
        if (!blockedAt) return false;
        if (Date.now() - blockedAt > this.blockDuration) {
            this.blockedProxies.delete(proxy);
            return false;
        }
        return true;
    }

    getProxyList() {
        return this.proxyList;
    }

    getBlockedProxyList() {
        return this.blockedProxies;
    }

    getProxy() {
        if (process.env.ENABLE_PROXY === "false") {
            return "";
        }

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