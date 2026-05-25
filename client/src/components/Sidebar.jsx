import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ItemPriceManager from '../features/prices/ItemPriceManager.jsx';
import SettingsPanel from './SettingsPanel.jsx';

export default function Sidebar() {
  const [prices, setPrices] = useState(false);
  const [settings, setSettings] = useState(false);

  return (
    <>
      <aside className="w-16 shrink-0 border-r border-gray-800 bg-gray-900/40 flex flex-col items-center py-4 gap-3">
        <Link to="/" className="w-10 h-10 rounded-md bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 flex items-center justify-center text-lg font-bold">S</Link>
        <button onClick={() => setPrices(true)} title="Item prices" className="w-10 h-10 rounded-md bg-gray-800/60 hover:bg-gray-700/60 flex items-center justify-center text-gray-300">$</button>
        <button onClick={() => setSettings(true)} title="Settings" className="w-10 h-10 rounded-md bg-gray-800/60 hover:bg-gray-700/60 flex items-center justify-center text-gray-300">⚙</button>
      </aside>
      <AnimatePresence>
        {prices && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }}
            className="fixed top-0 right-0 h-screen w-full max-w-2xl bg-gray-900 border-l border-gray-800 z-20 shadow-2xl">
            <ItemPriceManager onClose={() => setPrices(false)} />
          </motion.div>
        )}
        {settings && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }}
            className="fixed top-0 right-0 h-screen w-full max-w-md bg-gray-900 border-l border-gray-800 z-20 shadow-2xl">
            <SettingsPanel onClose={() => setSettings(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
