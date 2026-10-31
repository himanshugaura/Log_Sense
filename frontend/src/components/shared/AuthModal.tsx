import React from 'react';
import { X } from 'lucide-react';
import { SignIn } from '@clerk/clerk-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121212] p-2 shadow-2xl text-neutral-900 dark:text-neutral-100 flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 z-20 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full pt-4 pb-2 px-2">
          <SignIn
            routing="virtual"
            afterSignInUrl="/dashboard"
            appearance={{
              elements: {
                card: 'bg-transparent shadow-none border-0',
                headerTitle: 'font-display font-bold text-neutral-900 dark:text-neutral-100',
                headerSubtitle: 'text-neutral-500 dark:text-neutral-400 text-xs',
                socialButtonsBlockButton: 'border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200',
                formButtonPrimary: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90',
                footerActionLink: 'text-neutral-900 dark:text-neutral-100 font-semibold',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};
