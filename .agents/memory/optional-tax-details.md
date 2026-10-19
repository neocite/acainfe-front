---
name: Dados fiscais opcionais
description: Por que CCM e alíquota do Simples não devem bloquear o cadastro nem a emissão.
---

O usuário reviu a experiência de cadastro: pedir CCM obrigatório, pois a pessoa precisa saber que tem que informar isso, e carregar 6% como padrão da alíquota, permitindo alterar. Os campos devem ficar visíveis, não em uma seção recolhida de dados opcionais. Preservar uma alíquota que já tenha sido informada.

**Why:** O usuário não aprovou a seção opcional e pediu explicitamente CCM obrigatório e 6% pré-preenchido.

A API continua considerando CCM e alíquota recomendações que não impedem a emissão. A estimativa de 6% se refere aos tributos aproximados da Lei 12.741; não altera o imposto pago no DAS.

**How to apply:** Separar a exigência de CCM na interface do cadastro da capacidade de emissão indicada pela API. Não deixar a retomada do cadastro pular o CCM pendente.
