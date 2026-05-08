// =============================================
// DRIVE — Google Drive integration
// =============================================

const Drive = {

  // Cria uma pasta no Drive
  async criarPasta(nome, parentId) {
    const resp = await gapi.client.drive.files.create({
      resource: {
        name: nome,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    return resp.result.id;
  },

  // Busca pasta por nome dentro de um parent
  async buscarPasta(nome, parentId) {
    const q = `name='${nome}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const resp = await gapi.client.drive.files.list({ q, fields: 'files(id,name)' });
    return resp.result.files[0] || null;
  },

  // Garante que uma pasta existe, cria se não existir
  async garantirPasta(nome, parentId) {
    const existente = await this.buscarPasta(nome, parentId);
    if (existente) return existente.id;
    return await this.criarPasta(nome, parentId);
  },

  // Cria estrutura de pasta para um cliente
  async criarPastaCliente(numero, nome, cidade) {
    const nomePasta = `${numero}_${nome}_${cidade}`;
    const clientesId = await this.garantirPasta('Clientes', CONFIG.DRIVE_ROOT_ID);
    const clienteId = await this.criarPasta(nomePasta, clientesId);
    await this.criarPasta('Orçamentos', clienteId);
    await this.criarPasta('Projetos', clienteId);
    return clienteId;
  },

  // Cria estrutura de pasta para um fornecedor
  async criarPastaFornecedor(numero, nome) {
    const nomePasta = `${numero}_${nome}`;
    const fornsId = await this.garantirPasta('Fornecedores', CONFIG.DRIVE_ROOT_ID);
    const fornId = await this.criarPasta(nomePasta, fornsId);
    await this.criarPasta('Notas Fiscais', fornId);
    return fornId;
  },

  // Cria pasta de projeto dentro do cliente
  async criarPastaProjeto(clientePastaId, numero, nome, cidade) {
    const nomePasta = `${numero}_${nome}_${cidade}`;
    const projetosId = await this.garantirPasta('Projetos', clientePastaId);
    const projetoId = await this.criarPasta(nomePasta, projetosId);
    await this.criarPasta('Fotos', projetoId);
    await this.criarPasta('Contratos', projetoId);
    return projetoId;
  },

  // Upload de arquivo PDF
  async uploadPDF(nome, conteudoBase64, pastaId) {
    const resp = await gapi.client.request({
      path: 'https://www.googleapis.com/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': 'multipart/related; boundary=boundary' },
      body: `--boundary\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: nome, parents: [pastaId] })}\r\n--boundary\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${conteudoBase64}\r\n--boundary--`,
    });
    return resp.result.id;
  }
};
