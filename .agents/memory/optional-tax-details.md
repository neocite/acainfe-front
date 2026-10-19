---
name: Dados fiscais opcionais
description: Por que CCM e alíquota do Simples não devem bloquear o cadastro nem a emissão.
---

CCM e alíquota do Simples são recomendações, não pré-requisitos de emissão. A prefeitura normalmente já tem o CCM no cadastro nacional; o número só deve ser exigido se ela recusar a nota. Enquanto a alíquota não for informada, a API usa 6% como estimativa dos tributos aproximados da Lei 12.741, sem alterar o imposto pago no DAS.

**Why:** O usuário explicou que quem cadastra de madrugada não sabe esses dados e não pode ficar travado esperando o contador acordar.

**How to apply:** Não tornar recomendações obrigatórias, não gravar a estimativa como se fosse uma alíquota informada pelo usuário e distinguir claramente recomendações das pendências que impedem emissão.
