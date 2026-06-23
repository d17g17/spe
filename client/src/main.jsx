import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { queryClient } from './lib/queryClient.js';
import { NotificationProvider } from './state/NotificationContext.jsx';
import { SettingsProvider } from './state/SettingsContext.jsx';
import { SidePanelProvider } from './state/SidePanelContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <NotificationProvider>
            <SidePanelProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </SidePanelProvider>
          </NotificationProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
