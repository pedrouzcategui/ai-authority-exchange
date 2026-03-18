import type { Metadata } from "next";
import Image from "next/image";
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
  title: "A.I Authority Exchange",
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
            <div className="mx-auto grid w-full max-w-8xl gap-4 px-6 py-4 sm:px-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-start lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center lg:px-12">
              <div className="md:min-w-0">
                <Link
                  className="block text-foreground transition hover:text-accent"
                  href={homeHref}
                >
                  <Image
                    alt="First Page Sage"
                    className="block h-auto w-28 sm:w-32"
                    height={42}
                    src="/fps.png"
                    width={148}
                  />
                  {/* <span className="mt-2 block text-lg font-semibold tracking-tight">
                    A.I Authority Exchange
                  </span> */}
                </Link>
              </div>

              <HeaderNavigation
                isAuthenticated={Boolean(session?.user?.legacyUserId)}
              />

              <div className="md:justify-self-end lg:justify-self-auto">
                <AuthControls user={session?.user ?? null} />
              </div>
            </div>
          </header>

          {children}
        </div>
        <AppToaster />
      </body>
    </html>
  );
}
