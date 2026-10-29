function unixDate(value) {
  if (!value) return new Date();
  return new Date(Number(value) * 1000);
}

function contentFor(message) {
  const type = message.type || "unknown";
  const content = { type };
  if (type === "text") content.text = message.text?.body || "";
  if (["audio", "image", "document", "video", "sticker"].includes(type)) {
    const media = message[type] || {};
    content.media = {
      id: media.id || null,
      mimeType: media.mime_type || null,
      sha256: media.sha256 || null,
      filename: media.filename || null,
      caption: media.caption || null,
      voice: media.voice === true
    };
  }
  if (type === "reaction") content.reaction = {
    messageId: message.reaction?.message_id || null,
    emoji: message.reaction?.emoji || ""
  };
  if (type === "location") content.location = {
    latitude: message.location?.latitude ?? null,
    longitude: message.location?.longitude ?? null,
    name: message.location?.name || null,
    address: message.location?.address || null
  };
  if (type === "contacts") content.contacts = (message.contacts || []).map((contact) => ({
    name: contact.name || null,
    phones: contact.phones || [],
    emails: contact.emails || [],
    organization: contact.org || null
  }));
  if (type === "contacts") content.contacts = message.contacts || [];
  if (message.context) content.context = {
    messageId: message.context.id || null,
    from: message.context.from || null,
    forwarded: Boolean(message.context.forwarded),
    frequentlyForwarded: Boolean(message.context.frequently_forwarded)
  };
  if (message.errors) content.errors = message.errors;
  return content;
}

function parseWebhook(payload) {
  const messages = [];
  const statuses = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field && change.field !== "messages") continue;
      const value = change?.value || {};
      const metadata = value.metadata || {};
      const contactsByWaId = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact]));
      for (const message of value.messages || []) {
        const contact = contactsByWaId.get(message.from) || {};
        messages.push({
          messageId: message.id,
          phoneNumberId: metadata.phone_number_id || null,
          displayPhoneNumber: metadata.display_phone_number || null,
          from: message.from || null,
          contactName: contact.profile?.name || null,
          type: message.type || "unknown",
          content: contentFor(message),
          occurredAt: unixDate(message.timestamp),
          raw: message
        });
      }
      for (const status of value.statuses || []) {
        statuses.push({
          messageId: status.id,
          phoneNumberId: metadata.phone_number_id || null,
          recipientId: status.recipient_id || null,
          status: status.status || "unknown",
          occurredAt: unixDate(status.timestamp),
          conversation: status.conversation || null,
          pricing: status.pricing || null,
          errors: status.errors || null,
          raw: status
        });
      }
    }
  }
  return { messages, statuses };
}

module.exports = { contentFor, parseWebhook };
