export type InstitutionalPage = {
  path: string; title: string; description: string; version?: string; notice?: string;
  sections: { title: string; paragraphs: string[] }[];
};

export const INSTITUTIONAL_PAGES: InstitutionalPage[] = [
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
    description: 'Como o açaínfe trata dados da conta, da empresa e dos tomadores. Versão de 21/10/2026. Política em revisão.',
    version: 'Versão de 21/10/2026', notice: 'Esta política está em revisão.',
    sections: [
      { title: '1. Quem somos', paragraphs: ['EXTRACTIFY TECNOLOGIA LTDA (CNPJ 28.095.894/0001-60), controladora dos dados da conta. Contato para privacidade e direitos do titular: contato@extractify.com.br.'] },
      { title: '2. Dados da conta', paragraphs: ['Nome, e-mail (do login) e WhatsApp, para acesso, avisos de emissão, cobrança e segurança.'] },
      { title: '3. Dados da empresa cliente', paragraphs: ['CNPJ, razão social, endereço, CNAEs e regime (dados públicos da Receita Federal); inscrição municipal, alíquotas e tributação dos produtos.'] },
      { title: '4. Certificado digital A1', paragraphs: ['Usado só para assinar e transmitir as notas à prefeitura e à Receita; guardado criptografado; nunca exibido nem compartilhado; só aceitamos e-CNPJ emitidos pela ICP-Brasil.'] },
      { title: '5. Integração com o AbacatePay', paragraphs: ['A chave de API fica guardada criptografada e é usada para ler produtos e pagamentos e cadastrar o webhook.'] },
      { title: '6. Dados dos clientes da empresa (tomadores)', paragraphs: ['Nome, CPF/CNPJ, e-mail, telefone e endereço vindos das vendas, usados para emitir e entregar a nota. Aqui o açaínfe atua como operador, em nome da empresa cliente, que é a controladora.'] },
      { title: '7. Com quem compartilhamos', paragraphs: ['Prefeituras e Receita Federal (emissão), o contador indicado pela empresa, provedores de e-mail e de WhatsApp (entrega e avisos), provedores de hospedagem e banco de dados, AbacatePay (gateway da empresa e cobrança do açaínfe). Não vendemos dados.'] },
      { title: '8. Prazo', paragraphs: ['Documentos fiscais pelo prazo da legislação tributária; demais dados enquanto a conta estiver ativa ou conforme obrigação legal.'] },
      { title: '9. Segurança', paragraphs: ['Criptografia dos segredos (certificado, chaves), chaves de API revogáveis em "Agentes de IA" e acesso restrito.'] },
      { title: '10. Direitos do titular (LGPD, art. 18)', paragraphs: ['Confirmação, acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento, pedidos por contato@extractify.com.br. Tomadores procuram primeiro a empresa que emitiu a nota.'] },
      { title: '11. Cookies', paragraphs: ['Só os necessários ao login e ao funcionamento; nenhum de publicidade.'] },
      { title: '12. Alterações', paragraphs: ['A data no topo indica a versão vigente.'] },
    ],
  },
];

export function institutionalPage(path: string) {
  return INSTITUTIONAL_PAGES.find(page => page.path === path.replace(/\/+$/, ''));
}

export function institutionalMarkdown(page: InstitutionalPage) {
  return `# ${page.title}\n\n${page.version ? `${page.version}\n\n${page.notice}\n\n` : ''}${page.sections.map(section =>
    `## ${section.title}\n\n${section.paragraphs.join('\n\n')}`).join('\n\n')}\n\n[Início](https://acainfe.com/) · [Sobre](https://acainfe.com/sobre) · [Contato](https://acainfe.com/contato) · [Privacidade](https://acainfe.com/privacidade)\n`;
}
