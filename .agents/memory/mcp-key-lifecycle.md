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

Uma chave antiga sem detalhes não é necessariamente uma chave que nunca foi usada. O rastreamento das antigas começa no uso posterior à implantação do registro de chaves.

**Why:** O usuário confirmou que a API identifica o final e o último uso de uma chave antiga quando ela volta a ser usada; isso não recupera o histórico anterior nem a data de criação.

**How to apply:** Não tratar todas as chaves antigas como permanentemente sem detalhes, nem apresentar ausência de registro como prova de inatividade histórica. Orientar a usar o MCP e atualizar a lista para identificar a conexão antes de decidir revogar.
