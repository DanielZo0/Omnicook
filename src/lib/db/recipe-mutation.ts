import "server-only";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { withPlannerTransaction } from "./planner-transaction";
// Share the planner's owner lock across the complete multi-statement recipe edit.
export async function withRecipeMutation<T>(
  ownerId: string,
  fn: (tx: NeonDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return withPlannerTransaction(ownerId, (client) =>
    fn(drizzle(client, { schema })),
  );
}
