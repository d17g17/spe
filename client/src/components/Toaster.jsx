import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications } from '../state/NotificationContext.jsx';

const colors = {
  success: 'bg-emerald-600/90 border-emerald-400',
  error: 'bg-red-600/90 border-red-400',
  info: 'bg-sky-600/90 border-sky-400',
  warn: 'bg-amber-600/90 border-amber-400',
};

export default function Toaster() {
  const { items, remove } = useNotifications();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {items.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            className={`text-white text-sm px-4 py-3 rounded-md shadow-lg border ${colors[n.type] || colors.info} flex items-start gap-3`}
            onClick={() => remove(n.id)}
          >
            <span className="flex-1">{n.message}</span>
            <span className="opacity-70 hover:opacity-100 cursor-pointer">✕</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
