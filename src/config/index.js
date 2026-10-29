function isConfigured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getConfig(env = process.env) {
  return {
    port: Number(env.PORT || 10000),
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: env.META_APP_SECRET || "",
    accessToken: env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || "",
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    databaseUrl: env.DATABASE_URL || "",
    graphApiVersion: env.META_GRAPH_API_VERSION || "v26.0"
  };
}

function publicStatus(config = getConfig()) {
  const webhookConfigured = isConfigured(config.verifyToken) && isConfigured(config.appSecret);
  const accessTokenConfigured = isConfigured(config.accessToken);
  const phoneNumberConfigured = isConfigured(config.phoneNumberId);
  const databaseConfigured = isConfigured(config.databaseUrl);
  return {
    configured: webhookConfigured && accessTokenConfigured && phoneNumberConfigured && databaseConfigured,
    webhookConfigured,
    accessTokenConfigured,
    phoneNumberConfigured,
    databaseConfigured
  };
}

module.exports = { getConfig, isConfigured, publicStatus };
