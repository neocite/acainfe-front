import * as React from 'react';
import type { ReactNode } from 'react';

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label className="app-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}
