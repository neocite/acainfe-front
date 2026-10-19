import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';

type Item = { id: string; name: string };
export type ImportConnection = {
  imported: number; confirmedByProfile?: Item[]; pendingTaxReview?: Item[];
  skippedTestProducts?: string[]; mergedDuplicates?: { name: string; externalId: string; productId: string }[];
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function AbacatePayImportSummary({ connection, onOpenProducts }: { connection: ImportConnection; onOpenProducts: () => void }) {
  const ok = connection.confirmedByProfile?.length ?? 0;
  const pending = connection.pendingTaxReview?.length ?? 0;
  const skipped = connection.skippedTestProducts ?? [];
  const merged = connection.mergedDuplicates ?? [];
  const applicable = ok > 0 || pending > 0 || skipped.length > 0 || merged.length > 0;
  return <div className="import-summary" role="status">
    {ok > 0 && <div className="app-success"><CheckCircle2 size={16} />
      <span>✓ {ok === 1 ? '1 produto importado e pronto para vender.' : `${ok} produtos importados e prontos para vender.`}</span></div>}
    {pending > 0 && <div className="app-notice">
      <strong>{pending === 1 ? '1 produto aguarda' : `${pending} produtos aguardam`} sua confirmação</strong>
      <button type="button" className="text-button" onClick={onOpenProducts}>Ir para a tela de produtos</button></div>}
    {skipped.length > 0 && <small>Ignoramos produtos de teste: {skipped.join(', ')}.</small>}
    {merged.map(m => <small key={m.productId + m.externalId}>{m.name} aparecia duas vezes no AbacatePay; juntamos em um só produto.</small>)}
    {!applicable && <div className="app-success"><CheckCircle2 size={16} />
      <span>{plural(connection.imported, 'produto importado', 'produtos importados')} com sucesso.</span></div>}
  </div>;
}
