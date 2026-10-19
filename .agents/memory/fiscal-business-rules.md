---
name: Perfis fiscais para empreendedores
description: Público sem conhecimento contábil, aplicação de perfis e distinção entre ISS e tributos aproximados.
---

O usuário do açaínfe não é contador. Perguntar “O que você vende?” em linguagem simples, sem exigir seleção manual de códigos fiscais por produto. O perfil de infoprodutor está validado; o de MicroSaaS ainda exige confirmação da sugestão de cada produto.

**Why:** O usuário forneceu essa orientação de produto para reduzir o trabalho contábil no cadastro e evitar apresentar uma sugestão ainda em validação como configuração confirmada.

**How to apply:** A API define os perfis, sugestões e avisos; o app exibe e confirma, sem inventar tributação. Só solicitar ISS se a API indicar a falta: no Simples ele é calculado; fora dele pode vir da prefeitura. O padrão editável de 6% solicitado anteriormente continua sendo de tributos aproximados, não uma alíquota de ISS.

Ao corrigir uma etapa do cadastro, verificar também a continuidade das etapas vizinhas na página completa, não apenas os componentes isolados.

**Why:** Testes dos componentes fiscais passaram mesmo quando a página de cadastro deixou de exibir a escolha de atividade e de enviar a resposta; isso bloqueou a configuração da empresa.

**How to apply:** Cobrir a escolha de cada atividade, o envio junto com a numeração e a chegada à conexão com o AbacatePay. A existência do componente e seus testes isolados não comprovam que ele está ligado ao fluxo real.
