export type SocialActor = {
  userId: string;
  verifiedEmail: string | null;
  isModerator: boolean;
};
export function moderatorFor(
  user: { id: string; email?: string; emailVerified?: boolean },
  emails: string,
) {
  return (
    user.emailVerified === true &&
    !!user.email &&
    emails
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .includes(user.email.toLowerCase())
  );
}
