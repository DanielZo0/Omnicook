import "server-only";
import { isAuthConfigured, neonAuth } from "../auth/server";
import { moderatorFor, type SocialActor } from "./actor-policy";
export async function socialActor(): Promise<SocialActor | null> {
  if (!isAuthConfigured()) return null;
  const { data } = await neonAuth().getSession();
  const user = data?.user;
  if (!user?.id) return null;
  return {
    userId: user.id,
    verifiedEmail:
      user.emailVerified === true ? user.email?.toLowerCase() || null : null,
    isModerator: moderatorFor(user, process.env.SOCIAL_MODERATOR_EMAILS || ""),
  };
}
