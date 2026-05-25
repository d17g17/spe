import React, { useState, memo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useNotification } from '../../context/NotificationContext';
import { useDeleteAllProfiles } from '../../services/reactQueryHooks';
import InventoryStatsIndicator from '../common/InventoryStatsIndicator';

const Header = memo(() => {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useTheme();
  const { showSuccess, showError } = useNotification();
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Delete all profiles mutation
  const deleteAllMutation = useDeleteAllProfiles();
  
  const handleDeleteAll = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete ALL profiles? This action cannot be undone.')) {
      try {
        await deleteAllMutation.mutateAsync();
        showSuccess('All profiles successfully deleted');
        setShowDropdown(false);
      } catch (error) {
        showError(`Failed to delete profiles: ${error.message}`);
      }
    }
  }, [deleteAllMutation, showSuccess, showError]);

  const handleToggleDropdown = useCallback(() => {
    setShowDropdown(!showDropdown);
  }, [showDropdown]);

  const handleCloseDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  return (
    <header className="bg-slate-950/50 border-b border-slate-800 py-4 px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Steam <span className="text-blue-500">Profile</span> Explorer
          </Link>
        </div>

        <div className="flex-1 mx-4">
          <InventoryStatsIndicator />
        </div>

        <div className="flex items-center space-x-4">
          {location.pathname === '/' && (
            <div className="relative">
              <button
                onClick={handleToggleDropdown}
                className="btn btn-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z" clipRule="evenodd" />
                </svg>
                Actions
              </button>
              
              {showDropdown && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-slate-950/90 border border-slate-700 rounded-lg shadow-lg z-10 py-1"
                  onClick={handleCloseDropdown}
                >
                  <button 
                    onClick={handleDeleteAll}
                    className="w-full text-left px-4 py-2 text-white hover:bg-slate-900/50 transition duration-200"
                  >
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Delete All Profiles
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
          
          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-white hover:bg-slate-900/50 transition duration-200"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
});

export default Header;
