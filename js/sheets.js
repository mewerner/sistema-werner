// =============================================
// SHEETS — CRUD Google Sheets
// =============================================

const Sheets = {

  // Lê todos os dados de uma aba
  async ler(aba) {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: aba,
    });
    const rows = resp.result.values || [];
    if (rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      return obj;
    });
  },

  // Lê cabeçalhos de uma aba
  async lerCabecalhos(aba) {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${aba}!1:1`,
    });
    return (resp.result.values || [[]])[0];
  },

  // Adiciona uma linha
  async adicionar(aba, obj) {
    const headers = await this.lerCabecalhos(aba);
    const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: aba,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });
  },

  // Atualiza uma linha pelo ID
  async atualizar(aba, id, obj) {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: aba,
    });
    const rows = resp.result.values || [];
    const headers = rows[0];
    const idCol = headers.indexOf('id');
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === String(id));
    if (rowIndex === -1) return;
    const newRow = headers.map(h => obj[h] !== undefined ? obj[h] : (rows[rowIndex][headers.indexOf(h)] || ''));
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${aba}!A${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });
  },

  // Exclui uma linha pelo ID
  async excluir(aba, id) {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: aba,
    });
    const rows = resp.result.values || [];
    const headers = rows[0];
    const idCol = headers.indexOf('id');
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === String(id));
    if (rowIndex === -1) return;
    // Pega o sheetId da aba
    const meta = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
    });
    const sheet = meta.result.sheets.find(s => s.properties.title === aba);
    if (!sheet) return;
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            }
          }
        }]
      }
    });
  },

  // Garante que uma aba existe com os headers corretos
  async garantirAba(nome, headers) {
    try {
      const meta = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
      });
      const existe = meta.result.sheets.some(s => s.properties.title === nome);
      if (!existe) {
        // Cria a aba
        await gapi.client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: CONFIG.SPREADSHEET_ID,
          resource: { requests: [{ addSheet: { properties: { title: nome } } }] }
        });
        // Adiciona headers
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: CONFIG.SPREADSHEET_ID,
          range: `${nome}!A1`,
          valueInputOption: 'RAW',
          resource: { values: [headers] },
        });
      }
    } catch(e) {
      console.error('garantirAba error:', e);
    }
  },

  // Inicializa todas as abas necessárias
  async inicializarAbas() {
    const abas = {
      [CONFIG.SHEETS.ORCAMENTOS]: ['id','numero','data','validade','cliente_id','cliente_nome','descricao','ambiente','dimensoes','total_materiais_custo','total_materiais_venda','mao_obra','custos_indiretos','subtotal','margem_pct','valor_final','considerar_imposto','status','observacoes','criado_em','atualizado_em'],
      [CONFIG.SHEETS.ORCAMENTO_ITENS]: ['id','orcamento_id','descricao','segmento','quantidade','unidade','preco_custo','preco_venda','total_custo','total_venda','visivel_pdf'],
      [CONFIG.SHEETS.PROJETOS]: ['id','numero','orcamento_id','cliente_id','cliente_nome','nome','descricao','data_inicio','prazo_entrega','data_entrega_real','valor_total','valor_entrada','valor_recebido','saldo_receber','custo_previsto','custo_realizado','lucro_bruto','margem_pct','status','observacoes','criado_em','atualizado_em'],
      [CONFIG.SHEETS.PROJETO_CUSTOS]: ['id','projeto_id','tipo','descricao','valor_previsto','valor_realizado','data','observacoes'],
      [CONFIG.SHEETS.PROJETO_EXTRAS]: ['id','projeto_id','descricao','valor','motivo','data'],
      [CONFIG.SHEETS.PROJETO_ADITIVOS]: ['id','projeto_id','descricao','valor_extra','aprovado','data'],
      [CONFIG.SHEETS.CLIENTES]: ['id','numero','tipo','nome','cpf_cnpj','ie','im','contato','telefone','email','email_nf','logradouro','numero_end','complemento','bairro','cidade','estado','cep','origem','indicado_por_id','indicado_por_nome','observacoes','criado_em'],
      [CONFIG.SHEETS.FLUXO_CAIXA]: ['id','data','descricao','categoria','tipo','valor','forma_pagamento','conta','vinculo_tipo','vinculo_id','observacoes','criado_em'],
      [CONFIG.SHEETS.CONTAS_RECEBER]: ['id','cliente_id','cliente_nome','projeto_id','descricao','valor_total','parcela_num','parcela_total','valor_parcela','data_emissao','data_vencimento','data_recebimento','forma_recebimento','status','observacoes','criado_em'],
      [CONFIG.SHEETS.CONTAS_PAGAR]: ['id','fornecedor_id','fornecedor_nome','projeto_id','numero_nf','descricao','valor_total','parcela_num','parcela_total','valor_parcela','data_emissao','data_vencimento','data_pagamento','forma_pagamento','categoria','status','observacoes','criado_em'],
      [CONFIG.SHEETS.COMPRAS]: ['id','numero','data','fornecedor_id','fornecedor_nome','numero_nf','total','observacoes','criado_em'],
      [CONFIG.SHEETS.COMPRA_ITENS]: ['id','compra_id','descricao','segmento','quantidade','unidade','preco_custo','preco_venda','total','projeto_id','situacao'],
      [CONFIG.SHEETS.ESTOQUE]: ['id','nome','segmento','unidade','quantidade','quantidade_minima','valor_unitario_medio','valor_total','observacoes','atualizado_em'],
      [CONFIG.SHEETS.ESTOQUE_HISTORICO]: ['id','estoque_id','tipo','quantidade','valor_unitario','fornecedor_id','numero_nf','projeto_id','data','motivo'],
      [CONFIG.SHEETS.CUSTOS_FIXOS]: ['id','descricao','categoria','periodicidade','valor','dia_vencimento','mes_vencimento','ano_vencimento','valor_total_anual','valor_reservado','status','observacoes','criado_em'],
      [CONFIG.SHEETS.CUSTOS_FIXOS_DEPOSITOS]: ['id','custo_fixo_id','data','valor','observacoes'],
      [CONFIG.SHEETS.FORNECEDORES]: ['id','numero','razao_social','cnpj','contato','telefone','email','logradouro','numero_end','complemento','bairro','cidade','estado','cep','segmentos','prazo_entrega','observacoes','criado_em'],
      [CONFIG.SHEETS.CARTOES]: ['id','nome','titular','ultimos4','dia_fechamento','dia_vencimento','limite','ativo'],
      [CONFIG.SHEETS.CARTAO_LANCAMENTOS]: ['id','cartao_id','data','descricao','estabelecimento','valor_total','parcelas','valor_parcela','parcela_atual','mes_fatura','ano_fatura','categoria','projeto_id','tipo','taxa_operadora','observacoes'],
      [CONFIG.SHEETS.CHEQUES]: ['id','tipo','numero','banco','titular_destinatario','valor','data_emissao_recebimento','data_bom_para','vinculo_tipo','vinculo_id','cliente_fornecedor_nome','status','data_compensacao','motivo_devolucao','motivo_inutilizacao','repassado_para','valor_repassado','data_repasse','obs_repasse','observacoes','criado_em'],
      [CONFIG.SHEETS.COMBUSTIVEL]: ['id','data','veiculo_id','motorista','litros','valor_litro','valor_total','km_atual','km_litro','posto','forma_pagamento','projeto_id','tipo_lancamento','data_vencimento','status','observacoes'],
      [CONFIG.SHEETS.VEICULOS]: ['id','nome','placa','modelo_ano','observacoes','ativo'],
      [CONFIG.SHEETS.PESSOAL]: ['id','nome','tipo','salario_mensal','dia_pagamento','ativo','observacoes','criado_em'],
      [CONFIG.SHEETS.PESSOAL_PAGAMENTOS]: ['id','pessoal_id','mes','ano','tipo','valor','data_pagamento','observacoes'],
      [CONFIG.SHEETS.PRECIFICACAO]: ['id','nome','data','materiais','desperdicio_pct','mao_obra_horas','mao_obra_valor_hora','custo_fixo_hora','horas_projeto','entrega_km','custo_km','instalacao_horas','instalacao_valor_hora','considerar_imposto','aliquota','margem_pct','preco_final','observacoes'],
      [CONFIG.SHEETS.CONFIG]: ['chave','valor'],
    };

    for (const [nome, headers] of Object.entries(abas)) {
      await this.garantirAba(nome, headers);
    }
    mostrarToast('Sistema inicializado ✓', 'success');
  }
};
