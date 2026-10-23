import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import express from 'express';
import sharp from 'sharp';
import { createSocialImageRouter, renderSocialImage, SOCIAL_FONTS, SOCIAL_IMAGE_PATH, SOCIAL_CACHE_SECONDS } from '../server/social-image';
import { FALLBACK_COVERAGE } from '../src/lib/coverage';
import { createCoverageLoader } from '../server/public-coverage';

describe('Imagem social: fontes locais, PNG e cache compartilhado', () => {
  let server: Server, base: string, png: Buffer;
  let timestamp = 1000, renders = 0, pricingReads = 0, coverageReads = 0;
  let price = 80;
  const renderedData: unknown[] = [];
  before(async () => {
    png = await renderSocialImage({ pricePerInvoiceCents: 80, coverage: FALLBACK_COVERAGE });
    const app = express();
    // Production's generic API policy is overridden only by this public image.
    app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    app.use(createSocialImageRouter({
      now: () => timestamp,
      pricing: async () => { pricingReads++; return { pricePerInvoiceCents: price }; },
      coverage: async () => { coverageReads++; return createCoverageLoader(() => '')(); },
      render: async data => { renders++; renderedData.push(data); return png; },
    }));
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  after(async () => { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); });
  it('inclui os arquivos TrueType reais das famílias, sem depender de fontes do sistema', async () => {
    for (const [font, name] of [
      [SOCIAL_FONTS.display, 'Bricolage Grotesque'], [SOCIAL_FONTS.mono, 'DM Mono'],
      [SOCIAL_FONTS.body, 'DM Sans'], [SOCIAL_FONTS.logo, 'Manrope'],
    ] as const) {
      const bytes = await readFile(font.file);
      assert.equal(bytes.readUInt32BE(), 0x00010000, 'Fonte TrueType');
      assert.ok(bytes.includes(Buffer.from(name, 'utf16le').swap16()), `Metadados da família ${name}`);
    }
  });
  it('renderiza PNG 1200×630 com fundo creme e as duas cores do título', async () => {
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, 1200); assert.equal(meta.height, 630);
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([...data.subarray(0, 3)], [251, 247, 239]);
    function count(color: number[], top: number, height: number) {
      let n = 0;
      for (let y = top; y < top + height; y++) for (let x = 64; x < 900; x++) {
        const i = (y * info.width + x) * info.channels;
        if (color.every((v, c) => data[i + c] === v)) n++;
      }
      return n;
    }
    assert.ok(count([53, 19, 51], 208, 113) > 10000, 'Título plum');
    assert.ok(count([123, 45, 107], 322, 118) > 10000, 'Título açaí');
  });
  it('responde a pedidos concorrentes com uma única geração e usa os loaders públicos com fallback municipal', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => fetch(base + SOCIAL_IMAGE_PATH)));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    }
    assert.equal(renders, 1); assert.equal(pricingReads, 1); assert.equal(coverageReads, 1);
    assert.deepEqual(renderedData[0], { pricePerInvoiceCents: 80, coverage: FALLBACK_COVERAGE });
  });
  it('reutiliza a imagem no HEAD, no link antigo e no SVG, sem voltar a renderizar', async () => {
    timestamp += 5000;
    const head = await fetch(base + SOCIAL_IMAGE_PATH, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('age'), '5');
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const original = await fetch(base + '/api/og.png');
    assert.deepEqual(Buffer.from(await original.arrayBuffer()), png);
    const svg = await fetch(base + '/api/og.svg');
    assert.match(svg.headers.get('content-type')!, /^image\/svg\+xml/);
    assert.ok((await svg.text()).includes(`data:image/png;base64,${png.toString('base64')}`));
    assert.equal(renders, 1);
  });
  it('após um dia renova a imagem com o preço vigente', async () => {
    price = 95; timestamp += SOCIAL_CACHE_SECONDS * 1000;
    await fetch(base + SOCIAL_IMAGE_PATH);
    assert.equal(renders, 2); assert.equal(pricingReads, 2); assert.equal(coverageReads, 2);
    assert.deepEqual(renderedData[1], { pricePerInvoiceCents: 95, coverage: FALLBACK_COVERAGE });
  });
  it('preço e cobertura realmente mudam os pixels e conteúdo externo não vira marcação', async () => {
    const changedPrice = await renderSocialImage({ pricePerInvoiceCents: 95, coverage: FALLBACK_COVERAGE });
    assert.equal(png.equals(changedPrice), false);
    const changedCity = await renderSocialImage({ pricePerInvoiceCents: 80, coverage: {
      cities: [{ cityCode: '1234567', cityName: 'Cidade & <b>texto</b>', uf: 'SP', regimes: ['MEI'] }],
    } });
    assert.equal(png.equals(changedCity), false);
  });
  it('mantém cache independente para a prévia inglesa, sem servir a versão portuguesa', async () => {
    const before = renders;
    await Promise.all(Array.from({ length: 8 }, () => fetch(base + '/api/og-en.png?v=2')));
    assert.equal(renders, before + 1);
    assert.deepEqual(renderedData.at(-1), { pricePerInvoiceCents: 95, coverage: FALLBACK_COVERAGE, locale: 'en' });
    await fetch(base + '/api/og.png?v=2');
    assert.equal(renders, before + 1);
    const en = await renderSocialImage({ pricePerInvoiceCents: 80, coverage: FALLBACK_COVERAGE, locale: 'en' });
    const metadata = await sharp(en).metadata();
    assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
    assert.equal(png.equals(en), false);
  });
});
