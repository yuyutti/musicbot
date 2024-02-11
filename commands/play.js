const { PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');
const { queue: musicQueue } = require('../src/musicQueue');
const { playSong } = require('../src/playsong');
const { volume, lang } = require('../SQL/lockup');
const language = require('../lang/commands/play');
const commandStatus = require('../events/event');

module.exports = {
    data: {
        name: 'play',
        description: {
            english: 'Plays a song or a playlist from YouTube',
            japanese: 'YouTubeから曲またはプレイリストを再生します'
        },
        options: [
            {
                name: 'song',
                description: {
                    english: 'The song URL, playlist URL, or search keywords',
                    japanese: '曲のURL、プレイリストのURL、または検索キーワード'
                },
                type: 'STRING',
                required: true
            }
        ]
    },
    alias: ['p'],
    async execute(interactionOrMessage, args, lang) {
        let songString;
        let voiceChannel;
        let userId;
        let isPlaylist = false;
        let addedCount = 0;
        
        if (interactionOrMessage.isCommand?.()) {
            await interaction.deferReply();
            songString = interactionOrMessage.options.getString('song');
            voiceChannel = interactionOrMessage.member.voice.channel;
            userId = interactionOrMessage.user.id;
        } else {
            songString = args.join(' ');
            voiceChannel = interactionOrMessage.member.voice.channel;
            userId = interactionOrMessage.author.id;
            if (!voiceChannel) {
                return interactionOrMessage.reply({ content: language.unVoiceChannel[lang], ephemeral: true });
            }
        }

        const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
        if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
            return interactionOrMessage.reply({ content: language.connectPermission[lang], ephemeral: true });
        }

        const serverQueue = musicQueue.get(interactionOrMessage.guildId) || await createServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel);

        const stringType = await playdl.validate(songString);
        console.log(stringType)
        switch (stringType) {

            case "yt_video":
                const videoInfo = await playdl.video_basic_info(songString);
                serverQueue.songs.push(
                    {
                        title: videoInfo.video_details.title,
                        url: songString,
                        duration: videoInfo.video_details.durationInSec,
                        requestBy: userId
                    }
                );
            break;
            
            case "yt_playlist":
                isPlaylist = true;
                const playlistInfo = await playdl.playlist_info(songString,{ incomplete : true });
                const initialLength = serverQueue.songs.length;
                for (const video of playlistInfo.videos) {
                    serverQueue.songs.push(
                        {
                            title: video.title,
                            url: video.url,
                            duration: video.durationInSec,
                            requestBy: userId
                        }
                    );
                }
                addedCount = serverQueue.songs.length - initialLength;
            break;
            
            case "search":
                const searchResult = await playdl.search(songString, { source : { youtube : "video" }, limit: 1 });
                if (searchResult.length > 0) {
                    const video = searchResult[0];
                    serverQueue.songs.push(
                        {
                            title: video.title,
                            url: video.url,
                            duration: video.durationInSec,
                            requestBy: userId
                        }
                    );
                } else {
                    return interactionOrMessage.reply({ content: language.notHit[lang], ephemeral: true });
                }
            break;
            
            case "sp_track":
                console.log('sp_track')
            break;
            
            case "sp_album":
                console.log('sp_album')
            break;
            
            case "sp_playlist":
                console.log('sp_playlist')
            break;

            case false:
                return interactionOrMessage.reply({ content: language.unLink[lang], ephemeral: true });
        
            default:
                return interactionOrMessage.reply({ content: language.notSupportService[lang], ephemeral: true });
            }

        musicQueue.set(interactionOrMessage.guildId, serverQueue);

        if (isPlaylist) {
            interactionOrMessage.reply({ content: language.addToPlaylist[lang](addedCount), ephemeral: true });
            if (serverQueue.songs.length === addedCount) {
                playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            }
        }
        else if (serverQueue.songs.length === 1) {
            playSong(interactionOrMessage.guildId, serverQueue.songs[0]);
            interactionOrMessage.reply({ content: language.addPlaying[lang](serverQueue.songs.title), ephemeral: true });
        }
        else {
            const addedSong = serverQueue.songs[serverQueue.songs.length - 1];
            interactionOrMessage.reply({ content: language.added[lang](serverQueue.songs.title), ephemeral: true });
        }
    }
};

async function createServerQueue(guildId, voiceChannel, textChannel) {
    const queueConstruct = {
        voiceChannel,
        textChannel,
        language: await lang(guildId) || 'en',
        connection: null,
        loop: false,
        autoPlay: false,
        volume: await volume(guildId) || 10,
        commandStatus: new commandStatus(),
        songs: [],
        audioPlayer: createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Stop
            }
        }),
    };

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    queueConstruct.connection = connection;
    musicQueue.set(guildId, queueConstruct);

    return queueConstruct;
}