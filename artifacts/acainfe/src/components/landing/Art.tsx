import { Check } from 'lucide-react';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`ac-logo ${light ? 'ac-logo--light' : ''}`} aria-label="açaínfe">
      <span aria-hidden="true">aça<span className="i">ı<b /></span>nfe</span>
    </span>
  );
}

export function Bowl() {
  const banana = [[128, 150], [170, 134], [214, 140], [250, 160]];
  return (
    <svg className="ac-bowl" viewBox="0 0 400 360" role="img" aria-label="Tigela de açaí com banana, morango e granola">
      <defs>
        <radialGradient id="ac-g1" cx="38%" cy="25%" r="80%"><stop offset="0" stopColor="#9a3d88" /><stop offset=".55" stopColor="#5a2150" /><stop offset="1" stopColor="#2A0E2E" /></radialGradient>
        <linearGradient id="ac-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF8EE" /><stop offset="1" stopColor="#f0dcc6" /></linearGradient>
        <linearGradient id="ac-g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb54d" /><stop offset="1" stopColor="#FF9F1C" /></linearGradient>
      </defs>
      <ellipse cx="200" cy="334" rx="120" ry="12" fill="#2A0E2E" opacity=".18" />
      <path d="M44 168 Q48 300 200 312 Q352 300 356 168 Z" fill="url(#ac-g2)" />
      <path d="M44 168 Q48 300 200 312 Q352 300 356 168 Z" fill="none" stroke="#4A1942" strokeWidth="5" strokeLinejoin="round" />
      <path d="M78 214 Q200 250 322 214" fill="none" stroke="#FF9F1C" strokeWidth="9" strokeLinecap="round" />
      <path d="M96 244 Q200 272 304 244" fill="none" stroke="#7B2D6B" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 14" />
      <path d="M34 170 C34 90 120 60 200 60 C280 60 366 90 366 170 C340 192 60 192 34 170 Z" fill="url(#ac-g1)" stroke="#2A0E2E" strokeWidth="5" strokeLinejoin="round" />
      <path d="M78 118 Q118 84 168 80" fill="none" stroke="#d58bc6" strokeWidth="7" strokeLinecap="round" opacity=".55" />
      <ellipse cx="200" cy="176" rx="162" ry="16" fill="#2A0E2E" opacity=".35" />
      {banana.map(([x, y], i) => (
        <g key={i} transform={`rotate(${i * 11 - 14} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="30" ry="22" fill="#FFE7A3" stroke="#4A1942" strokeWidth="4" />
          <circle cx={x} cy={y} r="6" fill="#E8C16A" />
        </g>
      ))}
      <g transform="translate(150 96) rotate(-12)">
        <path d="M0 0 C-22 6 -28 38 0 52 C28 38 22 6 0 0Z" fill="#E0475B" stroke="#4A1942" strokeWidth="4" strokeLinejoin="round" />
        <path d="M-8 -2 L0 -14 L8 -2Z" fill="#2F9E5B" stroke="#4A1942" strokeWidth="3" strokeLinejoin="round" />
        {[[-8, 14], [8, 18], [0, 32], [-9, 30], [10, 32]].map(([a, b], i) => <ellipse key={i} cx={a} cy={b} rx="1.8" ry="2.6" fill="#FFE7A3" />)}
      </g>
      <g transform="translate(262 98) rotate(14)">
        <path d="M0 0 C-22 6 -28 38 0 52 C28 38 22 6 0 0Z" fill="#E0475B" stroke="#4A1942" strokeWidth="4" strokeLinejoin="round" />
        <path d="M-8 -2 L0 -14 L8 -2Z" fill="#2F9E5B" stroke="#4A1942" strokeWidth="3" strokeLinejoin="round" />
      </g>
      {[[196, 108, 20], [232, 120, -30], [118, 118, 40], [296, 132, 10], [96, 146, -20], [196, 160, 60], [306, 160, 25]].map(([x, y, r], i) => (
        <rect key={i} x={x} y={y} width="22" height="11" rx="5" fill="url(#ac-g3)" stroke="#4A1942" strokeWidth="2.5" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {[[224, 98], [186, 140], [276, 150]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill="#3b3f8f" stroke="#2A0E2E" strokeWidth="3" />)}
      <path d="M200 70 C196 40 214 22 240 22 C238 46 224 64 200 70Z" fill="#2F9E5B" stroke="#4A1942" strokeWidth="4" strokeLinejoin="round" />
      <path d="M204 66 Q220 46 236 28" fill="none" stroke="#1f7a43" strokeWidth="3" />
      <g transform="rotate(32 330 110)"><rect x="322" y="10" width="14" height="150" rx="7" fill="#FF9F1C" stroke="#4A1942" strokeWidth="4" /><ellipse cx="329" cy="8" rx="18" ry="24" fill="#FF9F1C" stroke="#4A1942" strokeWidth="4" /></g>
    </svg>
  );
}

export function Squiggle() {
  return (
    <svg viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true"><path d="M3 11 C40 2 70 16 110 8 S190 4 220 11 S280 6 297 9" fill="none" stroke="#FF9F1C" strokeWidth="6" strokeLinecap="round" /></svg>
  );
}

export function HandArrow() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M4 6 C34 0 58 14 40 46" stroke="#7B2D6B" strokeWidth="3" strokeLinecap="round" />
      <path d="M30 40 L40 48 L48 36" stroke="#7B2D6B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatCard() {
  return (
    <div className="ac-card ac-chat" aria-label="Exemplo de conversa com o assistente de IA">
      <div className="ac-chat__bar"><i /> Assistente de IA conectado ao açaínfe</div>
      <div className="ac-bubble ac-bubble--u">emite a nota do pedido da Maria</div>
      <div className="ac-chat__row" style={{ minHeight: 40 }}>
        <div className="ac-typing" aria-hidden="true"><i /><i /><i /></div>
        <div className="ac-bubble ac-bubble--a">
          Pronto! NFS-e nº 1234 emitida e enviada para maria@…
          <span className="tick"><Check size={12} strokeWidth={3} /></span>
          <div className="ac-doc" style={{ marginTop: 10 }}><span>NFS-e 1234</span><span>e-mail + WhatsApp</span></div>
        </div>
      </div>
    </div>
  );
}
