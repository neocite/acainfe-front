---
name: Node do app e das ferramentas
description: Evitar conclusões incorretas sobre a atualização do Node a partir de uma única versão do shell.
---

O gerenciador pnpm fornecido pelo Nix pode ter um shebang absoluto apontando
para outro Node, enquanto `node` no PATH e os scripts filhos usam o módulo
selecionado no Replit.

**Why:** Uma verificação de segurança encontrou o Node do app corrigido, mas o
aviso de engines do pnpm revelou um interpretador diferente no gerenciador.
O runtime do desenvolvimento também não comprova o da publicação já existente.

**How to apply:** Comparar `node -v`, `pnpm exec node -v`, avisos de engines e
o shebang real do pnpm. Para executar manualmente o pnpm com o Node selecionado,
usar `node "$(command -v pnpm)" ...` quando o executável for sua entrada JavaScript.
Verificar os comandos do manifesto do artefato: eles podem prevalecer sobre os
comandos gerais de publicação em `.replit`. Não afirmar que uma publicação foi
atualizada sem evidência do runtime efetivo dela.
