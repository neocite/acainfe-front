---
name: Limites de testes de segurança e onboarding
description: Proibição de testes contra empresas reais e identificação da única empresa de teste autorizada.
---

Não executar testes de segurança nem de onboarding contra empresas reais em produção. Para testes de empresa, usar somente o CNPJ sintético autorizado `99000001000101`, com certificado autoassinado.

**Why:** O usuário informou que testes pela prévia atingiram a API de produção, substituíram o certificado de uma empresa real e adicionaram um proprietário indevido. Ele informou ter revertido essas alterações e estabeleceu explicitamente este limite.

**How to apply:** Não tratar a prévia como ambiente isolado: confirmar o destino e o isolamento antes de qualquer teste com escrita. Nunca usar CNPJs reais, mesmo os publicados na landing page. Se o CNPJ autorizado não permitir o cenário, interromper e pedir um ambiente isolado, sem escolher outra empresa.
