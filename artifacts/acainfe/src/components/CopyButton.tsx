import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Copy, CheckCheck } from 'lucide-react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  return <button className="copy-button" type="button" onClick={async () => {
    try {
      await navigator.clipboard.writeText(text); setCopied(true); setError(false);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setError(true); }
  }}>{copied ? <CheckCheck size={16} /> : <Copy size={16} />}{error ? 'Selecione e copie' : copied ? 'Copiado!' : 'Copiar'}</button>;
}
