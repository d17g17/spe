import React, { useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { useFetchProfileMutation } from '../../services/reactQueryHooks';
import { useNotification } from '../../context/NotificationContext';

const ProfileFetchForm = memo(() => {
  const [identifier, setIdentifier] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const { showSuccess, showError } = useNotification();
  
  const fetchProfileMutation = useFetchProfileMutation();
  
  // Use mutation loading state directly
  const isLoading = fetchProfileMutation.isLoading;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      showError('Please enter a Steam ID, vanity URL, or profile URL');
      return;
    }
    
    try {
      // Show loading notification without an ID
      showSuccess('Fetching profile...', { autoClose: false });
      
      const result = await fetchProfileMutation.mutateAsync({
        identifier: identifier.trim(),
        forceRefresh
      });
      
      // Show success notification
      showSuccess(`Successfully fetched profile: ${result.name}`);
      
      // Clear input after successful fetch
      setIdentifier('');
    } catch (error) {
      showError(`Failed to fetch profile: ${error.message}`);
    }
  }, [identifier, forceRefresh, fetchProfileMutation, showSuccess, showError]);
  
  const handleIdentifierChange = useCallback((e) => {
    setIdentifier(e.target.value);
  }, []);
  
  const handleForceRefreshChange = useCallback((e) => {
    setForceRefresh(e.target.checked);
  }, []);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.2, 
        ease: "easeOut",
        type: "tween"
      }}
      className="bg-slate-950/30 border border-slate-700 rounded-lg p-6 mb-6 shadow-lg hover:shadow-xl transition-all duration-200"
    >
      <div className="flex items-center mb-4">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
        <h3 className="text-lg font-semibold text-white">Fetch Steam Profile</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-slate-300 mb-2">
            Steam ID, Vanity URL, or Profile URL
          </label>
          <div className="relative">
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={handleIdentifierChange}
              placeholder="e.g., 76561198123456789 or https://steamcommunity.com/id/username"
              className="w-full px-4 py-3 bg-slate-950/30 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-600"
              disabled={isLoading}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          <div className="relative">
            <input
              type="checkbox"
              id="forceRefresh"
              checked={forceRefresh}
              onChange={handleForceRefreshChange}
              className="w-4 h-4 text-blue-600 bg-slate-950/30 border-slate-700 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
              disabled={isLoading}
            />
          </div>
          <label htmlFor="forceRefresh" className="ml-3 text-sm text-slate-300 select-none">
            Force refresh (bypass cache)
          </label>
        </div>
        
        <div className="flex justify-end pt-2">
          <motion.button
            type="submit"
            className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center min-w-[140px] ${
              isLoading 
                ? 'opacity-80 cursor-not-allowed' 
                : 'hover:from-blue-700 hover:to-blue-800 active:scale-[0.98]'
            }`}
            disabled={isLoading}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Profile
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
});

export default ProfileFetchForm;
