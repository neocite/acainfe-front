---
name: Vendas passadas e competência fiscal
description: Regras de negócio para vendas antigas e risco de duplicar notas emitidas fora do açaínfe.
---

Vendas de meses anteriores devem manter a competência do mês da venda e exigir consentimento explícito antes da emissão. Para empresas do Simples, receitas não declaradas no DAS daquele mês podem exigir retificação do PGDAS, com multa e juros; recomendar confirmar com o contador.

Vendas estornadas ou contestadas nunca entram. O usuário deve marcar manualmente as vendas já faturadas em outro sistema ou no portal da prefeitura.

**Why:** A ausência de uma nota no açaínfe não prova que a venda nunca foi faturada; emitir automaticamente pode duplicar uma obrigação fiscal. O usuário forneceu essas regras para a importação de vendas passadas.

**How to apply:** Separar consulta/revisão da ação de emitir. Não emitir vendas reais durante testes de implementação. Tratar falta das permissões de leitura como limitação da consulta de vendas antigas, sem declarar que a conexão existente falhou.
