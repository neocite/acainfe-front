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
