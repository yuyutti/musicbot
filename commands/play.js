const { PermissionsBitField } = require('discord.js');

const playdl = require('play-dl');
const { queue: musicQueue, CreateServerQueue } = require('../src/musicQueue');
const { checkPermissions } = require('../src/vc');
const { handleSongTypeWorker } = require('../src/search');
const { playSong } = require('../src/playsong');
const { updatePlayingGuild } = require('../src/playingGuild');
const { updateActivity } = require('../src/activity');
const language = require('../lang/commands/play');

const { getLoggerChannel, getErrorChannel } = require('../src/log');

const singleLists = ['yt_video', 'search', 'sp_track'];
const multiLists = ['yt_playlist', 'sp_album', 'sp_playlist', 'sp_artist'];

module.exports = {
    data: {
        name: 'play',
        description: 'Plays a song or playlist',
        name_localizations: { ja: 'play' },
        description_localizations: { ja: '曲またはプレイリストを再生します' },
        options: [
            {
                name: 'song',
                description: 'The song URL, playlist URL, or search keywords',
                name_localizations: { ja: '曲' },
                description_localizations: { ja: '曲のURL、プレイリストのURL、または検索キーワード' },
                type: 3,
                required: true
            }
        ]
    },
    alias: ['p'],
    async execute(interactionOrMessage, args, lang) {
        const loggerChannel = getLoggerChannel();
        const errorChannel = getErrorChannel();

        // メンテナンスモード
        if (process.env.IsMaintenance === 'true') {
            return interactionOrMessage.reply(language.maintenanceMode[lang]);
        }

        try {
            const { songString, voiceChannel, userId } = parseInteractionOrMessage(interactionOrMessage, args);
            if (interactionOrMessage.isCommand?.()) {
                await interactionOrMessage.deferReply({ ephemeral: true });
            }

            if (!voiceChannel) {
                loggerChannel.send(`${interactionOrMessage.guild.name}でボイスチャンネルに参加しない状態でplayコマンドが実行されました`);
                return safeReply(interactionOrMessage, language.unVoiceChannel[lang]);
            }

            let serverQueue = musicQueue.get(interactionOrMessage.guildId);
            if (!serverQueue) {
                serverQueue = await CreateServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel);
                musicQueue.set(interactionOrMessage.guildId, serverQueue);

                const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
                if (!checkPermissions(permissions, interactionOrMessage, lang)) return;
            }

            let stringType;
            const input = songString.trim();
            
            if (!input.startsWith("http")) {
                stringType = "search";
            } else {
                try {
                    const url = new URL(input);
                    const host = url.hostname.replace(/^www\./, '');
            
                    if (["youtube.com", "youtu.be"].includes(host)) {
                        if (url.pathname.startsWith("/playlist") || url.searchParams.has("list")) {
                            stringType = "yt_playlist";
                        } else if (url.pathname.startsWith("/watch") || host === "youtu.be" || url.pathname.startsWith("/embed")) {
                            stringType = "yt_video";
                        } else {
                            stringType = false;
                        }
                    } else if (host === "open.spotify.com" || host === "play.spotify.com") {
                        const pathParts = url.pathname.split("/").filter(Boolean);
                        const [type, id] = pathParts.slice(-2);

                        switch (type) {
                            case "track": stringType = "sp_track"; break;
                            case "playlist": stringType = "sp_playlist"; break;
                            case "album": stringType = "sp_album"; break;
                            case "artist": stringType = "sp_artist"; break;
                            default: stringType = false;
                        }
                    } else {
                        stringType = "url_unknown";
                    }
            
                } catch (error) {
                    stringType = "search";
                }
            }

            console.log('stringType:', stringType);
            
            const { addedCount, songs, name } = await handleSongTypeWorker(stringType, songString, userId, lang, interactionOrMessage);
            if (addedCount === 0) return;

            if (!songs || !Array.isArray(songs)) {
                errorChannel.send(`Error: 楽曲取得時に${interactionOrMessage.guild.name}で配列未定義エラーが発生しました。 \n\`\`\`${stringType}\n${songString}\`\`\``);
                return safeReply(interactionOrMessage, language.notArray[lang]);
            }
            
            serverQueue.songs.push(...songs);
            
            updateActivity() && updatePlayingGuild();
            
            await handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, name);
            await handleRemoveWord(interactionOrMessage, serverQueue, lang);
        } catch (error) {
            console.error('Error executing play command:', error);
            errorChannel.send(`Error executing play command: \n\`\`\`${error}\`\`\``);
        }
    }
};

function parseInteractionOrMessage(interactionOrMessage, args) {
    if (interactionOrMessage.isCommand?.()) {
        return {
            songString: interactionOrMessage.options.getString('song'),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.user.id
        };
    }
    else {
        interactionOrMessage.channel.sendTyping();
        return {
            songString: args.join(' '),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.author.id
        };
    }
}

async function handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, albumName) {
    const loggerChannel = getLoggerChannel();
    const isPlaying = serverQueue.songs.length === 1;

    if (singleLists.includes(stringType)) {
        await safeReply(interactionOrMessage, isPlaying ? language.addPlaying[lang](serverQueue.songs[0].title) : language.added[lang](serverQueue.songs.slice(-1)[0].title));
        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**に**${serverQueue.songs.slice(-1)[0].title}**を追加しました`);
        if (isPlaying) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        }
    }
    else if (multiLists.includes(stringType)) {
        console.log('multiLists:', stringType);
        const message = stringType === "yt_playlist"
        ? language.addToPlaylist[lang](addedCount)
        : stringType === "sp_album"
        ? language.addedAlbum[lang](albumName, addedCount)
        : stringType === "sp_artist"
        ? language.addedArtist[lang](albumName, addedCount)
        : language.addedPlaylist[lang](albumName, addedCount);
    console.log('message:', message);
    await safeReply(interactionOrMessage, message);
    
    const sourceLabel =
        stringType === "yt_playlist" ? 'YouTubeプレイリスト' :
        stringType === "sp_album"    ? 'Spotifyアルバム' :
        stringType === "sp_artist"   ? 'Spotifyアーティストプレイリスト' :
                                       'Spotifyプレイリスト';
    console.log('sourceLabel:', sourceLabel);
    if (serverQueue.songs.length === addedCount) {
        playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**で${sourceLabel}が**${addedCount}**件追加され、再生を開始します`);
    } else {
        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**で${sourceLabel}が**${addedCount}**件追加されました`);
    }
    }
}

async function safeReply(interactionOrMessage, content) {
    if (interactionOrMessage.isCommand?.()) {
        return interactionOrMessage.editReply(typeof content === 'string' ? { content } : content);
    } else {
        return interactionOrMessage.reply(typeof content === 'string' ? { content } : content);
    }
}

async function handleRemoveWord(interactionOrMessage, serverQueue, lang) {
    const errorChannel = getErrorChannel();

    const textChannelPermission = interactionOrMessage.channel.permissionsFor(interactionOrMessage.client.user);
    if (serverQueue.removeWord && textChannelPermission.has(PermissionsBitField.Flags.ManageMessages)) {
        try {
            if (!interactionOrMessage.isCommand?.()) {
                setTimeout(async () => {
                    try {
                        await interactionOrMessage.delete();
                        console.log('Message deleted after 3 seconds.');
                    } catch (error) {
                        console.error('Failed to delete message after delay:', error);
                        errorChannel.send(`Failed to delete message after delay: \n\`\`\`${error}\`\`\``);
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
            errorChannel.send(`Failed to delete message: \n\`\`\`${error}\`\`\``);
        }
    }
}