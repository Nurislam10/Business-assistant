const { getConfig } = require("../config");

class WhatsAppClient {
  constructor(config = getConfig(), fetchImpl = global.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  assertConfigured() {
    if (!this.config.accessToken || !this.config.phoneNumberId) {
      const error = new Error("whatsapp_not_configured");
      error.statusCode = 503;
      throw error;
    }
  }

  async graph(path, options = {}) {
    this.assertConfigured();
    const response = await this.fetch(
      `https://graph.facebook.com/${this.config.graphApiVersion}/${path}`,
      {
        ...options,
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          "content-type": "application/json",
          ...(options.headers || {})
        }
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || "meta_graph_api_error");
      error.statusCode = response.status;
      error.metaCode = data.error?.code;
      throw error;
    }
    return data;
  }

  sendMessage(to, message) {
    return this.graph(`${this.config.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...message })
    });
  }

  sendText(to, body, replyTo) {
    return this.sendMessage(to, {
      type: "text",
      text: { preview_url: false, body },
      ...(replyTo ? { context: { message_id: replyTo } } : {})
    });
  }

  sendTemplate(to, name, languageCode, components = []) {
    return this.sendMessage(to, {
      type: "template",
      template: { name, language: { code: languageCode }, ...(components.length ? { components } : {}) }
    });
  }
}

module.exports = { WhatsAppClient };
