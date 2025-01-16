const { ClusterManager } = require('discord-hybrid-sharding');
require('dotenv').config();

// シャードマネージャーの設定
const manager = new ClusterManager('./bot.js', {
    mode: 'worker',
    totalShards: 2,
    shardsPerCluster: 16,
    token: process.env.DISCORD_TOKEN,
});

// クラスター作成時のログ
manager.on('clusterCreate', cluster => {
    console.log(`Cluster ${cluster.manager.totalShards} created`);
});

// クラスターの起動
manager.spawn({ timeout: -1 }); // タイムアウトを無効化（推奨）
