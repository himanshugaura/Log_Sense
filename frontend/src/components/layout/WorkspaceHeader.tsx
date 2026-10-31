import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Sun, Moon, ArrowLeft } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { useTheme } from '../../context/ThemeContext';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface WorkspaceHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  backLink?: {
    label: string;
    path: string;
  };
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ breadcrumbs, backLink }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100 font-display text-base font-bold tracking-tight mr-2"
        >
          <div className="w-6 h-6 rounded-md bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h10M4 18h14" />
            </svg>
          </div>
          <span>LogSense</span>
        </Link>

        {/* Breadcrumb Trail */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                {item.path && !isLast ? (
                  <Link
                    to={item.path}
                    className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? 'font-semibold text-neutral-900 dark:text-neutral-100'
                        : ''
                    }
                  >
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {backLink && (
          <Link
            to={backLink.path}
            className="hidden md:flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors mr-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLink.label}</span>
          </Link>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-7 h-7 rounded-full border border-neutral-700',
            },
          }}
        />
      </div>
    </header>
  );
};
