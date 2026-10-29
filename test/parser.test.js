const test = require("node:test");
const assert = require("node:assert/strict");
const { parseWebhook } = require("../src/whatsapp/parser");
const { textPayload, statusPayload } = require("./fixtures");

test("parses inbound text and contact profile", () => {
  const result = parseWebhook(textPayload);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].messageId, "wamid.message-1");
  assert.equal(result.messages[0].contactName, "Aruzhan");
  assert.equal(result.messages[0].content.text, "Сәлем");
});

test("parses a message status event", () => {
  const result = parseWebhook(statusPayload);
  assert.equal(result.statuses.length, 1);
  assert.equal(result.statuses[0].status, "delivered");
  assert.equal(result.statuses[0].recipientId, "77001234567");
});
