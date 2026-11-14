const fs = require("fs");
const path = require("path");

function namesIn(source, constName) {
  const match = source.match(new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`Could not read ${constName}`);
  return [...match[1].matchAll(/"([A-Z0-9_]+)"/g)].map((item) => item[1]);
}

function loadDotEnv(file) {
  const env = {};
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function targetFromArgs(argv) {
  const index = argv.indexOf("--target");
  if (index === -1) return "";
  return argv[index + 1] || "";
}

function reportLocal(env, label, required, optional) {
  const missing = required.filter((name) => !String(env[name] || "").trim());
  console.log(label);
  for (const name of required) {
    console.log(`${missing.includes(name) ? "FAIL" : "PASS"} ${name}`);
  }
  for (const name of optional) {
    console.log(`${String(env[name] || "").trim() ? "SET " : "SKIP"} ${name} (optional)`);
  }
  if (missing.length) {
    console.log(`${missing.length} required missing`);
    return 1;
  }
  console.log("required env is present");
  return 0;
}

async function reportRemote(origin, secret, required) {
  const url = `${origin.replace(/\/$/, "")}/api/health/env`;
  console.log(url);
  const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    console.log("FAIL production rejected CRON_SECRET");
    return 1;
  }
  if (!res.ok) {
    console.log(`FAIL production env check returned ${res.status}`);
    return 1;
  }
  const missing = new Set(body.missing || []);
  for (const name of required) {
    console.log(`${missing.has(name) ? "FAIL" : "PASS"} ${name}`);
  }
  for (const item of body.optional || []) {
    console.log(`${item.set ? "SET " : "SKIP"} ${item.name} (optional)`);
  }
  for (const problem of body.problems || []) console.log(`FAIL ${problem}`);
  if (!body.ok) {
    console.log("required env is missing on production");
    return 1;
  }
  console.log("required env is present");
  return 0;
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "lib", "required-env.js"), "utf8");
  const REQUIRED_ENV = namesIn(source, "REQUIRED_ENV");
  const OPTIONAL_ENV = namesIn(source, "OPTIONAL_ENV");
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) {
    console.log("FAIL .env.local is missing");
    process.exit(1);
  }
  const env = loadDotEnv(file);
  const target = targetFromArgs(process.argv);
  if (!target) {
    process.exit(reportLocal(env, ".env.local", REQUIRED_ENV, OPTIONAL_ENV));
  }
  if (!String(env.CRON_SECRET || "").trim()) {
    console.log("FAIL CRON_SECRET is missing in .env.local, so production cannot be checked");
    process.exit(1);
  }
  process.exit(await reportRemote(target, env.CRON_SECRET.trim(), REQUIRED_ENV));
}

main().catch((error) => {
  console.log(`FAIL ${error.message}`);
  process.exit(1);
});
