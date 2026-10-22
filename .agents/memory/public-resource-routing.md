---
name: Arquivos públicos e Vite
description: Arquivos para agentes e downloads devem escapar da transformação de módulos do Vite.
---

Registrar downloads e arquivos legíveis por máquinas antes do middleware do Vite.

**Why:** Uma CLI `.mjs` foi interceptada pelo Vite na prévia e devolvida como módulo transformado para navegador, não como o arquivo Node original. Testes HTTP sem o middleware do Vite não detectavam a diferença.

**How to apply:** Para downloads de código ou extensões servidas pelo Vite, conferir igualdade do conteúdo recebido com o arquivo original e usar o middleware real nos testes de integração. Não confiar somente no status 200.
