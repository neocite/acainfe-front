---
name: Correções sem release upstream
description: Critério para corrigir dependências transitivas sem trocar infraestrutura sensível apenas para eliminar um alerta.
---

Se uma dependência transitiva não tiver release corrigido, preferir um patch
pequeno, rastreável e coberto por regressão a substituir o proxy de autenticação
somente para remover um alerta de scanner.

**Why:** A troca do proxy aumenta o risco de regressões de sessão e domínio sem
necessidade. Scanners baseados em versão podem continuar alertando mesmo quando
o código instalado recebeu uma correção; isso deve ser explicado, não escondido
por renomeação, versão inventada ou supressão.

**How to apply:** Confirmar as versões upstream e dos consumidores antes de
decidir; testar o caminho transitivo realmente usado por cada artefato, preservar
o alerta visível e migrar para o release oficial quando houver correção.

Instalações pré-provisionadas podem conter código sem patch mesmo sob um caminho
com hash de patch; `pnpm install --frozen-lockfile` pode não reparar esse estado.

**Why:** Foi observado um install “Already up to date” seguido de estouro de pilha
nos testes, apesar do patch estar registrado corretamente. A reinstalação forçada
aplicou a proteção.

**How to apply:** Validar o comportamento pelo consumidor transitivo real após
restaurar dependências; se o código instalado não refletir o patch, usar
`CI=true pnpm install --frozen-lockfile --force` e repetir a regressão.
