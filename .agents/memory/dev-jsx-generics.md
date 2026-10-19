---
name: Genéricos JSX na prévia
description: Limitação do injetor de metadados da prévia com componentes JSX parametrizados.
---

Prefira inferência de tipos pelas props em vez de parâmetros genéricos explícitos nas tags JSX.

**Why:** O injetor de metadados do ambiente de desenvolvimento inseriu atributos antes do parâmetro genérico da tag, produzindo JSX inválido. Typecheck e build de produção passavam, mas a prévia quebrava.

**How to apply:** Quando um componente React for genérico, deixe o TypeScript inferir o parâmetro pelas props. Confirme a prévia além do build; essa falha é exclusiva da transformação de desenvolvimento.
