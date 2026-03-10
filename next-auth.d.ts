import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      legacyUserId?: number;
    };
  }

  interface User extends DefaultUser {
    legacyUserId?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    legacyUserId?: number;
  }
}
