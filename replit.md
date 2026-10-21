# açaínfe

Landing page em `/`, autenticação em `/sign-in` e `/sign-up`, cadastro inicial em `/app` e consulta da conta em `/app/conta`. A operação de notas acontece pela API externa e pelo assistente MCP, não por um emissor local.

## Desenvolvimento

- Aplicação: `artifacts/acainfe`.
- Workflow gerenciado: `artifacts/acainfe: web`.
- Express serve a API e o Vite no mesmo processo e na mesma origem.
- Comandos: `pnpm --filter @workspace/acainfe run typecheck`, `pnpm --filter @workspace/acainfe test`, `pnpm --filter @workspace/acainfe run build`.
- Produção: executar `pnpm --filter @workspace/acainfe start` depois do build. Não publicar como site estático: o Express é necessário para autenticação, preço dinâmico, metadados e proxy.

## Configuração

- `ACAINFE_API_URL`: variável compartilhada; alterar aqui quando o endereço da API mudar. Nenhuma URL externa deve ser fixada no frontend.
- `ACAINFE_APP_KEY`: Secret obrigatório para rotas privadas; nunca usar prefixo `VITE_`.
- Clerk gerenciado autentica usuários com cookies de sessão na mesma origem. `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` e `VITE_CLERK_PUBLISHABLE_KEY` são provisionados automaticamente.
- O proxy do Clerk precisa ser montado antes dos parsers do Express; a resolução de domínio deve permanecer igual no cliente e no servidor.
- Todas as entradas pela landing precisam passar pela autenticação antes de exibir as etapas. Nunca considerar `{}` ou e-mail em branco uma sessão válida; sem sessão, encaminhar ao login. Após autenticar, retomar a etapa indicada pelos dados da API.
- O serviço do artefato deve publicar o processo Express (`start`), sem modo estático ou rewrite de `/api/*` para HTML. O comando de publicação da raiz não substitui a configuração de produção do serviço do artefato.
- A tabela legada `app_sessions` permanece intacta, mas não é usada pelo Clerk. Empresas, certificados, contatos e saldos ficam na API externa, sem tabela local de usuários.
- O vínculo com a API externa continua em `x-user-id`, usando exclusivamente `sessionClaims.userId` validado pelo Clerk. Para contas migradas é o ID original; para contas novas é o ID Clerk. Nunca substituir por `auth.userId`, nem confiar em cabeçalhos de identidade enviados pelo navegador.
- O frontend usa `apiRequest` de `src/lib/queryClient.ts` (também reexportado como `api` em `src/lib/api.ts`), sem bearer tokens. Esperar o Clerk carregar antes de consultar dados privados; 401/403 de usuário já autenticado deve mostrar erro, não redirecionar ao login.
- A API privada é somente da mesma origem. Não aplicar CORS global com reflexão de origem e credenciais: subdomínios não podem ler respostas privadas usando os cookies da conta. O proxy Clerk não precisa desse CORS global.
- O envio de certificados está bloqueado no servidor com `503 CERTIFICATE_ONBOARDING_UNAVAILABLE`, antes de ler multipart ou encaminhar à API externa. Não reativar o endpoint legado: ele aceita certificados sem cadeia ICP-Brasil e pode vincular outro proprietário/substituir o A1 de uma empresa existente. A correção definitiva exige alterar a API externa para validar a cadeia ICP-Brasil e o e-CNPJ e autorizar o vínculo de forma atômica antes de qualquer gravação; não basta consultar `/me` nem examinar a resposta após o envio. Não há implementação dessa API neste repositório. Cadastros por certificado ficam pausados até essa correção.
- Não gravar certificados e senhas em disco. Chaves MCP retornadas ficam apenas na memória da página, sem localStorage.
- Não criar modos de demonstração que simulem certificado válido, emissão ou confirmação de Pix.

## Preços

`src/config/pricing.ts` é a fonte única de preços padrão e planos concorrentes. O servidor consulta `/v1/public/pricing` na API externa e mantém cache de cinco minutos, usando o padrão apenas em indisponibilidade. O HTML público e a imagem social usam esse mesmo preço.

## Unidades numéricas da API

Dinheiro continua em centavos (`Cents`). Percentuais usam inteiros em pontos-base (`Bps`): 6,25% corresponde a 625. Converter percentuais digitados por texto, nunca multiplicando um decimal por 100, para evitar erros de ponto flutuante. A alíquota efetiva do Simples aceita de 0 a 3300 Bps. No formulário, manter a exibição usual em percentual.

## Antes de abrir ao público

- Validar a jornada autenticada com certificado e empresa de teste autorizados. A presença da chave não substitui a validação ponta a ponta.
- Preencher CNPJ da empresa operadora, termos de uso, política de privacidade e canal de contato. Os links legais atualmente indicam explicitamente que aguardam o responsável.
- Validar o login com Google e o fluxo autenticado ponta a ponta. Verificações locais atuais cobrem build, tipos, cálculo dos planos, bloqueio de acesso sem sessão, CSRF, metadados, imagem social e as telas públicas.
