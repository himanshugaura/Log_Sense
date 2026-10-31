import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Terminal, ArrowRight, ShieldCheck, Activity, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between p-6 md:p-10 font-sans selection:bg-zinc-800 selection:text-white">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
            <Terminal className="w-4 h-4 text-zinc-200" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-zinc-100">
            LogSense
          </span>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-950 px-3.5 py-1.5 rounded-md transition-colors"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Main Hero Section */}
      <main className="max-w-4xl w-full mx-auto my-auto py-16 flex flex-col items-center text-center">
        {/* Minimal Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 text-xs font-mono mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Deterministic Incident Triage &bull; Drain3</span>
        </div>

        {/* Crisp Headline (No blue/purple gradients, pure crisp typography) */}
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-100 max-w-2xl leading-[1.15]">
          Root cause analysis for distributed cloud systems.
        </h1>

        {/* Minimal Subhead */}
        <p className="mt-5 text-sm md:text-base text-zinc-400 max-w-xl leading-relaxed">
          Parse raw log streams into dynamic templates, detect error spikes, and isolate cascading microservice failures with mathematical precision.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link
            href="/sign-up"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span>Start Triaging</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/sign-in"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 text-zinc-200 text-xs font-medium transition-colors"
          >
            Existing Project Login
          </Link>
        </div>

        {/* Minimal Feature Metrics / Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-16 text-left">
          <div className="p-4 rounded-lg border border-zinc-800/80 bg-zinc-900/30">
            <Cpu className="w-4 h-4 text-zinc-400 mb-2" />
            <div className="text-xs font-medium text-zinc-200">Drain3 Template Mining</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Online log clustering with zero regex training overhead.</div>
          </div>
          <div className="p-4 rounded-lg border border-zinc-800/80 bg-zinc-900/30">
            <Activity className="w-4 h-4 text-zinc-400 mb-2" />
            <div className="text-xs font-medium text-zinc-200">4-Factor RCA Engine</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Temporal, DAG transitive closure, error type, and trace correlation.</div>
          </div>
          <div className="p-4 rounded-lg border border-zinc-800/80 bg-zinc-900/30">
            <ShieldCheck className="w-4 h-4 text-zinc-400 mb-2" />
            <div className="text-xs font-medium text-zinc-200">Clerk + Neon Storage</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Enterprise session tokens, S3 object storage & serverless Postgres.</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto flex items-center justify-between text-xs text-zinc-500 font-mono border-t border-zinc-900 pt-6">
        <div>LogSense &bull; Production Observability</div>
        <div>Dark Mode Precision UI</div>
      </footer>
    </div>
  );
}
