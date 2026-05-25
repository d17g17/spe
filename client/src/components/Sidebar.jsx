import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ItemPriceManager from '../features/prices/ItemPriceManager.jsx';
import ProxyManager from '../features/proxies/ProxyManager.jsx';
import SettingsPanel from './SettingsPanel.jsx';

export default function Sidebar() {
  const [panel, setPanel] = useState(null); // 'prices' | 'proxies' | 'settings' | null

  const open = (id) => setPanel(id);
  const close = () => setPanel(null);

  const widths = {
    prices: 'max-w-2xl',
    proxies: 'max-w-2xl',
    settings: 'max-w-md',
  };

  return (
    <>
      <aside className="w-16 shrink-0 border-r border-gray-800 bg-gray-900/40 flex flex-col items-center py-4 gap-3">
        <Link to="/" title="Profiles" className="w-10 h-10 rounded-md bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 flex items-center justify-center text-lg font-bold">S</Link>
        <SideBtn label="Item prices" symbol="$" active={panel === 'prices'} onClick={() => open('prices')} />
        <SideBtn label="Proxies" symbol="⇆" active={panel === 'proxies'} onClick={() => open('proxies')} />
        <SideBtn label="Settings" symbol="⚙" active={panel === 'settings'} onClick={() => open('settings')} />
      </aside>
      <AnimatePresence>
        {panel && (
          <motion.div
            key={panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className={`fixed top-0 right-0 h-screen w-full ${widths[panel]} bg-gray-900 border-l border-gray-800 z-20 shadow-2xl`}
          >
            {panel === 'prices' && <ItemPriceManager onClose={close} />}
            {panel === 'proxies' && <ProxyManager onClose={close} />}
            {panel === 'settings' && <SettingsPanel onClose={close} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SideBtn({ label, symbol, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${active ? 'bg-sky-600/30 text-sky-200' : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-300'}`}
    >
      {symbol}
    </button>
  );
}
