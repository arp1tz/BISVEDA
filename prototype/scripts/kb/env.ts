/**
 * Minimal .env loader for standalone tsx scripts (no Next.js env loading here).
 */
import fs from "fs";
import path from "path";

export function loadEnv() {
  const candidates = [
    path.resolve(__dirname, "../../.env"), // prototype/.env
    path.resolve(__dirname, "../../../.env"), // repo root .env
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
