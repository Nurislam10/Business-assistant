const fs = require("fs");
const path = require("path");
const { getPool } = require("../src/db");

async function main() {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is required");
  await pool.query(fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8"));
  await pool.end();
  console.log("Database schema applied");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
