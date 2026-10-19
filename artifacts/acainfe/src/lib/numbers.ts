/** Converte percentuais digitados em pontos-base sem multiplicar decimais. */
export function percentToBps(input: string): number | null {
  const value = input.trim().replace('%', '').replace(',', '.');
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Formata os pontos-base inteiros devolvidos pela API para o input. */
export function bpsToPercent(bps: number): string {
  return `${Math.trunc(bps / 100)},${String(bps % 100).padStart(2, '0')}`;
}

// Dinheiro continua em centavos, com o formatador BRL já usado pelo app.
export { brl as formatCents } from '../config/pricing';
