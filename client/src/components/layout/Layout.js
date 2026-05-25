import React from 'react';
import { motion } from 'framer-motion';
import Header from './Header';

const Layout = ({ children }) => {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <motion.div 
        className="flex-1 p-6 overflow-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ 
          duration: 0.2, 
          ease: "easeOut",
          type: "tween"
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default Layout;
