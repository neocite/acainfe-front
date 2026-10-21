export type CoverageCity = { cityCode: string; cityName: string; uf: string; regimes: string[] };
export type PublicCoverage = { cities: CoverageCity[] };

export const FALLBACK_COVERAGE: PublicCoverage = { cities: [
  { cityCode: '3550308', cityName: 'São Paulo', uf: 'SP', regimes: ['MEI', 'SIMPLES_NACIONAL'] },
  { cityCode: '3548708', cityName: 'São Bernardo do Campo', uf: 'SP', regimes: ['MEI', 'SIMPLES_NACIONAL'] },
] };

export function parseCoverage(data: unknown): PublicCoverage {
  const cities = (data as PublicCoverage | null)?.cities;
  if (!Array.isArray(cities) || !cities.every(c =>
    c && typeof c.cityCode === 'string' && typeof c.cityName === 'string' && c.cityName.trim()
    && typeof c.uf === 'string' && Array.isArray(c.regimes) && c.regimes.every(r => typeof r === 'string'))) {
    throw new Error('Invalid coverage');
  }
  return { cities: [...cities].sort((a, b) =>
    Number(b.cityCode === '3550308') - Number(a.cityCode === '3550308') || a.cityName.localeCompare(b.cityName, 'pt-BR')) };
}

export function joinNames(names: string[], conjunction = 'e') {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${conjunction} ${names.at(-1)}`;
}

export function regimeLabels(regimes: string[]) {
  return joinNames(regimes.map(r => r === 'SIMPLES_NACIONAL' ? 'Simples Nacional' : r));
}

function citiesText(cities: CoverageCity[], style: 'faq' | 'waitlist' | 'seo') {
  return joinNames(cities.map(c => {
    if (style === 'seo') return `${c.cityName}${c.uf === 'SP' ? '' : ` (${c.uf})`}`;
    if (c.cityCode === '3550308') return `${c.cityName} (capital)`;
    return `${c.cityName}${style === 'faq' ? ` (${c.uf})` : `/${c.uf}`}`;
  }), style === 'faq' ? 'ou de' : 'e');
}

export function coverageFaq({ cities }: PublicCoverage) {
  const regimes = regimeLabels([...new Set(cities.flatMap(c => c.regimes))]);
  const intro = cities.length ? `Sim, se a sua empresa for de ${citiesText(cities, 'faq')}, para ${regimes}. ` : '';
  return `${intro}Em outras cidades, cadastre-se para entrar na lista de espera: avisamos por e-mail e WhatsApp quando a sua cidade for liberada.`;
}

export function coverageWaitlist({ cities }: PublicCoverage) {
  if (!cities.length) return 'Estamos ampliando a cobertura municipal.';
  const regimes = [...new Set(cities.flatMap(c => c.regimes))].sort((a, b) => Number(a === 'MEI') - Number(b === 'MEI'));
  return `Por enquanto, atendemos ${citiesText(cities, 'waitlist')}, para ${regimeLabels(regimes)}.`;
}

export function coverageDescription({ cities }: PublicCoverage) {
  if (!cities.length) return '';
  return `Disponível em ${citiesText(cities, 'seo')}${cities.every(c => c.uf === 'SP') ? ' (SP)' : ''}.`;
}
