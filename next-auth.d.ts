import type { DefaultSession, DefaultUser } from "next-auth";
import type { AuthUserRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      legacyUserId?: number;
      role: AuthUserRole;
    };
  }

  interface User extends DefaultUser {
    legacyUserId?: number;
    role?: AuthUserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    legacyUserId?: number;
    role?: AuthUserRole;
  }
}
