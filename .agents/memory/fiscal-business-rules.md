---
name: Perfis fiscais para empreendedores
description: Público sem conhecimento contábil, aplicação de perfis e distinção entre ISS e tributos aproximados.
---

O usuário do açaínfe não é contador. Perguntar “O que você vende?” em linguagem simples, sem exigir seleção manual de códigos fiscais por produto. O perfil de infoprodutor está validado; o de MicroSaaS ainda exige confirmação da sugestão de cada produto.

**Why:** O usuário forneceu essa orientação de produto para reduzir o trabalho contábil no cadastro e evitar apresentar uma sugestão ainda em validação como configuração confirmada.

**How to apply:** A API define os perfis, sugestões e avisos; o app exibe e confirma, sem inventar tributação. Só solicitar ISS se a API indicar a falta: no Simples ele é calculado; fora dele pode vir da prefeitura. Não confundir Simples, ISS e IBPT; as regras de percentuais estão em optional-tax-details.md.

Ao corrigir uma etapa do cadastro, verificar também a continuidade das etapas vizinhas na página completa, não apenas os componentes isolados.

**Why:** Testes dos componentes fiscais passaram mesmo quando a página de cadastro deixou de exibir a escolha de atividade e de enviar a resposta; isso bloqueou a configuração da empresa. O mesmo problema ocorreu com o cartão da empresa: o componente isolado estava correto, mas a página usava outra implementação.

**How to apply:** Cobrir a escolha de cada atividade, o envio junto com a numeração e a chegada à conexão com o AbacatePay. Incluir a entrada e a atualização do painel na página real. A existência do componente e seus testes isolados não comprovam que ele está ligado ao fluxo real.

A configuração fiscal manual é uma exceção opcional para quem escolhe “Outro serviço (configuro eu mesmo)”, não uma obrigação para todos. Seu padrão é somente sugestão; os produtos continuam precisando de confirmação. Não reclassificar retroativamente empresas ou produtos existentes.

**Why:** O proprietário pediu uma saída para serviços que não são curso nem SaaS, inclusive usuários cautelosos que querem conferir os códigos, e delimitou a mudança como “só daqui pra frente”.

**How to apply:** Manter os perfis simples para o público geral e oferecer a configuração avançada sem impor preenchimento. Alterações de perfil ou padrão devem decorrer de ação explícita do usuário, sem migração automática de tributação anterior.
