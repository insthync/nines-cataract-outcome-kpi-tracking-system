import { runCataract } from './cataract-tests.mjs';
// Uses a fresh OS temporary database. Never opens pocketbase/pb_data.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import net from "node:net";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = mkdtempSync(join(tmpdir(), "pb-crud-starter-test-"));
const binary = join(root, "pocketbase", process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
const args = [`--dir=${dataDir}`, `--migrationsDir=${root}/pocketbase/pb_migrations`, `--hooksDir=${root}/pocketbase/pb_hooks`];
const password = randomBytes(18).toString("hex");
const testPort = await new Promise((resolvePort) => { const listener = net.createServer(); listener.listen(0, "127.0.0.1", () => { const port = listener.address().port; listener.close(() => resolvePort(port)); }); });
const base = `http://127.0.0.1:${testPort}`;
let server;
let logs = "";
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function cli(command) {
  const result = spawnSync(binary, [...command, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || /^Error:/m.test(result.stdout + result.stderr)) throw new Error(result.error?.message || result.stdout + result.stderr);
}
async function request(path, method = "GET", body, token) {
  const response = await fetch(base + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function login(identity) {
  const result = await request("/api/collections/users/auth-with-password", "POST", { identity, password });
  check(result.status === 200, `login ${identity}`); return result.data;
}
async function cleanup() {
  if (server && server.exitCode === null) { const closed = new Promise((done) => server.once("exit", done)); server.kill(); await closed; }
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
try {
  cli(["migrate", "up"]); cli(["migrate", "up"]);
  cli(["superuser", "upsert", "bootstrap@example.test", password]);
  server = spawn(binary, ["serve", `--http=127.0.0.1:${testPort}`, `--publicDir=${root}/public`, "--indexFallback=false", ...args], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => { logs += chunk; }); server.stderr.on("data", (chunk) => { logs += chunk; });
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/api/health")).ok) { ready = true; break; } } catch {} await new Promise((done) => setTimeout(done, 100)); }
  check(ready, "server ready");
  const superAuth = await request("/api/collections/_superusers/auth-with-password", "POST", { identity: "bootstrap@example.test", password });
  check(superAuth.status === 200, "bootstrap login");
  const su = superAuth.data.token;
  const accounts = {};
  for (const role of ["viewer", "editor", "admin"]) {
    const result = await request("/api/collections/users/records", "POST", { email: `${role}@example.test`, password, passwordConfirm: password, name: `Test ${role}`, role, active: true }, su);
    check(result.status === 200, `create ${role}`); accounts[role] = await login(`${role}@example.test`);
  }
  await runCataract({ request, check, accounts, su, password, base });
  console.log(`PASS: ${checks} API, authorization, validation, pagination and static-serving checks.`);
  if (process.argv.includes("--preview")) {
    console.log(JSON.stringify({ previewUrl: base, admin: "admin@example.test", editor: "editor@example.test", viewer: "viewer@example.test", password, temporary: true }));
    process.on("SIGINT", async () => { await cleanup(); process.exit(0); });
    process.on("SIGTERM", async () => { await cleanup(); process.exit(0); });
    await new Promise(() => {});
  }
} catch (error) { console.error(error.message); console.error(logs); process.exitCode = 1; }
finally { await cleanup(); }
