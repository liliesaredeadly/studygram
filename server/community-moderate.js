const { resolve } = require("node:path");
const { openCommunity } = require("./community");

function run([command, value, ...rest]) {
  const id = Number(value);
  const showReports = command === "reports" && value === undefined;
  const changeVisibility = ["hide", "restore"].includes(command) && /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0;
  if (rest.length || (!showReports && !changeVisibility)) {
    throw new Error("Usage: node server/community-moderate.js reports | hide <message-id> | restore <message-id>");
  }
  const { db, rooms } = openCommunity();
  try {
    const result = showReports ? rooms.listReports() : rooms.moderate({ targetId: id, action: command });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    db.close();
  }
}

try {
  try {
    process.loadEnvFile(resolve(__dirname, "..", ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
