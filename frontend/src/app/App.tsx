import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { router } from './router';
import { ThemeProvider } from '../context/ThemeContext';
import { ProjectProvider } from '../context/ProjectContext';
import { setAuthTokenGetter } from '../services/api/client';

const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_cG9wdWxhci1tYWdwaWUtOTIzMS5jbGVyay5hY2NvdW50cy5kZXYk';

const AuthBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#e5e5e5',
          colorBackground: '#0a0a0a',
          colorInputBackground: '#171717',
          colorInputText: '#ededed',
          colorText: '#ededed',
          colorTextSecondary: '#a1a1aa',
        },
      }}
    >
      <AuthBridge>
        <ThemeProvider>
          <ProjectProvider>
            <RouterProvider router={router} />
          </ProjectProvider>
        </ThemeProvider>
      </AuthBridge>
    </ClerkProvider>
  );
};

export default App;
