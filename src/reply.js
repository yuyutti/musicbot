async function safeReply(interactionOrMessage, content, ephemeral = true) {
    const payload = typeof content === 'string' ? { content, ephemeral } : { ...content, ephemeral };

    if (interactionOrMessage.isCommand?.()) {
        if (interactionOrMessage.deferred || interactionOrMessage.replied) {
            return interactionOrMessage.editReply(payload);
        }
        return interactionOrMessage.reply(payload);
    }

    return interactionOrMessage.reply(payload);
}

async function upsertReply(interactionOrMessage, content, existingMessage = null, ephemeral = true) {
    const payload = typeof content === 'string' ? { content, ephemeral } : { ...content, ephemeral };

    if (interactionOrMessage.isCommand?.()) {
        return safeReply(interactionOrMessage, payload, ephemeral);
    }

    if (existingMessage) {
        return existingMessage.edit(payload);
    }

    return interactionOrMessage.reply(payload);
}

module.exports = { safeReply, upsertReply };
