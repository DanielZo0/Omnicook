import fs from "node:fs";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";
const [file, host, output, compare] = process.argv.slice(2);
if (!file || !host || !output?.startsWith(".superpowers/"))
  throw Error("Explicit env, verified host and ignored output required.");
const env = dotenv.parse(fs.readFileSync(file));
const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
if (new URL(url).hostname !== host) throw Error("Database endpoint mismatch.");
const pool = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 10000,
});
pool.on("error", () => {});
let c;
try {
  c = await pool.connect();
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const tables = (
    await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'social_%' ORDER BY tablename",
    )
  ).rows;
  const data = {};
  for (const { tablename: t } of tables) {
    if (!/^[a-z_]+$/.test(t)) throw Error("Unexpected table");
    const rows = (
      await c.query(`SELECT to_jsonb(r) record FROM public."${t}" r`)
    ).rows
      .map((r) => canonical(r.record))
      .sort();
    data[t] = {
      count: rows.length,
      hash: createHash("sha256").update(rows.join("\n")).digest("hex"),
    };
  }
  await c.query("COMMIT");
  if (compare) {
    const before = JSON.parse(fs.readFileSync(compare));
    if (JSON.stringify(before) !== JSON.stringify(data))
      throw Error(
        "Business data changed: inspect before/after before proceeding.",
      );
  }
  fs.writeFileSync(output, JSON.stringify(data, null, 2));
  console.log(
    Object.entries(data).map(([table, r]) => ({ table, count: r.count })),
  );
  if (compare)
    console.log("Exact original business-table counts and hashes preserved.");
} finally {
  c?.release();
  await pool.end();
}
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
