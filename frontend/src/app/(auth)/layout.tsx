import Link from "next/link";
import { Terminal } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-between p-6">
      {/* Top Minimal Bar */}
      <header className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-zinc-100 hover:text-white transition-colors group"
        >
          <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 group-hover:border-zinc-700 transition-colors">
            <Terminal className="w-4 h-4 text-zinc-300" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-100">
            LogSense
          </span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 ml-1">
            v1.0
          </span>
        </Link>
        <div className="text-xs text-zinc-500 font-mono">
          Cloud Incident Triage
        </div>
      </header>

      {/* Centered Auth Card Container */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md flex flex-col items-center">
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-zinc-600 font-mono">
        &copy; 2026 LogSense &bull; High-precision SRE Observability
      </footer>
    </div>
  );
}
