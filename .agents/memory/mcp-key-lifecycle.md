---
name: Ciclo de vida das chaves MCP
description: Gerenciamento independente da geração e revogação explícita em caso de vazamento.
---

O usuário deve conseguir consultar e revogar chaves existentes sem gerar outra chave para entrar na configuração.

**Why:** O usuário relatou que precisava gerar uma chave nova toda vez que entrava e pediu um caminho independente para invalidar credenciais vazadas.

**How to apply:** Preservar o acesso ao gerenciamento tanto pelo painel quanto pelo onboarding; não condicionar a lista à geração de um segredo novo.

Gerar uma nova chave não revoga as anteriores. A revogação deve ser uma ação explícita e confirmada, pois interrompe imediatamente os agentes e integrações que dependem da chave.

**Why:** Uma empresa pode conectar diferentes agentes simultaneamente. A intenção é permitir invalidar uma credencial vazada sem interromper as outras conexões, ou revogar todas deliberadamente.

**How to apply:** Não transformar geração em rotação automática. Explicar a interrupção e a irreversibilidade antes de revogar; após revogar todas, oferecer geração sem criá-la automaticamente.
