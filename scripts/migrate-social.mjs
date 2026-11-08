import fs from "node:fs";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { migrateSocial } from "./social-migration.mjs";
const [file, host] = process.argv.slice(2);
if (!file?.includes("integration") || !host)
  throw Error("Explicit integration env and verified host required.");
const e = dotenv.parse(fs.readFileSync(file));
if (
  e.NEON_BRANCH_KIND !== "integration" ||
  new URL(e.DATABASE_URL).hostname !== host ||
  host.includes("-pooler")
)
  throw Error("Integration endpoint mismatch.");
await migrateSocial(neon(e.DATABASE_URL));
console.log("Additive social schema ready on the verified integration branch.");
