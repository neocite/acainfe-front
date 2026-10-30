# açaínfe — app web

> Web app and landing page for açaínfe, an AI-first Brazilian NFS-e (service invoice) issuer. Licensed under AGPL-3.0.

[![CI](https://github.com/neocite/acainfe-front/actions/workflows/ci.yml/badge.svg)](https://github.com/neocite/acainfe-front/actions/workflows/ci.yml)
[![Licença: AGPL-3.0](https://img.shields.io/badge/licen%C3%A7a-AGPL--3.0-blue.svg)](LICENSE)

O [açaínfe](https://acainfe.com) emite NFS-e (Nota Fiscal de Serviço eletrônica) automaticamente a cada venda paga no AbacatePay e pode ser operado inteiro por agentes de IA via MCP.

Este repositório é o **front**: a landing page, o cadastro (onboarding) e a área da conta. As notas, empresas, certificados e cobranças ficam na **API**, em [extractify/acainfe-api](https://github.com/extractify/acainfe-api). O front não emite notas e não guarda dados fiscais: ele autentica o usuário e repassa as chamadas à API.

## Stack

- **Servidor:** Express 5, que serve a API interna (`/api/*`) e o Vite no mesmo processo e na mesma origem.
- **Interface:** React 19, Vite 7, Tailwind CSS 4, Radix UI e TanStack Query.
- **Autenticação:** Clerk, com cookies de sessão na mesma origem.
- **Landing:** renderizada no servidor (SSR) para SEO e para agentes (`llms.txt`, OpenAPI, cartão MCP).
- **CLI:** [`artifacts/acainfe/cli`](artifacts/acainfe/cli), sem dependências.
- **Testes:** `node:test` executado com `tsx`.

## Estrutura

```
artifacts/
  acainfe/              # app principal (@workspace/acainfe)
    server/             # Express: proxy autenticado para a API, rotas públicas, SSR, imagem social
    src/                # React: landing, onboarding, conta
    content/            # llms.txt e instruções para agentes
    cli/                # CLI `acainfe`
    tests/              # testes (node:test)
  mockup-sandbox/       # sandbox de protótipos de interface (Replit)
replit.md               # contexto e regras do projeto para o agente do Replit
threat_model.md         # modelo de ameaças
```

## Rodando localmente

Pré-requisitos:
- **Node.js 22.23.4+, 24.22.1+ ou 26.12.1+.** Versões anteriores são bloqueadas por causa de uma correção de segurança.
- **pnpm 10.**
- **Uma instância da [API](https://github.com/extractify/acainfe-api).**
- **Uma aplicação no [Clerk](https://clerk.com).**

```bash
pnpm install
cp .env.example .env              # preencha os valores
set -a && . ./.env && set +a      # exporta as variáveis no shell
pnpm --filter @workspace/acainfe run dev
```

O app sobe em `http://localhost:5000` (ou na porta definida em `PORT`).

### Comandos

| Comando | O que faz |
|---|---|
| `pnpm --filter @workspace/acainfe run dev` | Servidor de desenvolvimento (Express + Vite) |
| `pnpm --filter @workspace/acainfe run typecheck` | Checagem de tipos do cliente e do servidor |
| `NODE_ENV=production pnpm --filter @workspace/acainfe run build` | Build de produção (cliente + SSR) |
| `pnpm --filter @workspace/acainfe test` | Testes (rode o build de produção antes: há testes do servidor em modo produção) |
| `pnpm --filter @workspace/acainfe start` | Servidor de produção (depois do build) |

Não publique como site estático: o Express é necessário para a autenticação, o preço dinâmico, os metadados e o proxy da API.

## Variáveis de ambiente

Veja [`.env.example`](.env.example).

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ACAINFE_API_URL` | sim | Endereço da API do açaínfe |
| `ACAINFE_APP_KEY` | sim (rotas privadas) | Chave de app da API. Só no servidor; nunca com prefixo `VITE_` |
| `CLERK_PUBLISHABLE_KEY` | sim | Chave publicável do Clerk (servidor) |
| `CLERK_SECRET_KEY` | sim | Chave secreta do Clerk |
| `VITE_CLERK_PUBLISHABLE_KEY` | sim | Chave publicável do Clerk (navegador) |
| `VITE_CLERK_PROXY_URL` | não | Proxy do Clerk em domínio próprio |
| `PORT` | não | Porta do servidor (padrão `5000`) |
| `BASE_PATH` | não | Caminho base do app (padrão `/`) |
| `ACAINFE_API_KEY` | não | Chave de API usada só pela CLI |

## Contribuindo

Contribuições são bem-vindas. Antes de começar, leia:
- [CONTRIBUTING.md](CONTRIBUTING.md): ambiente, fluxo de PR e regras do projeto.
- [Código de Conduta](CODE_OF_CONDUCT.md).
- [Política de segurança](SECURITY.md). **Não abra issue pública para vulnerabilidades.**

## Licença e marca

O código está sob a [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). Copyright (C) 2026 EXTRACTIFY TECNOLOGIA LTDA.

Se você modificar este software e oferecê-lo a outras pessoas pela rede, a AGPL exige que você disponibilize o código-fonte dessas modificações aos usuários.

O nome **açaínfe**, o logotipo e a identidade visual são marcas da EXTRACTIFY TECNOLOGIA LTDA e **não** estão licenciados pela AGPL. Forks publicados precisam usar outro nome e outra identidade visual.
