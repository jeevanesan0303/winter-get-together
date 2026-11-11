
import {
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";

import { spawnSync } from "node:child_process";

import {
  existsSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";

import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const email = (
  process.env.ADMIN_EMAIL || ""
).trim().toLowerCase();

const password =
  process.env.ADMIN_PASSWORD || "";

if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  throw new Error("Invalid ADMIN_EMAIL.");
}

if (
  password.length < 16 ||
  password.length > 256
) {
  throw new Error(
    "Password must contain 16â€“256 characters."
  );
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

const sql = `
UPDATE admin_users
SET password_hash = '${storedHash}'
WHERE email = '${escapeSQL(email)}'
  AND is_active = 1;

UPDATE admin_sessions
SET revoked_at =
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE admin_id IN (
  SELECT id
  FROM admin_users
  WHERE email = '${escapeSQL(email)}'
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
  throw new Error("Wrangler is not installed.");
}

let tempDirectory;

try {
  tempDirectory = mkdtempSync(
    join(tmpdir(), "wgt-admin-reset-")
  );

  const sqlPath = join(
    tempDirectory,
    "reset.sql"
  );

  writeFileSync(sqlPath, sql, {
    encoding: "utf8",
    mode: 0o600,
  });

  console.log(
    "Updating the existing production administrator..."
  );

  const result = spawnSync(
    process.execPath,
    [
      wranglerPath,
      "d1",
      "execute",
      "winter-get-together-db",
      "--remote",
      "--file",
      sqlPath,
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
      "Production password reset failed."
    );
  }

  console.log(
    "Production password update completed."
  );

  console.log(
    "Existing admin sessions have been revoked."
  );
} finally {
  if (tempDirectory) {
    rmSync(tempDirectory, {
      recursive: true,
      force: true,
    });
  }
}

