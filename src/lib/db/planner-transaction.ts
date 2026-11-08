import "server-only";
import { Pool, type PoolClient } from "@neondatabase/serverless";
export type PlannerClient = PoolClient;
export class PlannerError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function withPlannerTransaction<T>(
  ownerId: string,
  fn: (client: PlannerClient) => Promise<T>,
  lockOwner = true,
): Promise<T> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", () => {});
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (lockOwner)
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [ownerId],
      );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}
