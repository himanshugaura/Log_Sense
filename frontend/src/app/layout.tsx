import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { QueryProvider } from "@/providers/query-provider";
import { AuthSyncProvider } from "@/providers/auth-sync-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogSense — AI Incident Triage",
  description: "Minimalist, deterministic incident triage and log intelligence for cloud applications.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: {
          colorPrimary: "#ffffff",
          borderRadius: "0.5rem",
        },
        elements: {
          card: "border border-zinc-800 bg-[#0e0e11] shadow-2xl",
          formButtonPrimary:
            "bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium text-xs py-2.5 transition-colors shadow-none",
          socialButtonsBlockButton:
            "border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 text-xs py-2 transition-colors",
          footerActionLink: "text-zinc-300 hover:text-white underline-offset-4",
          formFieldInput:
            "border-zinc-800 bg-zinc-950/80 text-zinc-100 text-xs focus:border-zinc-600 focus:ring-0",
          headerTitle: "text-zinc-100 font-semibold tracking-tight text-lg",
          headerSubtitle: "text-zinc-400 text-xs",
        },
      }}
    >
      <html lang="en" className="dark h-full antialiased">
        <body className="min-h-full flex flex-col bg-[#09090b] text-[#fafafa]">
          <QueryProvider>
            <Suspense fallback={null}>
              <AuthSyncProvider>{children}</AuthSyncProvider>
            </Suspense>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
