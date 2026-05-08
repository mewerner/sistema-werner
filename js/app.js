// =============================================
// APP — Controlador principal
// =============================================

window.paginaAtual = 'dashboard';

// Cache de dados em memória
window.DB = {
  orcamentos: [], orcamento_itens: [],
  projetos: [], projeto_custos: [], projeto_extras: [], projeto_aditivos: [],
  clientes: [],
  fluxo_caixa: [],
  contas_receber: [], contas_pagar: [],
  compras: [], compra_itens: [],
  estoque: [], estoque_historico: [],
  custos_fixos: [], custos_fixos_depositos: [],
  fornecedores: [],
  cartoes: [], cartao_lancamentos: [],
  cheques: [],
  combustivel: [], veiculos: [],
  pessoal: [], pessoal_pagamentos: [],
  precificacao: [],
  config: [],
};

// Mapeamento de páginas
const PAGINAS = {
  'dashboard': { fn: renderDashboard, titulo: 'Dashboard' },
  'orcamentos': { fn: renderOrcamentos, titulo: 'Orçamentos' },
  'projetos': { fn: renderProjetos, titulo: 'Projetos' },
  'clientes': { fn: renderClientes, titulo: 'Clientes' },
  'fluxo-caixa': { fn: renderFluxoCaixa, titulo: 'Fluxo de Caixa' },
  'contas-receber': { fn: renderContasReceber, titulo: 'Contas a Receber' },
  'contas-pagar': { fn: renderContasPagar, titulo: 'Contas a Pagar' },
  'cartoes': { fn: renderCartoes, titulo: 'Cartões de Crédito' },
  'cheques': { fn: renderCheques, titulo: 'Controle de Cheques' },
  'compras': { fn: renderCompras, titulo: 'Compras e Fornecedores' },
  'estoque': { fn: renderEstoque, titulo: 'Estoque' },
  'fornecedores': { fn: renderFornecedores, titulo: 'Fornecedores' },
  'combustivel': { fn: renderCombustivel, titulo: 'Combustível' },
  'custos-fixos': { fn: renderCustosFixos, titulo: 'Custos Fixos' },
  'pessoal': { fn: renderPessoal, titulo: 'Pessoal' },
  'precificacao': { fn: renderPrecificacao, titulo: 'Precificação' },
  'configuracoes': { fn: renderConfiguracoes, titulo: 'Configurações' },
};

function iniciarApp() {
  // Inicializa Google APIs
  if (typeof gapi !== 'undefined') {
    gapiLoaded();
  }
  // Navega para dashboard
  navegarPara('dashboard');
}

function navegarPara(pagina) {
  window.paginaAtual = pagina;

  // Atualiza nav ativo
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pagina);
  });

  const page = PAGINAS[pagina];
  if (!page) return;

  const container = document.getElementById('page-container');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Carregando...</div>`;

  // Pequeno delay para mostrar loading
  setTimeout(() => {
    try {
      page.fn();
    } catch(e) {
      console.error(e);
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar página</p></div>`;
    }
  }, 50);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// Carrega dados do Sheets para o cache
async function carregarDados(abas) {
  if (!googleAuthorized) return;
  for (const aba of abas) {
    try {
      const chave = aba.toLowerCase().replace(/[^a-z_]/g, '_');
      window.DB[chave] = await Sheets.ler(aba);
    } catch(e) {
      console.warn(`Erro ao carregar ${aba}:`, e);
    }
  }
}

// Inicializa o sistema pela primeira vez (cria abas no Sheets)
async function inicializarSistema() {
  solicitarAutorizacao(async () => {
    mostrarToast('Inicializando sistema...', '');
    await Sheets.inicializarAbas();
  });
}
