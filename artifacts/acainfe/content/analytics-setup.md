# Medição no Google Analytics 4

Propriedade: `G-C3EDFQBQWH` (identificador público, não é uma senha).

## Quando os dados são enviados

O Google tag só é carregado em `acainfe.com` e `www.acainfe.com`, depois que a pessoa aceita os cookies analíticos. A opção “Cookies” permite retirar o consentimento. Recusa, prévias e testes não enviam dados reais para a propriedade. Eventos anteriores ao aceite não são recuperados.

O app configura pageviews manuais para navegação SPA, sem enviar parâmetros da URL, fragmentos ou caminhos arbitrários. Não define user_id, nem envia nomes, e-mails, telefones, CNPJs, senhas, certificados, chaves ou conteúdo do Pix. Publicidade e Google Signals ficam desativados na configuração da tag.

## Eventos implementados

| Evento | Momento |
| --- | --- |
| `page_view` | Primeira visita autorizada e mudança de rota pública ou privada conhecida |
| `onboarding_start` | Cadastro inicial carregado, não uma simples visita ao painel |
| `onboarding_step_view` | Exibição de uma etapa do cadastro inicial |
| `onboarding_step_complete` | Sucesso da etapa; contador pulado tem `skipped: true` |
| `onboarding_error` | Falha no onboarding, somente etapa e código HTTP, nunca mensagem ou campos |
| `onboarding_waitlisted` | Certificado aceito com entrada em lista de espera |
| `onboarding_mcp_key_created` | Primeira chave gerada na etapa do assistente, sem chave ou nome |
| `onboarding_complete` | Clique em Concluir na etapa do assistente |
| `begin_checkout` | Pix do saldo gerado com sucesso |
| `pix_generated` | Mesmo resultado, para análise específica do meio de pagamento |

Etapas: `personal_details` (1), `certificate` (2), `company` (3), `accountant` (3, subetapa opcional), `abacatepay` (4) e `assistant` (5).

Checkout: `currency: BRL`, `value` em reais (centavos / 100), `payment_type: pix`, `checkout_type: billing_balance` e um item fixo de emissão de NFS-e. A mesma resposta Pix não gera outro checkout na mesma sessão. O código Pix não é transmitido: um digest local serve apenas para deduplicação.

## Limitação: pagamento confirmado ainda não é medido

**Não há evento `purchase` implementado.** O contrato atual da API externa usado pelo app devolve apenas `amountCents`, `pixCopyPaste`, `pixQrCodeImage` e `expiresAt` ao gerar o Pix. A consulta de saldo não identifica a transação nem comprova o pagamento daquele Pix.

O código da API de cobrança não está neste repositório. Para medir o pagamento, é necessário implementar lá uma confirmação autenticada ou um webhook verificado que forneça identificador imutável da transação, status pago e valor efetivamente pago. Esta é uma necessidade de contrato, não uma rota ou campo já existente. Só depois deve ser enviado `purchase`, usando o identificador real como `transaction_id` para deduplicação. Saldo zerado, botão Verificar pagamento e criação do Pix não devem disparar `purchase`.

Pagamento feito depois que o navegador foi fechado requer envio pelo servidor responsável pela confirmação, e não somente instrumentação no navegador.

## Configuração no painel do Google Analytics

1. Publicar as alterações e verificar o fluxo após aceitar os cookies.
2. Nas configurações do fluxo Web, desativar pageviews automáticas por mudanças de histórico, pois o app já as envia manualmente. Desativar também interações automáticas de formulários: as etapas sensíveis têm eventos explícitos sem valores dos campos.
3. Registrar dimensões personalizadas de escopo evento: `step_name`, `step_number`, `skipped`, `http_status`, `payment_type` e `checkout_type`, conforme necessário nos relatórios.
4. Criar uma exploração de funil com início, visualização/conclusão por `step_name`, conclusão do onboarding e `pix_generated`. Não somar `begin_checkout` e `pix_generated`: representam o mesmo checkout em análises diferentes.
5. Marcar `onboarding_complete` como evento principal se esse for o objetivo. Pix gerado pode ser uma microconversão, mas não representa receita paga.
6. Conferir no Tempo real/DebugView com acesso à propriedade. Os testes locais validam a fila e os disparos, não acesso ao painel nem recebimento pelo Google.
