
import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const email = (
  process.env.ADMIN_EMAIL || ""
).trim().toLowerCase();

const password = process.env.ADMIN_PASSWORD || "";

const displayName = (
  process.env.ADMIN_NAME || "Administrator"
).trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Please provide a valid ADMIN_EMAIL.");
}

if (password.length < 16 || password.length > 256) {
  throw new Error(
    "ADMIN_PASSWORD must contain between 16 and 256 characters."
  );
}

if (!displayName || displayName.length > 100) {
  throw new Error("Please provide a valid admin display name.");
}

const salt = randomBytes(16);
const iterations = 210000;

const hash = pbkdf2Sync(
  password,
  salt,
  iterations,
  32,
  "sha256"
);

const storedHash = [
  "pbkdf2_sha256",
  iterations,
  salt.toString("hex"),
  hash.toString("hex"),
].join("$");

const escapeSQL = (value) =>
  value.replaceAll("'", "''");

const adminId = randomUUID();

const sql = `
INSERT INTO admin_users (
  id,
  email,
  display_name,
  password_hash,
  role,
  is_active
)
VALUES (
  '${adminId}',
  '${escapeSQL(email)}',
  '${escapeSQL(displayName)}',
  '${storedHash}',
  'super_admin',
  1
);
`;

const wranglerPath = resolve(
  process.cwd(),
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
);

if (!existsSync(wranglerPath)) {
  throw new Error(
    "Wrangler is not installed. Run npm install inside backend."
  );
}

console.log("Creating administrator in production D1...");

const result = spawnSync(
  process.execPath,
  [
    wranglerPath,
    "d1",
    "execute",
    "winter-get-together-db",
    "--remote",
    "--command",
    sql,
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true,
  }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(
    `Administrator creation failed with exit code ${result.status}.`
  );
}

console.log("Production administrator created successfully.");
console.log(`Admin email: ${email}`);
console.log(`Admin name: ${displayName}`);

