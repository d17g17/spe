import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const Ctx = createContext(null);

// Lightweight global side-panel coordinator. The Sidebar component owns the
// visible panel; other parts of the app can request a panel + payload via
// `useSidePanel().openBreach({ ... })`.
//
// `openBreach` accepts either a single query (`{ term, fields }`) or a list
// (`{ queries: [{ term, fields }, ...] }`). The latter is fired as multiple
// requests in parallel and results are merged in the panel.
//
// `breachRequest` carries an incrementing `nonce` so the BreachSearch panel
// can react even when the same term is requested twice.
export function SidePanelProvider({ children }) {
  const [panel, setPanel] = useState(null);
  const [breachRequest, setBreachRequest] = useState(null);

  const closePanel = useCallback(() => setPanel(null), []);

  const openBreach = useCallback((payload = {}) => {
    const queries = Array.isArray(payload.queries) && payload.queries.length
      ? payload.queries
      : (payload.term ? [{ term: payload.term, fields: payload.fields }] : []);
    setBreachRequest({
      queries,
      subject: payload.subject || null,
      autoRun: payload.autoRun !== false,
      nonce: Date.now(),
    });
    setPanel('breach');
  }, []);

  const value = useMemo(() => ({
    panel, setPanel, closePanel,
    breachRequest, openBreach,
  }), [panel, breachRequest, closePanel, openBreach]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSidePanel() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSidePanel must be used inside <SidePanelProvider>');
  return ctx;
}
