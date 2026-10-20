---
name: Recriação de webhooks do AbacatePay
description: Restrição de URL imutável e separação entre atualizar a chave e substituir o webhook.
---

O AbacatePay não permite editar a URL de um webhook existente. Para trocar o endereço, é necessário criar outro webhook e orientar o usuário a apagar o antigo no painel do AbacatePay.

**Why:** O usuário informou essa restrição ao pedir uma forma de corrigir integrações depois de uma mudança de URL da API do açaínfe.

**How to apply:** Manter a recriação explícita do webhook separada da atualização da API key. Não prometer que reconectar uma key altera o destino do webhook; explicar a interrupção do webhook anterior e o passo manual de limpeza antes e depois da ação.

A manutenção das integrações pertence a “Gateways de pagamento”, não ao Painel nem exclusivamente ao onboarding. O Painel deve mostrar só o resumo com acesso a “Gerenciar”.

**Why:** O usuário pediu um lugar próprio para gerenciar gateways e eliminar a dependência de “Configuração” para reconectar o AbacatePay e revisar vendas sem nota.

**How to apply:** Manter conexão, atualização da key, produto padrão, webhook e acesso às vendas antigas no menu de gateways. Conservar “Configuração” apenas enquanto houver funções exclusivas, como o envio do certificado ou os dados iniciais da empresa.
