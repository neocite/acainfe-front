import { SignIn, SignUp } from '@clerk/react';
import { Link } from 'wouter';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-[100dvh] bg-[#fff8ee] px-4 py-10">
    <div className="mx-auto mb-8 max-w-[1000px]"><Link href="/" className="text-[#632252]">← Voltar para o site</Link></div>
    <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-center gap-12">
      <section className="max-w-[400px] text-[#2a0e2e]"><h1 className="mb-4 text-4xl font-bold">Seu negócio vende.<br />A gente cuida da nota.</h1><p>Sem mensalidade. Não vendeu, não pagou.</p></section>
      {children}
    </div>
  </main>;
}

export function SignInPage() {
  return <AuthLayout><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthLayout>;
}
export function SignUpPage() {
  return <AuthLayout><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthLayout>;
}
