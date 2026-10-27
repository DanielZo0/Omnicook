import 'server-only';
import {neon} from '@neondatabase/serverless';
import {PlannerError} from '../db/planner-transaction';
export async function claimProviderRequest(ownerId:string,providerId:string){
 const sql=neon(process.env.DATABASE_URL!);const hour=new Date().toISOString().slice(0,13);
 for(const [key,limit] of [[`${providerId}:project:${hour}`,600],[`${providerId}:${ownerId}:${hour}`,100]] as const){
  const rows=await sql`INSERT INTO planner_provider_budgets(budget_key,used,expires_at) VALUES(${key},1,now()+interval '2 hours') ON CONFLICT(budget_key) DO UPDATE SET used=planner_provider_budgets.used+1 WHERE planner_provider_budgets.used<${limit} RETURNING used`;
  if(!rows.length)throw new PlannerError('The source request budget is temporarily exhausted. Try again later.',429);
 }
 await sql`DELETE FROM planner_provider_budgets WHERE expires_at<now()`;
}
