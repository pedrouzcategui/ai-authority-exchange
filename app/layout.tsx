import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthControls } from "@/components/auth-controls";
import { HeaderNavigation } from "@/components/header-navigation";
import { authOptions } from "@/lib/auth";
import { AppToaster } from "@/components/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Authority Exchange",
  description: "Create business matches and review the full match list.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const homeHref = session?.user?.legacyUserId ? "/matches" : "/";

  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} app-shell antialiased`}
      >
        <div className="relative min-h-screen">
          <header className="sticky top-0 z-40 border-b border-border bg-white/84 backdrop-blur-xl">
            <div className="mx-auto grid w-full max-w-8xl gap-4 px-6 py-4 sm:px-10 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center lg:px-12">
              <div className="space-y-1">
                <Link
                  className="inline-flex text-lg font-semibold tracking-tight text-foreground transition hover:text-accent"
                  href={homeHref}
                >
                  AI Authority Exchange
                </Link>
                <p className="text-sm text-muted">
                  Internal match workflow with approved Google access.
                </p>
              </div>

              <HeaderNavigation
                isAuthenticated={Boolean(session?.user?.legacyUserId)}
              />

              <AuthControls user={session?.user ?? null} />
            </div>
          </header>

          {children}
        </div>
        <AppToaster />
      </body>
    </html>
  );
}
