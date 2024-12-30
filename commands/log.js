const { PermissionsBitField } = require('discord.js');

const language = require('../lang/commands/log');
const { updateLogChannel } = require('../SQL/setdata');

module.exports = {
    data: {
        name: 'logger',
        description: 'Set the channel to display logs',
        name_localizations: {
            ja: 'logger',
        },
        description_localizations: {
            ja: 'ログを表示するチャンネルを設定または解除します',
        },
        options: [
            {
                name: 'channel',
                description: 'Set the channel to display logs (if not specified, it will be unset)',
                name_localizations: {
                    ja: 'channel',
                },
                description_localizations: {
                    ja: 'ログを表示するチャンネルを設定します（指定しない場合は解除されます）',
                },
                type: 7, // チャンネルタイプ
                required: false, // 必須ではない
            },
        ],
    },
    alias: ['log'],
    async execute(interactionOrMessage, args, lang) {
        try {
            let inputChannel = null;

            // スラッシュコマンドとメッセージコマンドで処理を分ける
            if (interactionOrMessage.isCommand?.()) {
                inputChannel= interactionOrMessage.options.getChannel('channel', false); // 第2引数で必須ではないことを指定
            }
            else if (args.length > 0) {
                inputChannel = interactionOrMessage.guild.channels.cache.get(args[0]);
            }

            // チャンネルが見つからない場合
            if (inputChannel === undefined) {
                return interactionOrMessage.reply(language.invalidChannel[lang]);
            }

            // チャンネルの権限を確認
            if (inputChannel) {
                const permissions = inputChannel.permissionsFor(interactionOrMessage.client.user);
                if (!permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interactionOrMessage.reply(language.noViewPermission[lang]);
                }
                if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
                    return interactionOrMessage.reply(language.noSendPermission[lang]);
                }
            }

            // チャンネルの設定
            if (inputChannel) {
                // ログチャンネルを設定
                interactionOrMessage.reply(language.set[lang](inputChannel));
                await updateLogChannel(interactionOrMessage.guildId, inputChannel.id);
            }

            // nullの場合
            if (inputChannel === null) {
                // ログチャンネルを解除
                interactionOrMessage.reply(language.unset[lang]);
                await updateLogChannel(interactionOrMessage.guildId, null);
            }
        }
        catch (error) {
            console.error('Error executing log command:', error);
        }
    }
};