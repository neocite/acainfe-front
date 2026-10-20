---
name: Regras de cadastro e consulta fiscal
description: Obrigatoriedade municipal, distinção dos percentuais e limites do que o cliente pode alterar.
---

O CCM segue a exigência da prefeitura informada pela API: é obrigatório quando consta nas pendências e opcional quando consta apenas nas recomendações. A orientação anterior de obrigá-lo sempre foi substituída por essa regra.

**Why:** O usuário esclareceu que alguns municípios exigem CCM e outros apenas recomendam; a interface não deve impor a mesma obrigação a todos.

**How to apply:** Mostrar o campo e a ajuda da API. Não bloquear o avanço nem forçar a retomada do onboarding por uma recomendação isolada.

A alíquota do Simples (sugestão de 6%), o ISS e os tributos aproximados da Lei 12.741 (sugestão de 15,53% do IBPT) são informações distintas. Preservar valores já informados, inclusive zero, e pedir confirmação ao contador.

**Why:** O usuário pediu o cadastro separado dos tributos aproximados; não usar a estimativa de 6% do Simples como substituta do IBPT nem do ISS.

**How to apply:** Apresentar campos e explicações separados no cadastro e na consulta fiscal; não inventar uma alíquota de ISS.

Sistema de emissão e ambiente são configurações internas, não escolhas do cliente. O contador pode confirmar o sistema indicado pela prefeitura, mas essa consulta não concede permissão de alterá-lo no app.

**Why:** O usuário pediu explicitamente proteger o ambiente e não apresentar escolha de produção/homologação.

**How to apply:** Mostrar esses dados somente para consulta e sinalizar modo teste apenas quando a API informar homologação.
