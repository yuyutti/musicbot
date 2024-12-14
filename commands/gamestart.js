const playdl = require('play-dl');
const { queue: musicQueue, CreateServerQueue } = require('../src/musicQueue');
const { checkPermissions } = require('../src/vc');
const { handleSongType } = require('../src/search');
const { gameManager } = require('../src/gamemanager');

const language = require('../lang/commands/gamestart');

const spotifyLists = ['sp_track', 'sp_album', 'sp_playlist'];

module.exports = {
    data: {
        name: 'gamestart',
        description: 'Start an intro quiz game',
        name_localizations: {
            ja: 'gamestart',
        },
        description_localizations: {
            ja: 'イントロドン: ゲーム開始',
        },
        options: [
            {
                name: 'link',
                description: 'YouTube or Spotify link',
                type: 3,
                required: true,
                name_localizations: { ja: 'リンク' },
                description_localizations: { ja: 'YouTubeまたはSpotifyのリンク' }
            }
        ]
    },
    async execute(interactionOrMessage, args, lang) {
        const { songString, voiceChannel, userId } = parseInteractionOrMessage(interactionOrMessage, args);
        if (!voiceChannel) return interactionOrMessage.reply({ content: language.unVoiceChannel[lang], ephemeral: true });

        const permissions = voiceChannel.permissionsFor(interactionOrMessage.client.user);
        if (!checkPermissions(permissions, interactionOrMessage, lang)) return;

        const stringType = await playdl.validate(songString);
        if (spotifyLists.includes(stringType) && playdl.is_expired()) await playdl.refreshToken();

        let { addedCount, songs, name } = await handleSongType(stringType, songString, userId, lang, interactionOrMessage);
        if (addedCount === 0) return;

        songs = songs.map(song => {
            const startDuration = Math.floor(Math.random() * 4) + 3;
            const endDuration = startDuration + 30;
            return {
                ...song,
                startDuration,
                endDuration
                };
        });
        
        const serverQueue = await CreateServerQueue(interactionOrMessage.guildId, voiceChannel, interactionOrMessage.channel, songs);
        serverQueue.songs = songs;
        serverQueue.game = {
            hardMode: false,
            responseTime: 15,
            multiResponse: false,
            hint: true,
            hintCount: 0,
            roundCounts: 1,
            correctUser: null,
            points: {},
        }

        gameManager(serverQueue)
    },
}

function parseInteractionOrMessage(interactionOrMessage, args) {
    if (interactionOrMessage.isCommand?.()) {
        return {
            songString: interactionOrMessage.options.getString('link'),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.user.id
        };
    }
    else {
        return {
            songString: args.join(' '),
            voiceChannel: interactionOrMessage.member.voice.channel,
            userId: interactionOrMessage.author.id
        };
    }
}