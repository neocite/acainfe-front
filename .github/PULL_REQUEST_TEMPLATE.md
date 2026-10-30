## O que muda

<!-- Resumo da mudança e por quê. Referencie a issue: Closes #123 -->

## Como testar

<!-- Passos para validar. Prints para mudanças visuais (desktop e celular). -->

## Checklist

- [ ] `typecheck`, `build` (com `NODE_ENV=production`) e `test` passam localmente
- [ ] Testes novos ou atualizados para a mudança de comportamento
- [ ] Valores em inteiros (centavos / pontos-base), sem `parseFloat(x) * 100`
- [ ] Nenhum segredo no cliente (sem `VITE_` em chaves privadas) e nenhum dado real (CPF/CNPJ/certificados) no código ou nos testes
- [ ] Commits no padrão Conventional Commits (`feat:`, `fix:`…)
