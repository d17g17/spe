import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { healthService } from './services/healthService';

// Import layout components
import Layout from './components/layout/Layout';
import Sidebar from './components/layout/Sidebar';

// Import pages
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

// Import context providers
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const location = useLocation();
  
  // Initialize health monitoring when app starts
  useEffect(() => {
    // Start health monitoring with 30-second intervals
    healthService.startMonitoring(30000);
    
    // Cleanup on unmount
    return () => {
      healthService.stopMonitoring();
    };
  }, []);
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SettingsProvider>
          <NotificationProvider>
            <ErrorBoundary>
              <div className="app-container bg-black min-h-screen text-white">
                <div className="flex h-screen overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    <Layout>
                      <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                          <Route path="/" element={<HomePage />} />
                          <Route path="/profile/:steamId" element={
                            <ErrorBoundary>
                              <ProfilePage />
                            </ErrorBoundary>
                          } />
                          <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                      </AnimatePresence>
                    </Layout>
                  </main>
                </div>
              </div>
            </ErrorBoundary>
          </NotificationProvider>
        </SettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
