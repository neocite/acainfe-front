---
name: Segurança do repositório público
description: Regras adicionais do proprietário para contribuições após a abertura do código.
---

Nunca commitar segredos, chaves mesmo de teste, dados reais de clientes, CPFs/CNPJs de terceiros ou e-mails e telefones pessoais. Usar somente dados fictícios nos testes. Placeholders de credenciais no `.env.example` não devem parecer chaves reais, incluindo prefixos `sk_test_` e `sk_live_`.

**Why:** O proprietário tornou o repositório público e alertou que placeholders com formato de chave real podem bloquear o push no GitHub.

**How to apply:** Revisar os dados adicionados antes de qualquer commit; manter `.env.example` atualizado ao introduzir variáveis. Preservar LICENSE, SECURITY.md e os avisos de marca do README. Não remover contribuições recebidas do GitHub nem usar push forçado para resolver divergências.
