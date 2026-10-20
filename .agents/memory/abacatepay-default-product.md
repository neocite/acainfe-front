---
name: Produto padrão e pagamentos sem produto
description: Decisão explícita do produto para Pix transparente e separação de testes das vendas faturadas.
---

O produto de uma nota segue esta ordem: itens do pagamento, `metadata.productExternalId` e produto padrão da empresa. Sem nenhum deles, o pagamento não gera nota. A decisão de não ter produto padrão é válida e deve ser explícita.

**Why:** O usuário informou que o Pix transparente do AbacatePay não traz produto e que um padrão também faz pagamentos de teste sem produto virarem nota.

**How to apply:** Perguntar após importar os produtos, usando somente as opções e sugestão da API, sem salvar automaticamente. Não repetir uma decisão já tomada. Explicar o efeito sobre testes antes de salvar. Pagamentos que não são venda devem ser ignorados de forma reversível, nunca falsamente marcados como já faturados em outro sistema.
