function write(level, event, fields = {}) {
  const record = { level, event, timestamp: new Date().toISOString(), ...fields };
  const output = JSON.stringify(record);
  (level === "error" ? console.error : console.log)(output);
}

module.exports = {
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields)
};
