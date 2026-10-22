# açaínfe CLI

Ferramenta de linha de comando do açaínfe, produto da EXTRACTIFY TECNOLOGIA LTDA. Requer Node.js 22 ou superior e não depende de outros pacotes.

## Instalação por download

```bash
curl --fail --location https://acainfe.com/cli/acainfe.mjs --output acainfe.mjs
node acainfe.mjs --help
node acainfe.mjs pricing
node acainfe.mjs coverage
node acainfe.mjs openapi
node acainfe.mjs mcp-config
```

A distribuição pelo npm ainda não foi publicada. Não use `npx acainfe-cli`: a propriedade do nome e a conta de publicação precisam ser confirmadas. O pacote neste projeto está marcado como privado para impedir publicação acidental.

## Autenticação

Gere uma chave no app em “Agentes de IA” e disponibilize-a na variável `ACAINFE_API_KEY` do seu terminal por um gerenciador de segredos. Não grave a chave no código, no arquivo JSON da venda nem no histórico de comandos. A CLI não tem opção `--api-key`, não salva a chave e a envia apenas no cabeçalho `x-api-key` para `https://api.acainfe.com`. Redirecionamentos HTTP são recusados.

## Consultas

```bash
node acainfe.mjs products list
node acainfe.mjs invoices list
node acainfe.mjs invoices get IDENTIFICADOR_DA_NOTA
```

## Ações que alteram dados

Todas exigem um arquivo JSON e a opção explícita `--confirm`. Sem a opção, nada é enviado.

```bash
node acainfe.mjs sales create --file venda.json --confirm
node acainfe.mjs products create --file produto.json --confirm
node acainfe.mjs invoices cancel IDENTIFICADOR_DA_NOTA --file motivo.json --confirm
```

Monte os arquivos conforme a [especificação pública](https://acainfe.com/openapi.json) e a [documentação](https://acainfe.com/developers). O cancelamento exige `reasonCode` (`"1"`, `"2"` ou `"9"`) e `reason` (15 a 255 caracteres).

Dinheiro usa centavos inteiros; percentuais usam pontos-base inteiros. A emissão de uma venda é assíncrona: acompanhe as notas pelas consultas. A CLI não repete pedidos automaticamente.

Saídas bem-sucedidas são JSON em stdout. Erros vão para stderr, com código de saída 1; sucesso retorna 0. A resposta é repassada sem inventar campos que a API não documentou.

Os testes usam transporte e arquivos simulados. Não crie vendas de teste em empresas reais de produção.
