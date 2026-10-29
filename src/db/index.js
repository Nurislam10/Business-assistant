const { Pool } = require("pg");
const { getConfig } = require("../config");
const logger = require("../logger");

let pool;

function getPool() {
  const { databaseUrl } = getConfig();
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 5000 });
    pool.on("error", (error) => logger.error("database_pool_error", { message: error.message }));
  }
  return pool;
}

async function query(text, params = []) {
  const database = getPool();
  if (!database) {
    const error = new Error("database_not_configured");
    error.code = "DATABASE_NOT_CONFIGURED";
    error.statusCode = 503;
    throw error;
  }
  return database.query(text, params);
}

async function transaction(callback) {
  const database = getPool();
  if (!database) return query("SELECT 1");
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function health() {
  try {
    if (!getPool()) return { configured: false, reachable: false };
    await query("SELECT 1");
    return { configured: true, reachable: true };
  } catch (error) {
    return { configured: true, reachable: false };
  }
}

module.exports = { getPool, health, query, transaction };
