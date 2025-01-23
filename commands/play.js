const { PermissionsBitField } = require('discord.js');

const playdl = require('play-dl');
const { queue: musicQueue, CreateServerQueue } = require('../src/musicQueue');
const { checkPermissions } = require('../src/vc');
const { handleSongType } = require('../src/search');
const { playSong } = require('../src/playsong');
const { updatePlayingGuild } = require('../src/playingGuild');
const { updateActivity } = require('../src/activity');
const language = require('../lang/commands/play');

const { getLoggerChannel } = require('../src/log');

const singleLists = ['yt_video', 'search', 'sp_track'];
const multiLists = ['yt_playlist', 'sp_album', 'sp_playlist'];
const spotifyLists = ['sp_track', 'sp_album', 'sp_playlist'];

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

        // メンテナンスモード
        return interactionOrMessage.reply(language.maintenanceMode[lang]);

        try {
            const { songString, voiceChannel, userId } = parseInteractionOrMessage(interactionOrMessage, args);
            if (!voiceChannel) return interactionOrMessage.reply({ content: language.unVoiceChannel[lang], ephemeral: true });

            const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
            if (!checkPermissions(permissions, interactionOrMessage, lang)) return;

            const stringType = await playdl.validate(songString);
            if (spotifyLists.includes(stringType) && playdl.is_expired()) await playdl.refreshToken();

            const { addedCount, songs, name, related_videos } = await handleSongType(stringType, songString, userId, lang, interactionOrMessage);
            if (addedCount === 0) return;

            const serverQueue = musicQueue.get(interactionOrMessage.guildId) || await CreateServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel);

            if (!songs || !Array.isArray(songs)) {
                errorChannel.send(`Error: 楽曲取得時に${interactionOrMessage.guild.name}で配列未定義エラーが発生しました。${stringType},${songString}`);
                return interactionOrMessage.reply({ content: language.notArray[lang], ephemeral: true });
            }

            serverQueue.songs.push(...songs);

            updateActivity() && updatePlayingGuild();
            
            await handleSongAddition(serverQueue, stringType, addedCount, interactionOrMessage, lang, name);
            await handleRemoveWord(interactionOrMessage, serverQueue, lang);
        } catch (error) {
            console.error('Error executing play command:', error);
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
        await interactionOrMessage.reply({ content: isPlaying ? language.addPlaying[lang](serverQueue.songs[0].title) : language.added[lang](serverQueue.songs.slice(-1)[0].title) });
        loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**に**${serverQueue.songs.slice(-1)[0].title}**を追加しました`);
        if (isPlaying) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
        }
    }
    else if (multiLists.includes(stringType)) {
        const message = stringType === "yt_playlist"
            ? language.addToPlaylist[lang](addedCount) 
            : stringType === "sp_album"
            ? language.addedAlbum[lang](albumName, addedCount)
            : language.addedPlaylist[lang](albumName, addedCount);

        await interactionOrMessage.reply({ content: message });
        if (serverQueue.songs.length === addedCount) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**で${stringType === "yt_playlist" ? 'YouTubeプレイリスト' : stringType === "sp_album" ? 'Spotifyアルバム' : 'Spotifyプレイリスト'}が**${addedCount}**件追加され、再生を開始します`);
        } else {
            loggerChannel.send(`playing: **${interactionOrMessage.guild.name}**で${stringType === "yt_playlist" ? 'YouTubeプレイリスト' : stringType === "sp_album" ? 'Spotifyアルバム' : 'Spotifyプレイリスト'}が**${addedCount}**件追加されました`);
        }
    }
}

async function handleRemoveWord(interactionOrMessage, serverQueue, lang) {
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
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    }
}