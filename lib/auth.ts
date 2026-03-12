import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { AuthUserRole } from "@/generated/prisma/client";
import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import { recordAuthDiagnostic } from "@/lib/auth-diagnostics";
import { prisma } from "@/lib/prisma";

type LegacyUserLookup = {
  email: string | null;
  first_name: string | null;
  full_name: string | null;
  id: number;
  last_name: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

function buildDisplayName(
  legacyUser: LegacyUserLookup,
  fallbackName?: string | null,
) {
  if (legacyUser.full_name?.trim()) {
    return legacyUser.full_name.trim();
  }

  const composedName = [legacyUser.first_name, legacyUser.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();

  if (composedName) {
    return composedName;
  }

  if (fallbackName?.trim()) {
    return fallbackName.trim();
  }

  return legacyUser.email ?? null;
}

async function findLegacyUserByEmail(email: string) {
  return prisma.users.findFirst({
    select: {
      email: true,
      first_name: true,
      full_name: true,
      id: true,
      last_name: true,
    },
    where: {
      email: {
        equals: normalizeEmail(email),
        mode: "insensitive",
      },
    },
  });
}

function createApprovedUsersAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(prisma as never) as Adapter;

  return {
    ...baseAdapter,
    async createUser(userData: Omit<AdapterUser, "id">) {
      const normalizedEmail = userData.email
        ? normalizeEmail(userData.email)
        : null;

      if (!normalizedEmail) {
        throw new Error("Approved Google accounts must provide an email.");
      }

      const legacyUser = await findLegacyUserByEmail(normalizedEmail);

      if (!legacyUser) {
        throw new Error("AccessDenied");
      }

      return prisma.user.create({
        data: {
          email: normalizedEmail,
          emailVerified: userData.emailVerified ?? null,
          image: userData.image ?? null,
          legacyUserId: legacyUser.id,
          name: buildDisplayName(legacyUser, userData.name),
          role: "user",
        },
      }) as Promise<AdapterUser>;
    },
    async getUserByEmail(email: string) {
      return prisma.user.findFirst({
        where: {
          email: {
            equals: normalizeEmail(email),
            mode: "insensitive",
          },
        },
      }) as Promise<AdapterUser | null>;
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: createApprovedUsersAdapter(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.legacyUserId = (
          user as typeof user & { legacyUserId?: number }
        ).legacyUserId;
        token.role = (user as typeof user & { role?: AuthUserRole }).role;
      }

      const normalizedEmail = user?.email
        ? normalizeEmail(user.email)
        : token.email
          ? normalizeEmail(token.email)
          : null;

      if (normalizedEmail) {
        token.email = normalizedEmail;

        const authUser = await prisma.user.findFirst({
          select: {
            legacyUserId: true,
            role: true,
          },
          where: {
            email: {
              equals: normalizedEmail,
              mode: "insensitive",
            },
          },
        });

        if (authUser) {
          token.legacyUserId = authUser.legacyUserId;
          token.role = authUser.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.legacyUserId =
          typeof token.legacyUserId === "number"
            ? token.legacyUserId
            : undefined;
        session.user.role =
          token.role === "admin" || token.role === "user"
            ? token.role
            : "user";
        session.user.email = token.email ?? session.user.email;
        session.user.name = token.name ?? session.user.name;
      }

      return session;
    },
    async signIn({ user }) {
      const email = user.email ? normalizeEmail(user.email) : null;

      if (!email) {
        recordAuthDiagnostic("AccessDenied", {
          message: "Google profile did not include an email address.",
          user,
        });
        return "/login?error=AccessDenied";
      }

      const legacyUser = await findLegacyUserByEmail(email);

      if (!legacyUser) {
        recordAuthDiagnostic("AccessDenied", {
          email,
          message:
            "Google sign-in was rejected because the email does not exist in the legacy users table.",
        });
      }

      return legacyUser ? true : "/login?error=AccessDenied";
    },
  },
  pages: {
    error: "/login",
    signIn: "/login",
  },
  logger: {
    error(code, metadata) {
      recordAuthDiagnostic(code, metadata);
      console.error("[next-auth]", code, metadata);
    },
  },
  providers: [
    GoogleProvider({
      authorization: {
        params: {
          access_type: "offline",
          include_granted_scopes: "true",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.compose",
          ].join(" "),
        },
      },
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
};
