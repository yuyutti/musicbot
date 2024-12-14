const { ShardingManager } = require('discord.js');
require('dotenv').config();

const adminGuildId = '1132198504199098458';

// シャードマネージャーを作成
const manager = new ShardingManager('./index.js', {
    token: process.env.DISCORD_TOKEN, // ボットトークンを指定
    totalShards: 3, // シャード数
});

let readyShards = 0;

manager.on('shardCreate', (shard) => {
    console.log(`Shard ${shard.id} launched`);

    // シャードの `ready` イベントを監視
    shard.on('ready', () => {
        readyShards++;
        console.log(`${readyShards}/${manager.totalShards} shards ready`);

        if (readyShards === manager.totalShards) {
            console.log('All shards are up and running!');

            // 各シャードに `AllShardIsReady` を実行させる
            manager.broadcastEval(async (client) => {
                if (typeof client.AllShardIsReady === 'function') {
                    await client.AllShardIsReady();
                }
            }).then(() => {
                console.log('AllShardIsReady executed on all shards.');
            }).catch(console.error);
        }
    });
});

// シャードを起動
manager.spawn({ shardArgs: ['--adminGuild', adminGuildId] });
