import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SplitSmart",
  description: "Share expenses with your group and see who owes whom.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white text-sm font-bold">
                S
              </span>
              SplitSmart
            </Link>
            <nav className="text-sm">
              <Link href="/" className="text-slate-600 dark:text-slate-300 hover:underline">
                Groups
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="mx-auto max-w-5xl px-4 py-3">
            Prototype: there is no sign-in, everyone shares the same data, and expenses are split equally.
          </div>
        </footer>
      </body>
    </html>
  );
}
