# Node.jsで動作する音楽BOTです

## 【versions】
Node.js v18.15.0  
npm v9.5.0  
package package.jsonに記載

### 【使い方】
1.envを作成し下記の情報を入力
```
DISCORD_TOKEN = {DiscordBOTのtoken}
DISCORD_PREFIX = {Discordコマンドのプレフィックス}（例: !）
YouTube_API_KEY = {YouTubeDataAPIのAPIキー}
```
[DiscordBOTのtoken入手先](https://discord.dev)  
[YouTubeDataAPIのAPIキー入力先](https://console.cloud.google.com/apis/api/youtube.googleapis.com/)

2 ```npm i```で必要packageをダウンロード

3 ```node index.js```で起動！