# Política de segurança

O açaínfe lida com certificados digitais e dados fiscais de empresas. Por isso levamos relatos de vulnerabilidade muito a sério.

## Como reportar

**Não abra issue, discussão ou pull request público para vulnerabilidades.**

Use um destes canais privados:
1. **GitHub:** a aba [Security → Report a vulnerability](https://github.com/neocite/acainfe-front/security/advisories/new) deste repositório.
2. **E-mail:** contato@extractify.com.br, com o assunto `[SEGURANÇA]`.

Inclua no relato:
- a descrição e o impacto;
- os passos para reproduzir;
- as URLs ou rotas afetadas;
- se possível, uma prova de conceito que não use dados de terceiros.

## Prazos

| Etapa | Prazo |
|---|---|
| Confirmação do recebimento | até 2 dias úteis |
| Avaliação inicial e severidade | até 5 dias úteis |
| Correção de falhas críticas | o quanto antes, em geral em até 7 dias |

Avisamos você quando a correção for publicada e, se quiser, damos o crédito no aviso.

## Escopo

**Dentro do escopo:**
- este repositório;
- o app em https://acainfe.com: landing, cadastro e conta;
- o proxy `/api/*`.

Problemas na API, como emissão, certificados ou MCP, também podem ser reportados aqui. Se preferir, use [extractify/acainfe-api](https://github.com/extractify/acainfe-api/security).

**Fora do escopo:**
- testes contra dados, certificados ou contas de empresas reais, inclusive tentar assumir uma empresa já cadastrada. Use uma conta sua e o CNPJ de teste `99000001000101`;
- negação de serviço, testes de carga, spam e engenharia social;
- relatórios automáticos sem impacto demonstrado, como cabeçalhos ausentes sem exploração.

## Porto seguro

Não tomaremos medidas legais contra quem pesquisar de boa-fé e seguir esta política, desde que a pessoa:
- não acesse, altere ou guarde dados de outras pessoas além do mínimo necessário para demonstrar o problema;
- não degrade o serviço;
- nos dê um prazo razoável para corrigir antes de divulgar.
