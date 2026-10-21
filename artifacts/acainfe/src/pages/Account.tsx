import { useUser, useClerk } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '../lib/queryClient';

export default function Account() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['account', user?.externalId ?? user?.id],
    queryFn: () => apiRequest<{ user?: { name?: string; whatsapp?: string }; name?: string; whatsapp?: string }>('/app/me'),
  });
  return <main className="onboarding-page min-h-screen p-6">
    <header className="app-header"><Link href="/app" className="app-brand">açaínfe</Link><button className="app-secondary" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}>Sair</button></header>
    <section className="app-card mx-auto mt-10 max-w-xl">
      <h1>Minha conta</h1>
      {isPending ? <p>Carregando seus dados…</p> : error ? <div role="alert"><p>{error.message}</p><button className="app-secondary" onClick={() => refetch()}>Tentar novamente</button></div> : data && <dl data-testid="account-data-loaded">
        <dt>Nome</dt><dd>{data.user?.name || data.name || user?.fullName || 'Não informado'}</dd>
        <dt>E-mail</dt><dd>{user?.primaryEmailAddress?.emailAddress}</dd>
        <dt>WhatsApp</dt><dd>{data.user?.whatsapp || data.whatsapp || 'Não informado'}</dd>
      </dl>}
      <Link href="/app" className="app-secondary">Voltar para minha empresa</Link>
    </section>
  </main>;
}
