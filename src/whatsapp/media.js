const { getConfig } = require("../config");

class WhatsAppMediaService {
  constructor(config = getConfig(), fetchImpl = global.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  headers() {
    if (!this.config.accessToken) {
      const error = new Error("whatsapp_not_configured");
      error.statusCode = 503;
      throw error;
    }
    return { authorization: `Bearer ${this.config.accessToken}` };
  }

  async getMetadata(mediaId) {
    if (!/^[A-Za-z0-9_-]+$/.test(mediaId)) throw new Error("invalid_media_id");
    const response = await this.fetch(
      `https://graph.facebook.com/${this.config.graphApiVersion}/${mediaId}`,
      { headers: this.headers() }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || "media_metadata_error");
    return data;
  }

  async download(mediaId) {
    const metadata = await this.getMetadata(mediaId);
    const response = await this.fetch(metadata.url, { headers: this.headers() });
    if (!response.ok) throw new Error("media_download_error");
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || metadata.mime_type || "application/octet-stream",
      sha256: metadata.sha256 || null
    };
  }
}

module.exports = { WhatsAppMediaService };
