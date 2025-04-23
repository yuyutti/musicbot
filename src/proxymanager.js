const fs = require('fs');
const path = require('path');

class ProxyManager {
    constructor() {
        this.proxyFilePath = path.join(__dirname, '..', '.data', 'proxy.json');
        const data = fs.readFileSync(this.proxyFilePath, 'utf8');
        const json = JSON.parse(data);
        this.proxyDefaultList = json.proxy;
        this.proxyList = [...this.proxyDefaultList];
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

    getProxy() {
        if (process.env.ENABLE_PROXY === "false") {
            return "";
        }
        if (this.proxyList.length === 0) {
            this.resetProxy();
        }
        return this.proxyList.shift();
    }
}

module.exports = ProxyManager;