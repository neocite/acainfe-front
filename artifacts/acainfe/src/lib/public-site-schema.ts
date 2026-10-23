import { AGENT_DESCRIPTION, type PublicSiteData } from './public-site-content';
import { englishDescription, type LandingLocale } from './landing-language';

const CANONICAL = 'https://acainfe.com';
export function structuredData(data: PublicSiteData, locale: LandingLocale = 'pt') {
  return { '@context': 'https://schema.org', '@graph': [
    {
      '@type': 'SoftwareApplication', '@id': `${CANONICAL}/#software`,
      name: 'açaínfe', url: CANONICAL, applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', inLanguage: locale === 'en' ? 'en' : 'pt-BR', description: locale === 'en' ? englishDescription(data.pricing, data.coverage) : AGENT_DESCRIPTION,
      offers: { '@type': 'Offer', price: (data.pricing.pricePerInvoiceCents / 100).toFixed(2), priceCurrency: 'BRL', description: locale === 'en' ? 'Per successfully issued service invoice, no monthly fee' : 'Por nota fiscal emitida com sucesso, sem mensalidade' },
      publisher: { '@id': `${CANONICAL}/#org` },
    },
    {
      '@type': 'Organization', '@id': `${CANONICAL}/#org`,
      name: 'EXTRACTIFY TECNOLOGIA LTDA', alternateName: 'açaínfe', url: CANONICAL,
      taxID: '28.095.894/0001-60', email: 'contato@extractify.com.br', telephone: '+55-11-3458-7367',
      address: { '@type': 'PostalAddress', streetAddress: 'Av. Pereira Barreto, 1479, sala 2108, Baeta Neves', addressLocality: 'São Bernardo do Campo', addressRegion: 'SP', postalCode: '09751-000', addressCountry: 'BR' },
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'contato@extractify.com.br', telephone: '+55-11-3458-7367', availableLanguage: 'pt-BR' },
    },
  ] };
}
