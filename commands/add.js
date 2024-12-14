// const language = require('../lang/commands/add');

module.exports = {
    data: {
        name: 'add',
        description: 'Add a question to the intro quiz game',
        name_localizations: {
            ja: 'add',
        },
        description_localizations: {
            ja: 'イントロドン: 問題追加',
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
        // 問題追加処理を記入
    },
}
