import { useState } from 'react';
import { Plus } from 'lucide-react';

export type FaqItem = { q: string; a: string };

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="ac-faq">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q} className={`ac-faq__item ${isOpen ? 'is-open' : ''}`}>
            <h3 style={{ margin: 0 }}>
              <button className="ac-faq__q" aria-expanded={isOpen} aria-controls={`faq-${i}`} id={`faq-b-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span>{it.q}</span><span className="pm"><Plus size={16} /></span>
              </button>
            </h3>
            <div className="ac-faq__a" id={`faq-${i}`} role="region" aria-labelledby={`faq-b-${i}`}><div><p>{it.a}</p></div></div>
          </div>
        );
      })}
    </div>
  );
}
