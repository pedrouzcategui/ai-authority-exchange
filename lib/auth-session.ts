import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireLegacyUserSession() {
  const session = await getAuthSession();

  return session?.user?.legacyUserId ? session : null;
}
