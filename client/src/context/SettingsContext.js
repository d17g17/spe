import React, { createContext, useContext, useState, useEffect } from 'react';

// Default settings
const defaultSettings = {
  autoFetchFriends: true, // Auto-fetch friends by default
  alwaysUseCachedFriends: true, // Always use cached friends by default
};

// Create settings context
const SettingsContext = createContext();

// Settings provider component
export const SettingsProvider = ({ children }) => {
  // Try to load settings from localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('steamAppSettings');
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
      // Error loading settings from localStorage
      return defaultSettings;
    }
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('steamAppSettings', JSON.stringify(settings));
    } catch (error) {
      // Error saving settings to localStorage
    }
  }, [settings]);

  // Update a single setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Reset settings to default
  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// Hook to use settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
