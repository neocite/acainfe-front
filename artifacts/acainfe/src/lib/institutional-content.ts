import { publicCanonicalPath } from './site-routes';

export type InstitutionalPage = {
  path: string; title: string; description: string; version?: string; notice?: string;
  sections: { title: string; paragraphs: string[]; code?: string; links?: { href: string; label: string }[] }[];
};

export const INSTITUTIONAL_PAGES: InstitutionalPage[] = [
  {
    path: '/developers', title: 'API e agentes de IA',
    description: 'Autenticação, rotas e exemplos da API pública do açaínfe. Integre a emissão de NFS-e por HTTP ou por agentes de IA via MCP.',
    sections: [
      { title: 'Autenticação e endereço base', paragraphs: [
        'Gere sua chave no app, no menu “Agentes de IA”. Envie a chave no cabeçalho x-api-key ou em Authorization: Bearer <chave>. O endereço base da API é https://api.acainfe.com.',
      ] },
      { title: 'Principais rotas', paragraphs: [
        'POST /v1/sales — registrar uma venda e emitir as notas.',
        'GET /v1/invoices e GET /v1/invoices/{id} — consultar notas.',
        'POST /v1/invoices/{id}/cancel — cancelar uma nota.',
        'GET /v1/products e POST /v1/products — produtos e tributação.',
        'GET /v1/public/pricing e GET /v1/public/coverage — preço e cidades atendidas; públicas, sem chave.',
      ] },
      { title: 'Exemplo de emissão', paragraphs: [
        'O exemplo registra uma venda de R$ 97,00. Substitua <chave> pela sua chave e productExternalId pelo identificador do produto. A emissão é assíncrona: acompanhe a nota por GET /v1/invoices/{id}.',
      ], code: `curl -X POST https://api.acainfe.com/v1/sales -H "x-api-key: <chave>" -H "Content-Type: application/json" -d '{"externalId":"pedido-123","customer":{"name":"Ana Souza","taxId":"52998224725","email":"ana@exemplo.com"},"items":[{"productExternalId":"prod_abc","totalCents":9700}]}'` },
      { title: 'Valores inteiros', paragraphs: [
        'Envie sempre valores inteiros: dinheiro em centavos (R$ 82,20 = 8220) e percentuais em pontos-base (2,01% = 201).',
      ] },
      { title: 'Versionamento e descontinuação', paragraphs: [
        'A versão da API está no caminho (/v1). Dentro de uma versão, só entram mudanças compatíveis: novos campos, novas rotas e novos valores opcionais. Uma mudança incompatível só sai numa nova versão (/v2). Uma rota ou versão descontinuada continua funcionando por pelo menos 90 dias, responde com os cabeçalhos Deprecation (RFC 9745) e Sunset (RFC 8594) e é anunciada nesta página e no llms.txt.',
      ] },
      { title: 'Erros', paragraphs: [
        'Toda resposta de erro tem o formato { "error": "<CÓDIGO>", "message": "...", "details": {...} }: error identifica o código, message explica o problema e details traz os detalhes.',
        'VALIDATION (422): os dados enviados não passaram na validação.',
        'NOT_FOUND (404): o recurso não foi encontrado.',
        'CONFLICT e INVALID_STATE (409): há um conflito ou o estado atual não permite a ação.',
        'UNAUTHORIZED (401): a autenticação está ausente ou não foi aceita.',
        'CERTIFICATE_INVALID e CERTIFICATE_MISSING (422): o certificado é inválido ou está ausente.',
        'UNAVAILABLE (503): o serviço está temporariamente indisponível; pode tentar de novo.',
        'INTERNAL (500): ocorreu um erro interno.',
      ] },
      { title: 'Agentes de IA e MCP', paragraphs: [
        'O servidor MCP é https://api.acainfe.com/mcp, com transporte HTTP streamable e a mesma chave, no cabeçalho Authorization: Bearer <chave>. O guia para agentes está em /llms.txt.',
      ], links: [{ href: '/llms.txt', label: 'Guia para agentes de IA' }] },
      { title: 'Referência completa', paragraphs: [
        'Consulte a referência Swagger para os detalhes da API pública, seus parâmetros e respostas.',
      ], links: [
        { href: 'https://api.acainfe.com/docs', label: 'Referência completa da API pública (Swagger)' },
        { href: 'https://api.acainfe.com/openapi.json', label: 'Contrato completo da API pública (OpenAPI JSON)' },
      ] },
    ],
  },
  {
    path: '/sobre', title: 'Sobre o açaínfe',
    description: 'Conheça o açaínfe, produto da EXTRACTIFY TECNOLOGIA LTDA para emissão automática de NFS-e e operação por agentes de IA via MCP.',
    sections: [
      { title: 'Quem somos', paragraphs: ['O açaínfe é um produto da EXTRACTIFY TECNOLOGIA LTDA (CNPJ 28.095.894/0001-60), de São Bernardo do Campo/SP.'] },
      { title: 'Nota fiscal no automático', paragraphs: ['Emite NFS-e automaticamente para quem vende no AbacatePay, com a tributação de cada produto, e pode ser operado por conversa, com agentes de IA via MCP.'] },
      { title: 'Cidades atendidas', paragraphs: ['Atende MEI e empresas do Simples Nacional em São Paulo e São Bernardo do Campo. Empresas de outras cidades entram na lista de espera.'] },
      { title: 'Preço', paragraphs: ['R$ 0,80 por nota emitida, sem mensalidade.'] },
      { title: 'Sistemas de emissão', paragraphs: ['Emite pelo Emissor Nacional da NFS-e e, onde a prefeitura ainda exige, pelo sistema próprio dela: NFS-e Paulistana e Ginfes.'] },
    ],
  },
  {
    path: '/contato', title: 'Contato',
    description: 'Fale com o açaínfe: contato@extractify.com.br ou (11) 3458-7367. EXTRACTIFY TECNOLOGIA LTDA, São Bernardo do Campo/SP.',
    sections: [
      { title: 'Fale com o açaínfe', paragraphs: [
        'Para entrar em contato com o açaínfe, use o e-mail contato@extractify.com.br ou o telefone (11) 3458-7367.',
        'Estes são os canais de contato da EXTRACTIFY TECNOLOGIA LTDA, empresa responsável pelo produto açaínfe.',
      ] },
      { title: 'Endereço e identificação', paragraphs: [
        'EXTRACTIFY TECNOLOGIA LTDA — CNPJ 28.095.894/0001-60.',
        'Av. Pereira Barreto, 1479, sala 2108, Baeta Neves, São Bernardo do Campo/SP, CEP 09751-000.',
      ] },
      { title: 'Recebeu uma nota fiscal?', paragraphs: [
        'Dúvidas sobre uma nota emitida para você devem ir primeiro à empresa que emitiu a nota.',
        'Se você é o cliente que recebeu a NFS-e, procure primeiro essa empresa para esclarecer sua dúvida. O contato do açaínfe informado nesta página é o da empresa responsável pelo sistema de emissão.',
      ] },
    ],
  },
  {
    path: '/privacidade', title: 'Política de privacidade',
    description: 'Como o açaínfe trata dados da conta, da empresa e dos tomadores. Versão de 26/10/2026. Política em revisão.',
    version: 'Versão de 26/10/2026', notice: 'Esta política está em revisão.',
    sections: [
      { title: '1. Quem somos', paragraphs: ['EXTRACTIFY TECNOLOGIA LTDA (CNPJ 28.095.894/0001-60), controladora dos dados da conta. Contato para privacidade e direitos do titular: contato@extractify.com.br.'] },
      { title: '2. Dados da conta', paragraphs: ['Nome, e-mail (do login) e WhatsApp, para acesso, avisos de emissão, cobrança e segurança.'] },
      { title: '3. Dados da empresa cliente', paragraphs: ['CNPJ, razão social, endereço, CNAEs e regime (dados públicos da Receita Federal); inscrição municipal, alíquotas e tributação dos produtos.'] },
      { title: '4. Certificado digital A1', paragraphs: ['Usado só para assinar e transmitir as notas à prefeitura e à Receita; guardado criptografado; nunca exibido nem compartilhado; só aceitamos e-CNPJ emitidos pela ICP-Brasil.'] },
      { title: '5. Integração com o AbacatePay', paragraphs: ['A chave de API fica guardada criptografada e é usada para ler produtos e pagamentos e cadastrar o webhook.'] },
      { title: '6. Dados dos clientes da empresa (tomadores)', paragraphs: ['Nome, CPF/CNPJ, e-mail, telefone e endereço vindos das vendas, usados para emitir e entregar a nota. Aqui o açaínfe atua como operador, em nome da empresa cliente, que é a controladora.'] },
      { title: '7. Com quem compartilhamos', paragraphs: ['Prefeituras e Receita Federal (emissão), o contador indicado pela empresa, provedores de e-mail e de WhatsApp (entrega e avisos), provedores de hospedagem e banco de dados, AbacatePay (gateway da empresa e cobrança do açaínfe). Com sua autorização para cookies analíticos, o Google Analytics recebe eventos de uso descritos no item 11. Não vendemos dados.'] },
      { title: '8. Prazo', paragraphs: ['Documentos fiscais pelo prazo da legislação tributária; demais dados enquanto a conta estiver ativa ou conforme obrigação legal.'] },
      { title: '9. Segurança', paragraphs: ['Criptografia dos segredos (certificado, chaves), chaves de API revogáveis em "Agentes de IA" e acesso restrito.'] },
      { title: '10. Direitos do titular (LGPD, art. 18)', paragraphs: ['Confirmação, acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento, pedidos por contato@extractify.com.br. Tomadores procuram primeiro a empresa que emitiu a nota.'] },
      { title: '11. Cookies', paragraphs: ['Usamos cookies necessários ao login e ao funcionamento. Com sua autorização, usamos também o Google Analytics para medir a navegação, as etapas do cadastro e a geração e confirmação do Pix no checkout. Não enviamos os dados pessoais dos formulários, certificados ou chaves ao Google Analytics. Você pode aceitar, recusar ou retirar a autorização pelo botão “Cookies” no site. Não habilitamos recursos de publicidade.'] },
      { title: '12. Alterações', paragraphs: ['A data no topo indica a versão vigente.'] },
    ],
  },
];

export function institutionalPage(path: string) {
  return INSTITUTIONAL_PAGES.find(page => page.path === publicCanonicalPath(path));
}

export function institutionalMarkdown(page: InstitutionalPage) {
  return `# ${page.title}\n\n${page.version ? `${page.version}\n\n${page.notice}\n\n` : ''}${page.sections.map(section =>
    `## ${section.title}\n\n${section.paragraphs.join('\n\n')}${section.code ? `\n\n\`\`\`bash\n${section.code}\n\`\`\`` : ''}${section.links?.map(link => `\n\n[${link.label}](${link.href.startsWith('/') ? `https://acainfe.com${link.href}` : link.href})`).join('') ?? ''}`).join('\n\n')}\n\n[Início](https://acainfe.com/) · [Sobre](https://acainfe.com/sobre) · [Contato](https://acainfe.com/contato) · [Privacidade](https://acainfe.com/privacidade) · [API e agentes](https://acainfe.com/developers)\n`;
}
