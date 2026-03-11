import type { Session } from "next-auth";
import type { AuthUserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AppUserRole = AuthUserRole;

type SessionUserLike = Session["user"] | null | undefined;

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

export function isAdminRole(role: AppUserRole | null | undefined) {
  return role === "admin";
}

export async function getUserRoleByLegacyUserId(
  legacyUserId?: number | null,
): Promise<AppUserRole> {
  if (!legacyUserId) {
    return "user";
  }

  const authUser = await prisma.user.findUnique({
    select: {
      role: true,
    },
    where: {
      legacyUserId,
    },
  });

  return authUser?.role ?? "user";
}

export async function getUserRoleForSessionUser(
  sessionUser?: SessionUserLike,
): Promise<AppUserRole> {
  if (!sessionUser) {
    return "user";
  }

  if (sessionUser.id) {
    const authUserById = await prisma.user.findUnique({
      select: {
        role: true,
      },
      where: {
        id: sessionUser.id,
      },
    });

    if (authUserById?.role) {
      return authUserById.role;
    }
  }

  if (sessionUser.email) {
    const authUserByEmail = await prisma.user.findFirst({
      select: {
        role: true,
      },
      where: {
        email: {
          equals: normalizeEmail(sessionUser.email),
          mode: "insensitive",
        },
      },
    });

    if (authUserByEmail?.role) {
      return authUserByEmail.role;
    }
  }

  if (sessionUser.legacyUserId) {
    return getUserRoleByLegacyUserId(sessionUser.legacyUserId);
  }

  return sessionUser.role === "admin" ? "admin" : "user";
}