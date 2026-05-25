import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const SettingsSidebar = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: "easeOut", type: "tween" }}
            className="fixed right-0 top-0 h-full w-80 bg-slate-950/90 shadow-lg z-50 overflow-y-auto border-l border-slate-700"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Settings</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-slate-900/50 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white">Profile Options</h3>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                    <div>
                      <p className="text-white font-medium">Auto-Fetch Friends</p>
                      <p className="text-slate-400 text-sm">Automatically fetch friends when viewing a profile</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoFetchFriends}
                        onChange={(e) => updateSetting('autoFetchFriends', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                    <div>
                      <p className="text-white font-medium">Use Cached Friends</p>
                      <p className="text-slate-400 text-sm">Always use cached friend data when available</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.alwaysUseCachedFriends}
                        onChange={(e) => updateSetting('alwaysUseCachedFriends', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={resetSettings}
                    className="w-full py-2 px-4 bg-slate-900/50 hover:bg-slate-900/70 text-white rounded-md transition-all duration-200 border border-slate-700 hover:border-slate-600"
                  >
                    Reset to Default Settings
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsSidebar;
