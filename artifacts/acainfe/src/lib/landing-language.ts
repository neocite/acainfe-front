import type { PublicCoverage } from './coverage';
import type { PublicPricing } from './public-site-content';
export type LandingLocale = 'pt' | 'en';
export const EN_HOME_TITLE = 'açaínfe: automatic Brazilian service invoices for AbacatePay, with AI agents (MCP)';
export const EN_IMAGE_ALT = 'açaínfe: Sold. Invoice sent. Automatic Brazilian service invoices for AbacatePay';
export function landingLanguage(locale: LandingLocale = 'pt') {
  return {
    t: (pt: string, en: string) => locale === 'en' ? en : pt,
    money: (cents: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100),
  };
}
export function englishRegimes(regimes: string[]) {
  return regimes.map(r => r === 'SIMPLES_NACIONAL' ? 'Simples Nacional' : r === 'MEI' ? 'MEI' : r.replaceAll('_', ' ')).join(' and ');
}
export function englishCities(coverage: PublicCoverage) {
  return coverage.cities.map(city => `${city.cityName}${city.cityCode === '3550308' ? ' (city)' : ''}/${city.uf}`).join(' and ');
}
export function englishDescription(pricing: PublicPricing, coverage: PublicCoverage) {
  return `Automatic Brazilian service invoices (NFS-e) for AbacatePay sales, operable by AI agents via MCP. ${landingLanguage('en').money(pricing.pricePerInvoiceCents)} per invoice. ${pricing.monthlyFeeCents === 0 ? 'No monthly fee.' : `${landingLanguage('en').money(pricing.monthlyFeeCents)} monthly fee.`} Available in ${englishCities(coverage)} for MEI and Simples Nacional businesses.`;
}
export const EN_STEPS = [
  { number: '01', title: 'Connect your platform', copy: 'Connect AbacatePay or Hotmart just once.' },
  { number: '02', title: 'Set up your services', copy: 'Map each product with help from your assistant.' },
  { number: '03', title: 'Sell. The invoice follows.', copy: 'Each approved payment triggers an invoice.' },
];
export function englishFaq(price: number, coverage: PublicCoverage) {
  return [
    { q: 'Do I need a digital certificate?', a: 'Yes, an A1 certificate (.pfx), the same one used with Brazil’s e-CAC. It is encrypted and used only to sign your invoices.' },
    { q: 'Is my city supported?', a: coverage.cities.length ? `Yes, for MEI and Simples Nacional businesses in ${englishCities(coverage)}. In other cities, sign up for the waiting list: we will notify you by email and WhatsApp when your city is supported.` : 'We are expanding municipal coverage. Sign up for the waiting list to be notified when your city is supported.' },
    { q: 'Do I need to understand taxes?', a: 'No. The assistant explains each choice in plain Portuguese, and you confirm it. If in doubt, check with your accountant: everything is recorded.' },
    { q: 'What if the municipal system goes offline?', a: 'Your invoice is queued and issued automatically when the system is back.' },
    { q: 'Can I cancel an invoice?', a: 'Yes, through your assistant. AbacatePay refunds automatically cancel the invoice.' },
    { q: 'What if I have no sales this month?', a: 'You pay nothing. There is no monthly fee, setup fee or plan: you only pay for successfully issued invoices.' },
    { q: 'How am I charged?', a: `${landingLanguage('en').money(price)} per successfully issued invoice. Invoices rejected by the municipality are not charged.` },
    { q: 'Are you part of AbacatePay or Hotmart?', a: 'No. açaínfe is an independent product for businesses selling through AbacatePay and Hotmart.' },
  ];
}
