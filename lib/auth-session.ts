import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuthSession() {
  const session = await getAuthSession();

  return session?.user?.id ? session : null;
}

export async function requireLegacyUserSession() {
  const session = await getAuthSession();

  return session?.user?.legacyUserId ? session : null;
}
