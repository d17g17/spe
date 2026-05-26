import { useState, useEffect, useRef } from 'react';

const PREFIX = 'spe:';

export default function usePersistedState(key, initial) {
  const fullKey = PREFIX + key;
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw == null) return initial;
      return JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  // skip first write so we don't churn storage on mount
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // quota / private mode -- ignore
    }
  }, [fullKey, value]);

  return [value, setValue];
}
