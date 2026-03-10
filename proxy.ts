import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => typeof token?.legacyUserId === "number",
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/business/:path*", "/matches/:path*"],
};