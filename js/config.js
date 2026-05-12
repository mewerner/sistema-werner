// =============================================
// CONFIG — Sistema Werner
// =============================================

const CONFIG = {
  CLIENT_ID: '574676451219-jdkvpfrr305ip2mjgibrnq4d3ip1jbqj.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
  SPREADSHEET_ID: '13QfEoGi7G9nSRyFWgTaNKjQOj3lHXpSftcTxst_qe0Q',
  DRIVE_ROOT_ID: '1pNbepYdSDG8vmspO63lxL3hIqMgLIWBX',
  SENHA: 'werner2025',

  // Abas do Sheets
  SHEETS: {
    ORCAMENTOS: 'Orçamentos',
    ORCAMENTO_ITENS: 'Orcamento_Itens',
    PROJETOS: 'Projetos',
    PROJETO_CUSTOS: 'Projeto_Custos',
    PROJETO_EXTRAS: 'Projeto_Extras',
    PROJETO_ADITIVOS: 'Projeto_Aditivos',
    CLIENTES: 'Clientes',
    FLUXO_CAIXA: 'Fluxo_Caixa',
    CONTAS_RECEBER: 'Contas_Receber',
    CONTAS_PAGAR: 'Contas_Pagar',
    COMPRAS: 'Compras',
    COMPRA_ITENS: 'Compra_Itens',
    ESTOQUE: 'Estoque',
    ESTOQUE_HISTORICO: 'Estoque_Historico',
    CUSTOS_FIXOS: 'Custos_Fixos',
    CUSTOS_FIXOS_DEPOSITOS: 'CustosFixos_Depositos',
    FORNECEDORES: 'Fornecedores',
    CARTOES: 'Cartoes',
    CARTAO_LANCAMENTOS: 'Cartao_Lancamentos',
    CHEQUES: 'Cheques',
    COMBUSTIVEL: 'Combustivel',
    VEICULOS: 'Veiculos',
    PESSOAL: 'Pessoal',
    PESSOAL_PAGAMENTOS: 'Pessoal_Pagamentos',
    PRECIFICACAO: 'Precificacao',
    MATERIAIS: 'Materiais',
    CONFIG: 'Config',
  },

  // Configurações padrão
  DEFAULTS: {
    ALIQUOTA_SIMPLES: 0.06, // 6% — ajustar com contador
    DESPERDICIO_MATERIAL: 0.12, // 12%
    MARGEM_PADRAO: 0.30, // 30%
  }
};
