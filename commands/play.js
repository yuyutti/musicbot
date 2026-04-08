const { PermissionsBitField } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

const { queue: musicQueue, CreateServerQueue } = require('../src/musicQueue');
const { checkPermissions } = require('../src/vc');
const { handleSongTypeWorker } = require('../src/search');
const { playSong } = require('../src/playsong');
const { updatePlayingGuild } = require('../src/playingGuild');
const { updateActivity } = require('../src/activity');
const { safeReply, upsertReply } = require('../src/reply');
const language = require('../lang/commands/play');

const { getLoggerChannel, getErrorChannel } = require('../src/log');

const PLAYLIST_PROGRESS_CHUNK_SIZE = 100;
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
                description_localizations: { ja: '曲のURL、プレイリストURL、または検索キーワード' },
                type: 3,
                required: true
            }
        ]
    },
    alias: ['p'],
    async execute(interactionOrMessage, args, lang) {
        const loggerChannel = getLoggerChannel();
        const errorChannel = getErrorChannel();

        if (process.env.IsMaintenance === 'true') {
            return interactionOrMessage.reply(language.maintenanceMode[lang]);
        }

        try {
            const { songString, voiceChannel, userId } = parseInteractionOrMessage(interactionOrMessage, args);
            if (interactionOrMessage.isCommand?.()) {
                await interactionOrMessage.deferReply({ ephemeral: true });
            }

            if (!voiceChannel) {
                loggerChannel.send(`${interactionOrMessage.guild.name}でボイスチャンネル未参加の状態でplayコマンドが実行されました`);
                return safeReply(interactionOrMessage, language.unVoiceChannel[lang]);
            }

            let serverQueue = musicQueue.get(interactionOrMessage.guildId);
            if (!serverQueue) {
                serverQueue = await CreateServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel);
                musicQueue.set(interactionOrMessage.guildId, serverQueue);

                const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
                if (!checkPermissions(permissions, interactionOrMessage, lang)) return;
            }

            const stringType = detectStringType(songString);
            console.log('stringType:', stringType);

            if (stringType === 'yt_playlist') {
                await handleYouTubePlaylist(interactionOrMessage, serverQueue, songString, userId, lang);
                return;
            }

            const commandStartedAt = Date.now();
            const { addedCount, songs, name } = await handleSongTypeWorker(
                stringType,
                songString,
                userId,
                lang,
                interactionOrMessage
            );
            console.log(`[play] fetch finished in ${Date.now() - commandStartedAt}ms for ${stringType}`);

            if (addedCount === 0) return;

            if (!songs || !Array.isArray(songs)) {
                errorChannel.send(`Error: 楽曲取得時に${interactionOrMessage.guild.name}で配列未定義エラーが発生しました。\n\`\`\`${stringType}\n${songString}\`\`\``);
                return safeReply(interactionOrMessage, language.notArray[lang]);
            }

            serverQueue.songs.push(...songs);
            updateActivity();
            updatePlayingGuild();

            await handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, name);
            await handleRemoveWord(interactionOrMessage, serverQueue, lang);
        } catch (error) {
            console.error('Error executing play command:', error);
            errorChannel.send(`Error executing play command:\n\`\`\`${error}\`\`\``);
        }
    }
};

function detectStringType(songString) {
    const input = songString.trim();

    if (!input.startsWith('http')) {
        return 'search';
    }

    try {
        const url = new URL(input);
        const host = url.hostname.replace(/^www\./, '');

        if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
            if (url.pathname.startsWith('/playlist') || url.searchParams.has('list')) {
                return 'yt_playlist';
            }
            if (
                url.pathname.startsWith('/watch') ||
                url.pathname.startsWith('/shorts/') ||
                url.pathname.startsWith('/embed/') ||
                url.pathname.startsWith('/v/') ||
                host === 'youtu.be'
            ) {
                return 'yt_video';
            }
            return false;
        }

        if (host === 'open.spotify.com' || host === 'play.spotify.com') {
            const pathParts = url.pathname.split('/').filter(Boolean);
            const [type] = pathParts.slice(-2);

            switch (type) {
                case 'track': return 'sp_track';
                case 'playlist': return 'sp_playlist';
                case 'album': return 'sp_album';
                case 'artist': return 'sp_artist';
                default: return false;
            }
        }

        return 'url_unknown';
    } catch {
        return 'search';
    }
}

async function handleYouTubePlaylist(interactionOrMessage, serverQueue, songString, userId, lang) {
    const loggerChannel = getLoggerChannel();
    const errorChannel = getErrorChannel();
    const playlistRequestStartedAt = Date.now();
    let statusMessage = null;

    const shouldPrimeFirstSong =
        serverQueue.songs.length === 0 &&
        serverQueue.audioPlayer.state.status === AudioPlayerStatus.Idle &&
        !serverQueue._currentlyTryingToPlay;

    if (shouldPrimeFirstSong) {
        const firstResult = await handleSongTypeWorker(
            'yt_playlist',
            songString,
            userId,
            lang,
            interactionOrMessage,
            { playlistMode: 'first_only' }
        );

        if (!firstResult.songs || firstResult.songs.length === 0) return;

        const playlistName = firstResult.name || 'playlist';
        serverQueue.songs.push(firstResult.songs[0]);
        updateActivity();
        updatePlayingGuild();
        console.log(`[playlist] first song fetched in ${Date.now() - playlistRequestStartedAt}ms (${playlistName})`);

        void playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        schedulePlaybackKick(interactionOrMessage.guildId, firstResult.songs[0]);

        statusMessage = await upsertReply(interactionOrMessage, {
            content: buildPlaylistProgressMessage(lang, 1, null, 'started')
        }, statusMessage);

        void addRemainingPlaylistSongs(
            interactionOrMessage,
            serverQueue,
            songString,
            userId,
            lang,
            playlistName,
            playlistRequestStartedAt,
            loggerChannel,
            errorChannel,
            statusMessage
        );

        await handleRemoveWord(interactionOrMessage, serverQueue, lang);
        return;
    }

    const { addedCount, songs, name } = await handleSongTypeWorker(
        'yt_playlist',
        songString,
        userId,
        lang,
        interactionOrMessage,
        { playlistMode: 'bulk' }
    );

    if (addedCount === 0) return;

    if (!songs || !Array.isArray(songs)) {
        errorChannel.send(`Error: 楽曲取得時に${interactionOrMessage.guild.name}で配列未定義エラーが発生しました。\n\`\`\`yt_playlist\n${songString}\`\`\``);
        return safeReply(interactionOrMessage, language.notArray[lang]);
    }

    const playlistName = name || 'playlist';
    statusMessage = await appendSongsInChunks(interactionOrMessage, serverQueue, songs, lang, statusMessage, 0, songs.length);
    console.log(`[playlist] bulk fetch finished in ${Date.now() - playlistRequestStartedAt}ms (${playlistName}, ${addedCount} songs)`);

    await handleSongAddition(serverQueue, 'yt_playlist', addedCount, interactionOrMessage, lang, playlistName, statusMessage);
    await handleRemoveWord(interactionOrMessage, serverQueue, lang);
}

async function addRemainingPlaylistSongs(
    interactionOrMessage,
    serverQueue,
    songString,
    userId,
    lang,
    playlistName,
    playlistRequestStartedAt,
    loggerChannel,
    errorChannel,
    statusMessage
) {
    try {
        const { addedCount, songs, name } = await handleSongTypeWorker(
            'yt_playlist',
            songString,
            userId,
            lang,
            interactionOrMessage,
            { playlistMode: 'skip_first' }
        );

        if (!songs || !Array.isArray(songs)) {
            errorChannel.send(`Error: playlist後続取得時に${interactionOrMessage.guild.name}で配列未定義エラーが発生しました。\n\`\`\`yt_playlist\n${songString}\`\`\``);
            return;
        }

        const resolvedPlaylistName = name || playlistName || 'playlist';
        statusMessage = await appendSongsInChunks(interactionOrMessage, serverQueue, songs, lang, statusMessage, 1, addedCount + 1);

        const totalAdded = addedCount + 1;
        console.log(`[playlist] full enqueue finished in ${Date.now() - playlistRequestStartedAt}ms (${resolvedPlaylistName}, ${totalAdded} songs)`);
        await upsertReply(interactionOrMessage, buildPlaylistFinalMessage(lang, resolvedPlaylistName, totalAdded), statusMessage);
        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**でYouTubeプレイリスト **${resolvedPlaylistName}** が**${totalAdded}**件追加されました`);
    } catch (error) {
        console.error('Error adding remaining playlist songs:', error);
        errorChannel.send(`Error adding remaining playlist songs:\n\`\`\`${error}\`\`\``);
    }
}

async function appendSongsInChunks(interactionOrMessage, serverQueue, songs, lang, statusMessage = null, alreadyAdded = 0, totalExpected = songs.length + alreadyAdded) {
    if (!songs.length) return statusMessage;

    for (let i = 0; i < songs.length; i += PLAYLIST_PROGRESS_CHUNK_SIZE) {
        const chunk = songs.slice(i, i + PLAYLIST_PROGRESS_CHUNK_SIZE);
        serverQueue.songs.push(...chunk);
        updateActivity();
        updatePlayingGuild();

        const addedSoFar = alreadyAdded + Math.min(i + chunk.length, songs.length);
        if (songs.length > PLAYLIST_PROGRESS_CHUNK_SIZE) {
            statusMessage = await upsertReply(interactionOrMessage, {
                content: buildPlaylistProgressMessage(lang, addedSoFar, totalExpected, 'loading')
            }, statusMessage);
        }
    }

    return statusMessage;
}

function buildPlaylistProgressMessage(lang, addedCount, totalCount, status) {
    if (lang === 'ja') {
        if (status === 'started') {
            return `プレイリストをキューに追加しています...`;
        }
        if (totalCount) {
            return `プレイリストをキューに追加しています... (${addedCount}/${totalCount})`;
        }
        return `プレイリストをキューに追加しています... (${addedCount}曲)`;
    }

    if (status === 'started') {
        return `Adding playlist to the queue...`;
    }
    if (totalCount) {
        return `Adding playlist to the queue... (${addedCount}/${totalCount})`;
    }
    return `Adding playlist to the queue... (${addedCount} songs)`;
}

function buildPlaylistFinalMessage(lang, playlistName, addedCount) {
    if (lang === 'ja') {
        return `**${playlistName}** から **${addedCount}曲** をキューに追加しました`;
    }
    return `Added **${addedCount}** songs from **${playlistName}** to the queue`;
}

function parseInteractionOrMessage(interactionOrMessage, args) {
    if (interactionOrMessage.isCommand?.()) {
        return {
            songString: interactionOrMessage.options.getString('song'),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.user.id
        };
    }

    interactionOrMessage.channel.sendTyping();
    return {
        songString: args.join(' '),
        voiceChannel: interactionOrMessage.member.voice.channel,
        userId: interactionOrMessage.author.id
    };
}

async function handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, albumName, statusMessage = null) {
    const loggerChannel = getLoggerChannel();
    const shouldStart = serverQueue.audioPlayer.state.status === AudioPlayerStatus.Idle && !serverQueue._currentlyTryingToPlay;

    if (singleLists.includes(stringType)) {
        await safeReply(
            interactionOrMessage,
            shouldStart
                ? language.addPlaying[lang](serverQueue.songs[0].title)
                : language.added[lang](serverQueue.songs.slice(-1)[0].title)
        );
        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**に**${serverQueue.songs.slice(-1)[0].title}**を追加しました`);
        if (shouldStart) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        }
        return;
    }

    if (multiLists.includes(stringType)) {
        const message = stringType === 'yt_playlist'
            ? buildPlaylistFinalMessage(lang, albumName || 'playlist', addedCount)
            : stringType === 'sp_album'
            ? language.addedAlbum[lang](albumName, addedCount)
            : stringType === 'sp_artist'
            ? language.addedArtist[lang](albumName, addedCount)
            : language.addedPlaylist[lang](albumName, addedCount);

        if (stringType === 'yt_playlist' && statusMessage) {
            await upsertReply(interactionOrMessage, message, statusMessage);
        } else {
            await safeReply(interactionOrMessage, message);
        }

        const sourceLabel =
            stringType === 'yt_playlist' ? 'YouTubeプレイリスト' :
            stringType === 'sp_album' ? 'Spotifyアルバム' :
            stringType === 'sp_artist' ? 'Spotifyアーティストプレイリスト' :
            'Spotifyプレイリスト';

        if (shouldStart) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**で${sourceLabel} **${albumName || 'playlist'}** が**${addedCount}**件追加され、再生を開始します`);
            return;
        }

        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**で${sourceLabel} **${albumName || 'playlist'}** が**${addedCount}**件追加されました`);
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
                        errorChannel.send(`Failed to delete message after delay:\n\`\`\`${error}\`\`\``);
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
            errorChannel.send(`Failed to delete message:\n\`\`\`${error}\`\`\``);
        }
    }
}

function schedulePlaybackKick(guildId, song) {
    setTimeout(() => {
        const serverQueue = musicQueue.get(guildId);
        if (!serverQueue) return;
        if (serverQueue.audioPlayer.state.status !== AudioPlayerStatus.Idle) return;
        if (serverQueue._currentlyTryingToPlay) return;
        if (!serverQueue.songs[0] || serverQueue.songs[0].url !== song.url) return;

        console.log(`[playlist] playback kick guild=${guildId} title=${song.title}`);
        void playSong(guildId, serverQueue.songs[0]);
    }, 2000);
}
