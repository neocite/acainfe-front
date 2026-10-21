---
name: WebSocket da prévia
description: HMR do Vite em modo middleware precisa compartilhar a porta HTTP encaminhada.
---

Quando o Vite roda como middleware do Express, conecte o HMR ao mesmo servidor HTTP da aplicação, em vez de depender de uma porta WebSocket separada.

**Why:** A prévia encaminha a porta do artefato, mas a porta WebSocket padrão separada não estava acessível. A aplicação funcionava, porém cada navegação produzia erros de conexão no navegador.

**How to apply:** Ao alterar a inicialização do Express/Vite, preservar o compartilhamento do servidor HTTP e um caminho WebSocket próprio. Não fixar domínio de desenvolvimento nem porta HTTPS no cliente; deixar o Vite usar a origem atual.
