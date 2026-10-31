import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] transition-colors py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-neutral-100 dark:border-neutral-850">
          <div className="max-w-md">
            <Link to="/" className="flex items-center gap-2.5 text-neutral-900 dark:text-neutral-100 font-display text-xl font-bold tracking-tight">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M4 6h16M4 12h10M4 18h14" />
                  <circle cx="19" cy="12" r="2" fill="#b45309" stroke="#b45309" />
                </svg>
              </div>
              <span>LogSense</span>
            </Link>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              AI-powered incident triage platform for cloud applications. Find the real error, trace the responsible service, and resolve incidents with evidence-backed hypotheses.
            </p>
          </div>

          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center gap-6 text-sm text-neutral-600 dark:text-neutral-400">
            <a href="#hero" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Home</a>
            <a href="#features" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">How It Works</a>
            <Link to="/dashboard" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors font-medium">Dashboard</Link>
            <a href="#faq" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">FAQ</a>
          </nav>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-500">
          <p>© {new Date().getFullYear()} LogSense. Built for Cloud & Site Reliability Engineers.</p>
          <div className="flex items-center gap-4">
            <span>Public LogHub Benchmark Compatible</span>
            <span aria-hidden="true">·</span>
            <span>Frontend Preview Mode</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
