const crypto = require("crypto");
const db = require("./index");

function eventKey(rawBody) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

async function persistWebhook(rawBody, payload, parsed) {
  return db.transaction(async (client) => {
    const key = eventKey(rawBody);
    const eventResult = await client.query(
      `INSERT INTO webhook_events (event_key, source, payload, processing_status)
       VALUES ($1, 'whatsapp', $2::jsonb, 'PROCESSING')
       ON CONFLICT (event_key) DO NOTHING RETURNING id`,
      [key, JSON.stringify(payload)]
    );
    if (!eventResult.rowCount) return { duplicate: true, messages: 0, statuses: 0 };

    let insertedMessages = 0;
    for (const message of parsed.messages) {
      const contactResult = await client.query(
        `INSERT INTO whatsapp_contacts (wa_id, phone_number, display_name, profile_name, last_seen_at)
         VALUES ($1, $1, $2, $2, $3)
         ON CONFLICT (wa_id) DO UPDATE SET
           display_name = COALESCE(EXCLUDED.display_name, whatsapp_contacts.display_name),
           profile_name = COALESCE(EXCLUDED.profile_name, whatsapp_contacts.profile_name),
           last_seen_at = GREATEST(whatsapp_contacts.last_seen_at, EXCLUDED.last_seen_at),
           updated_at = now()
         RETURNING id`,
        [message.from, message.contactName, message.occurredAt]
      );
      const contactId = contactResult.rows[0].id;
      const threadResult = await client.query(
        `INSERT INTO whatsapp_threads (contact_id, phone_number_id, external_thread_id, last_message_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone_number_id, external_thread_id) DO UPDATE SET
           last_message_at = GREATEST(whatsapp_threads.last_message_at, EXCLUDED.last_message_at),
           updated_at = now()
         RETURNING id`,
        [contactId, message.phoneNumberId, message.from, message.occurredAt]
      );
      const threadId = threadResult.rows[0].id;
      const messageResult = await client.query(
        `INSERT INTO whatsapp_messages
          (thread_id, whatsapp_message_id, direction, message_type, text_body, content, raw_payload, occurred_at)
         VALUES ($1, $2, 'INBOUND', $3, $4, $5::jsonb, $6::jsonb, $7)
         ON CONFLICT (whatsapp_message_id) DO NOTHING`,
        [threadId, message.messageId, message.type, message.content.text || message.content.media?.caption || null,
          JSON.stringify(message.content), JSON.stringify(message.raw), message.occurredAt]
      );
      insertedMessages += messageResult.rowCount;
      if (messageResult.rowCount) {
        await client.query("UPDATE whatsapp_threads SET unread_count = unread_count + 1 WHERE id = $1", [threadId]);
      }
    }

    let insertedStatuses = 0;
    for (const status of parsed.statuses) {
      const result = await client.query(
        `INSERT INTO whatsapp_message_statuses
          (whatsapp_message_id, status, recipient_id, conversation, pricing, errors, raw_payload, occurred_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
         ON CONFLICT (whatsapp_message_id, status, occurred_at) DO NOTHING`,
        [status.messageId, status.status, status.recipientId, JSON.stringify(status.conversation),
          JSON.stringify(status.pricing), JSON.stringify(status.errors), JSON.stringify(status.raw), status.occurredAt]
      );
      insertedStatuses += result.rowCount;
      await client.query(
        `UPDATE whatsapp_messages SET latest_status = $2, updated_at = now()
         WHERE whatsapp_message_id = $1`,
        [status.messageId, status.status]
      );
    }

    await client.query(
      `UPDATE webhook_events SET processing_status = 'PROCESSED', processed_at = now(),
       message_count = $2, status_count = $3 WHERE id = $1`,
      [eventResult.rows[0].id, insertedMessages, insertedStatuses]
    );
    return { duplicate: false, messages: insertedMessages, statuses: insertedStatuses };
  });
}

async function markFailed(rawBody, error) {
  try {
    await db.query(
      `UPDATE webhook_events SET processing_status = 'FAILED', error_message = $2, processed_at = now()
       WHERE event_key = $1`,
      [eventKey(rawBody), String(error.message || error).slice(0, 1000)]
    );
  } catch (_) {}
}

async function listThreads(limit = 50) {
  const result = await db.query(
    `SELECT t.id, t.external_thread_id, t.phone_number_id, t.unread_count, t.last_message_at,
       COALESCE(c.display_name, c.profile_name, c.phone_number, c.wa_id) AS contact_name,
       c.phone_number, m.text_body AS last_message, m.message_type AS last_message_type
     FROM whatsapp_threads t
     JOIN whatsapp_contacts c ON c.id = t.contact_id
     LEFT JOIN LATERAL (
       SELECT text_body, message_type FROM whatsapp_messages
       WHERE thread_id = t.id ORDER BY occurred_at DESC LIMIT 1
     ) m ON true
     ORDER BY t.last_message_at DESC NULLS LAST LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getThread(id) {
  const result = await db.query("SELECT * FROM whatsapp_threads WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function listMessages(threadId, limit = 100) {
  const result = await db.query(
    `SELECT id, whatsapp_message_id, direction, message_type, text_body, content,
       latest_status, occurred_at, created_at
     FROM whatsapp_messages WHERE thread_id = $1
     ORDER BY occurred_at ASC LIMIT $2`,
    [threadId, limit]
  );
  await db.query("UPDATE whatsapp_threads SET unread_count = 0, updated_at = now() WHERE id = $1", [threadId]);
  return result.rows;
}

async function saveOutbound(threadId, response, request) {
  const id = response.messages?.[0]?.id;
  if (!id) throw new Error("meta_response_missing_message_id");
  const result = await db.query(
    `INSERT INTO whatsapp_messages
      (thread_id, whatsapp_message_id, direction, message_type, text_body, content, raw_payload, latest_status, occurred_at)
     VALUES ($1, $2, 'OUTBOUND', $3, $4, $5::jsonb, $6::jsonb, 'accepted', now())
     ON CONFLICT (whatsapp_message_id) DO UPDATE SET updated_at = now() RETURNING *`,
    [threadId, id, request.type, request.text?.body || null, JSON.stringify(request), JSON.stringify(response)]
  );
  await db.query("UPDATE whatsapp_threads SET last_message_at = now(), updated_at = now() WHERE id = $1", [threadId]);
  return result.rows[0];
}

module.exports = { eventKey, getThread, listMessages, listThreads, markFailed, persistWebhook, saveOutbound };
