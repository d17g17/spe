import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import SettingsSidebar from '../settings/SettingsSidebar';
import ItemPriceManager from '../itemPrices/ItemPriceManager';

const Sidebar = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [showItemPrices, setShowItemPrices] = useState(false);
  return (
    <motion.aside 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut", type: "tween" }}
      className="w-16 md:w-64 bg-slate-950/50 border-r border-slate-800 h-screen flex flex-col transition-all duration-200"
    >
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-center md:justify-start">
          <svg className="h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
          </svg>
          <span className="text-white font-bold text-lg ml-3 hidden md:block">Steam Explorer</span>
        </div>
      </div>
      
      <nav className="flex-1 px-2 py-4 space-y-2">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            isActive 
              ? "flex items-center px-4 py-3 text-white bg-blue-600 rounded-lg transition-all duration-200"
          : "flex items-center px-4 py-3 text-slate-400 hover:bg-slate-900/50 hover:text-white rounded-lg transition-all duration-200"
          }
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="ml-4 hidden md:block">Home</span>
        </NavLink>
        

        
        <div className="pt-4 border-t border-slate-800">
          <h3 className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:block">
            Tools
          </h3>
        </div>
        
        <div 
          className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-900/50 hover:text-white rounded-lg transition-all duration-200 cursor-pointer"
          onClick={() => setShowItemPrices(true)}
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="ml-4 hidden md:block">Item Prices</span>
        </div>
        
        <div 
          className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-900/50 hover:text-white rounded-lg transition-all duration-200 cursor-pointer"
          onClick={() => setShowSettings(true)}
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="ml-4 hidden md:block">Settings</span>
        </div>
      </nav>
      

      
      {/* Settings Sidebar */}
      <SettingsSidebar 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
      
      {/* Item Price Manager */}
      <ItemPriceManager 
        isOpen={showItemPrices} 
        onClose={() => setShowItemPrices(false)} 
      />
    </motion.aside>
  );
};

export default Sidebar;
