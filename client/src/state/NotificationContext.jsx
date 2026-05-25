import { createContext, useContext, useCallback, useState, useMemo } from 'react';

const Ctx = createContext(null);

let nextId = 1;

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((s) => s.filter((i) => i.id !== id));
  }, []);

  const push = useCallback((type, message, opts = {}) => {
    const id = nextId++;
    const ttl = opts.ttl ?? 4000;
    setItems((s) => [...s, { id, type, message }]);
    if (ttl > 0) setTimeout(() => remove(id), ttl);
    return id;
  }, [remove]);

  const value = useMemo(() => ({
    items,
    remove,
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
    warn: (m, o) => push('warn', m, o),
  }), [items, remove, push]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNotifications = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotifications must be used inside NotificationProvider');
  return v;
};
