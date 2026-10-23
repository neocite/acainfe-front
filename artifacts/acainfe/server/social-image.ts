import express from 'express';
import path from 'node:path';
import { access } from 'node:fs/promises';
import sharp from 'sharp';
import { brl } from '../src/config/pricing';
import { coverageDescription, type PublicCoverage } from '../src/lib/coverage';
import { englishCities, landingLanguage, type LandingLocale } from '../src/lib/landing-language';

export const SOCIAL_IMAGE_PATH = '/api/og.png?v=2';
export const SOCIAL_IMAGE_ALT = 'açaínfe: Vendeu. A nota foi. NFS-e automática para AbacatePay';
export const SOCIAL_CACHE_SECONDS = 86400;
const fonts = path.resolve(import.meta.dirname, '../assets/fonts');
export const SOCIAL_FONTS = {
  display: { file: path.join(fonts, 'BricolageGrotesque-ExtraBold.ttf'), family: 'Bricolage Grotesque 12pt ExtraBold' },
  logo: { file: path.join(fonts, 'Manrope-ExtraBold.ttf'), family: 'Manrope ExtraBold' },
  mono: { file: path.join(fonts, 'DMMono-Regular.ttf'), family: 'DM Mono' },
  body: { file: path.join(fonts, 'DMSans-Regular.ttf'), family: 'DM Sans' },
} as const;
type SocialData = { pricePerInvoiceCents: number; coverage: PublicCoverage; locale?: LandingLocale };
const escapeMarkup = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Pango loads each bundled font file explicitly; no browser or system font fallback. */
async function textLayer(markup: string, font: keyof typeof SOCIAL_FONTS, size: number, color: string, tracking = 0, maxWidth = 1060) {
  const face = SOCIAL_FONTS[font];
  await access(face.file); // A missing deploy asset must fail, not silently switch fonts.
  const layer = await sharp({ text: {
    text: `<span foreground="${color}" letter_spacing="${Math.round(tracking * 1024)}">${markup}</span>`,
    font: `${face.family} ${size}`, fontfile: face.file, dpi: 72, rgba: true,
  } }).png().toBuffer();
  const { width = 0 } = await sharp(layer).metadata();
  return width > maxWidth ? sharp(layer).resize({ width: maxWidth }).png().toBuffer() : layer;
}

export async function renderSocialImage(data: SocialData): Promise<Buffer> {
  const english = data.locale === 'en';
  const cream = '#fbf7ef', plum = '#351333', acai = '#7B2D6B', muted = '#746871';
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="${cream}"/>
    <path d="M64 116H1136M64 518H1136" stroke="${plum}" stroke-opacity=".13"/>
    <rect x="1092" y="58" width="44" height="4" fill="#f2a52d"/>
    <circle cx="71" cy="162" r="11" fill="#4b795f" fill-opacity=".12"/>
    <circle cx="71" cy="162" r="5" fill="#4b795f"/>
    <rect x="958" y="219" width="178" height="178" fill="none" stroke="${plum}" stroke-opacity=".13"/>
    <rect x="975" y="236" width="144" height="144" fill="#f2a52d"/>
    <path d="M1010 345L1084 271M1038 271H1084V317" fill="none" stroke="${plum}" stroke-width="4"/>
    <circle cx="133" cy="44" r="5" fill="#f2a52d"/>
  </svg>`);
  const layers = await Promise.all([
    textLayer('aça<span foreground="#8c4b79">í</span>nfe', 'logo', 43, plum, -3.44),
    textLayer(english ? 'INVOICES ON AUTOPILOT' : 'NOTA FISCAL NO AUTOMÁTICO', 'mono', 13, acai, 1.1),
    textLayer(english ? 'Sold.' : 'Vendeu.', 'display', 126, plum, -7.5, 850),
    textLayer(english ? 'Invoice sent.' : 'A nota foi.', 'display', 126, acai, -7.5, 850),
    textLayer(escapeMarkup(english ? `${landingLanguage('en').money(data.pricePerInvoiceCents)} per invoice · no monthly fee` : `${brl(data.pricePerInvoiceCents)} por nota · sem mensalidade`), 'body', 29, plum),
    textLayer(english ? 'Automatic NFS-e for AbacatePay · AI agents via MCP' : 'NFS-e automática para AbacatePay · agentes de IA via MCP', 'body', 21, muted),
    textLayer(escapeMarkup(english ? `Available in ${englishCities(data.coverage)}.` : coverageDescription(data.coverage)), 'body', 19, muted),
  ]);
  const positions = [[64, 44], [94, 155], [60, 208], [60, 322], [66, 452], [64, 546], [64, 583]];
  return sharp(background).composite(layers.map((input, index) => ({
    input, left: positions[index][0], top: positions[index][1],
  }))).png().toBuffer();
}

export function createSocialImageRouter(options: {
  pricing: () => Promise<{ pricePerInvoiceCents: number }>;
  coverage: () => Promise<PublicCoverage>;
  now?: () => number;
  render?: typeof renderSocialImage;
}) {
  const router = express.Router();
  const now = options.now ?? Date.now;
  type Entry = { png: Buffer; createdAt: number };
  const cache = new Map<LandingLocale, Entry>();
  const pending = new Map<LandingLocale, Promise<Entry>>();
  async function image(locale: LandingLocale) {
    const cached = cache.get(locale);
    if (cached && now() - cached.createdAt < SOCIAL_CACHE_SECONDS * 1000) return cached;
    if (!pending.has(locale)) pending.set(locale, (async () => {
      const [pricing, coverage] = await Promise.all([options.pricing(), options.coverage()]);
      const png = await (options.render ?? renderSocialImage)({ pricePerInvoiceCents: pricing.pricePerInvoiceCents, coverage, ...(locale === 'en' ? { locale } : {}) });
      const entry = { png, createdAt: now() };
      cache.set(locale, entry);
      return entry;
    })().finally(() => { pending.delete(locale); }));
    return pending.get(locale)!;
  }
  router.get(['/api/og.png', '/api/og.svg', '/api/og-en.png'], async (req, res, next) => {
    try {
      const { png, createdAt } = await image(req.path === '/api/og-en.png' ? 'en' : 'pt');
      res.set('Cache-Control', `public, max-age=${SOCIAL_CACHE_SECONDS}`);
      res.set('Age', String(Math.max(0, Math.floor((now() - createdAt) / 1000))));
      if (req.path.endsWith('.svg')) {
        // Keep the old SVG link usable with the same embedded, correctly rendered fonts.
        res.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><image width="1200" height="630" href="data:image/png;base64,${png.toString('base64')}"/></svg>`);
      } else res.type('png').send(png);
    } catch (error) { next(error); }
  });
  return router;
}
