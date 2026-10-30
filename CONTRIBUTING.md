# Contribuindo com o açaínfe (app web)

Obrigado pelo interesse! Este guia explica como preparar o ambiente, as regras do projeto e o fluxo de pull request. Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).

## Antes de começar

- **Bugs e sugestões:** abra uma [issue](https://github.com/neocite/acainfe-front/issues/new/choose).
- **Mudanças grandes** (nova tela, mudança de fluxo ou de arquitetura): abra uma issue antes, para discutirmos a ideia.
- **Vulnerabilidades:** **nunca** em issue pública. Siga a [política de segurança](SECURITY.md).
- **Mudanças de regra fiscal, emissão ou dados da empresa** costumam ser da API: veja [extractify/acainfe-api](https://github.com/extractify/acainfe-api).

## Ambiente

Siga a seção [Rodando localmente](README.md#rodando-localmente) do README. Resumindo:

```bash
pnpm install
cp .env.example .env && set -a && . ./.env && set +a
pnpm --filter @workspace/acainfe run dev
```

## Antes de abrir o PR

Rode o mesmo que o CI:

```bash
pnpm --filter @workspace/acainfe run typecheck
NODE_ENV=production pnpm --filter @workspace/acainfe run build
pnpm --filter @workspace/acainfe test
```

- **Toda mudança de comportamento vem com teste** em `artifacts/acainfe/tests`, com `node:test`.
- **Os testes não podem depender de rede, de credenciais reais nem de serviços externos.** Simule a API e o Clerk, como fazem os testes existentes.

## Regras do projeto

- **Números são inteiros.**
  - Dinheiro é em centavos: R$ 82,20 = `8220`.
  - Percentuais são em pontos-base: 2,01% = `201`.
  - Converta o texto digitado sem `parseFloat(x) * 100`, porque o ponto flutuante erra em alguns valores.
- **Segredos ficam só no servidor.**
  - `ACAINFE_APP_KEY` e `CLERK_SECRET_KEY` nunca vão para o navegador nem levam o prefixo `VITE_`.
  - Não grave certificados, senhas ou chaves MCP em disco ou no `localStorage`.
- **Identidade só pelo Clerk.** A identidade do usuário vem da sessão validada pelo Clerk. Nunca confie em cabeçalhos de identidade enviados pelo navegador.
- **A API privada é só da mesma origem.** Não adicione CORS com reflexão de origem e credenciais.
- **Não crie modos de demonstração** que simulem certificado válido, emissão de nota ou confirmação de Pix.
- **Testes com empresas reais são proibidos.**
  - Nunca teste o cadastro, a emissão ou a segurança com empresas reais em produção.
  - O único CNPJ de teste autorizado é `99000001000101`.
- **Não fixe URLs externas no front.** O endereço da API vem de `ACAINFE_API_URL`.
- **Textos da interface em português do Brasil.** A landing em inglês usa o helper de tradução existente.

O arquivo [`replit.md`](replit.md) e a pasta [`.agents/`](.agents) guardam o contexto e as decisões usados pelo agente do Replit. Também servem como referência para quem contribui.

## Commits e pull requests

1. Faça um fork e crie um branch a partir da `main`, por exemplo `feat/minha-mudanca` ou `fix/erro-no-login`.
2. Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/), por exemplo `feat: tela de gateways de pagamento` ou `fix: valida CNPJ no cadastro`.
3. Faça PRs pequenos e focados. Preencha o template, com prints quando houver mudança visual.
4. O CI precisa passar. Um mantenedor revisa e faz o merge.

## Licença

Ao contribuir, você concorda que sua contribuição seja licenciada sob a [AGPL-3.0](LICENSE), a mesma licença do projeto.
