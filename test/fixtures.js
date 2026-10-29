const textPayload = {
  object: "whatsapp_business_account",
  entry: [{ id: "waba-1", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "15550001111", phone_number_id: "phone-1" },
    contacts: [{ profile: { name: "Aruzhan" }, wa_id: "77001234567" }],
    messages: [{ from: "77001234567", id: "wamid.message-1", timestamp: "1700000000", type: "text", text: { body: "Сәлем" } }]
  }}]}]
};

const statusPayload = {
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "phone-1" },
    statuses: [{ id: "wamid.message-2", status: "delivered", timestamp: "1700000010", recipient_id: "77001234567", pricing: { billable: true } }]
  }}]}]
};

module.exports = { statusPayload, textPayload };
