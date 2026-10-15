import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/query-client';
import { ThemeProvider } from './lib/theme';
import { UiModeProvider } from './lib/ui-mode';
import { AuthProvider } from './lib/auth';
import { WorkspaceProvider } from './lib/workspace';
import { App } from './App';
import './i18n';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UiModeProvider>
          <BrowserRouter>
            <AuthProvider>
              <WorkspaceProvider>
                <App />
              </WorkspaceProvider>
            </AuthProvider>
          </BrowserRouter>
        </UiModeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
