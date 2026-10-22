import * as React from 'react';

export function FiscalProfileWarning({ warning, busy, onCustom }: { warning?: string; busy: boolean; onCustom: () => void }) {
  if (!warning) return null;
  return <div className="app-notice" role="alert">
    <p>{warning}</p>
    <button type="button" className="app-secondary" disabled={busy} onClick={onCustom}>Mudar para Outro serviço</button>
  </div>;
}
