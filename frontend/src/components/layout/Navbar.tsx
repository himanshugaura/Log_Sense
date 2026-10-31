import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Sun, Moon, ArrowRight } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';

interface NavbarProps {
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuthModal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isLandingPage = location.pathname === '/';

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (!isLandingPage) {
      navigate(`/#${sectionId}`);
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const navItems = [
    { label: 'Home', action: () => scrollToSection('hero') },
    { label: 'Features', action: () => scrollToSection('features') },
    { label: 'How It Works', action: () => scrollToSection('how-it-works') },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'FAQ', action: () => scrollToSection('faq') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-neutral-900 dark:text-neutral-100 font-display text-xl font-bold tracking-tight whitespace-nowrap shrink-0 group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 transition-transform group-hover:scale-105">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 6h16M4 12h10M4 18h14" />
              <circle cx="19" cy="12" r="2" fill="#b45309" stroke="#b45309" />
            </svg>
          </div>
          <span>LogSense</span>
        </Link>

        {/* Desktop Nav Zone */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600 dark:text-neutral-400"
        >
          {navItems.map((item) => {
            if (item.path) {
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
                      : 'hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions Zone: Theme toggle, Clerk Auth, Dashboard CTA */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/organizations')}
            >
              Workspaces
            </Button>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8 rounded-full border border-neutral-700',
                },
              }}
            />
          </SignedIn>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="p-2 rounded-xl text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] px-4 pt-3 pb-5 space-y-3 shadow-lg">
          <div className="flex flex-col space-y-1">
            {navItems.map((item) => {
              if (item.path) {
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                  >
                    {item.label}
                  </Link>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="outline" size="md" className="w-full justify-center">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="primary" size="md" className="w-full justify-center">
                  Get Started
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/organizations');
                }}
              >
                Go to Workspaces
              </Button>
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
};
