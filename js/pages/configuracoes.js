// CONFIGURACOES
const CONFIG_DEFAULTS = {
  contas: ['Viacredi','Caixa'],
  segmentos: ['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Seguranca','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'],
  categorias_fluxo: ['Materiais','Custos fixos','Projeto','Combustivel','Cartao de credito','Fornecedores','Pessoal','Impostos','Cheque','Outros'],
  categorias_cf: ['Aluguel','Energia','Agua','Internet e Telefone','Contador','Pessoal','Impostos','Outros'],
  empresas_cf: ['Celesc','Guabiruba Saneamento','Aluguel','Internet e Telefone','Contador'],
  formas_pagamento: ['PIX','Dinheiro','Cheque','Boleto','Financiamento','Cartao'],
};

// Cache local das configuracoes
window._sysConfig = null;

async function carregarConfiguracoes() {
  try {
    await carregarDados([CONFIG.SHEETS.CONFIG]);
    const rows = window.DB.config || [];
    const cfg = {};
    rows.forEach(r => {
      try { cfg[r.chave] = JSON.parse(r.valor); } catch(e) { cfg[r.chave] = r.valor; }
    });
    window._sysConfig = { ...CONFIG_DEFAULTS, ...cfg };
  } catch(e) {
    window._sysConfig = { ...CONFIG_DEFAULTS };
  }
  return window._sysConfig;
}

async function salvarConfiguracao(chave, valor) {
  const rows = window.DB.config || [];
  const existente = rows.find(r => r.chave === chave);
  const valorStr = JSON.stringify(valor);
  if (existente) {
    await Sheets.atualizar(CONFIG.SHEETS.CONFIG, existente.id, { ...existente, valor: valorStr });
  } else {
    await Sheets.adicionar(CONFIG.SHEETS.CONFIG, { id: gerarId(), chave, valor: valorStr });
  }
  await carregarDados([CONFIG.SHEETS.CONFIG]);
  // Atualiza cache
  if (window._sysConfig) window._sysConfig[chave] = valor;
}

function getSysConfig(chave) {
  if (window._sysConfig && window._sysConfig[chave]) return window._sysConfig[chave];
  return CONFIG_DEFAULTS[chave] || [];
}

function renderConfiguracoes() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Configuracoes</h1><p class="page-subtitle">Configuracoes gerais do sistema</p></div>
    </div>
    <div id="cfg-loading" class="loading"><div class="spinner"></div> Carregando configuracoes...</div>
    <div id="cfg-content" style="display:none;"></div>`;
  solicitarAutorizacao(async () => {
    await carregarConfiguracoes();
    document.getElementById('cfg-loading').style.display = 'none';
    document.getElementById('cfg-content').style.display = '';
    renderConfigConteudo();
  });
}

function renderConfigConteudo() {
  const cfg = window._sysConfig || CONFIG_DEFAULTS;
  document.getElementById('cfg-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Dados da empresa</div>
          <div class="input-group"><label>Nome da empresa</label><input id="cfg-empresa" value="${cfg.empresa_nome || 'Moveis e Esquadrias Werner'}" /></div>
          <div class="input-group" style="margin-top:12px;"><label>CNPJ</label><input id="cfg-cnpj" value="${cfg.empresa_cnpj || ''}" placeholder="00.000.000/0000-00" /></div>
          <div class="input-group" style="margin-top:12px;"><label>Telefone</label><input id="cfg-telefone" value="${cfg.empresa_telefone || ''}" /></div>
          <div class="input-group" style="margin-top:12px;"><label>E-mail</label><input id="cfg-email" value="${cfg.empresa_email || ''}" /></div>
          <div class="input-group" style="margin-top:12px;"><label>Cidade / Estado</label><input id="cfg-cidade" value="${cfg.empresa_cidade || ''}" /></div>
          <button class="btn btn-primary btn-sm" onclick="salvarConfigEmpresa()" style="margin-top:16px;">Salvar dados</button>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Fiscal</div>
          <div class="input-group"><label>Aliquota efetiva do Simples (%)</label>
            <input type="number" step="0.01" id="cfg-aliquota" value="${((cfg.aliquota||0.06)*100).toFixed(2)}" />
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:8px;">Confirme com seu contador antes de usar.</div>
          <button class="btn btn-primary btn-sm" onclick="salvarConfigFiscal()" style="margin-top:16px;">Salvar</button>
        </div>
        <div class="card">
          <div class="card-title">Informacoes do sistema</div>
          <table style="width:100%;font-size:13px;">
            <tr><td style="padding:8px 0;color:var(--text-2)">Versao</td><td style="text-align:right">1.0</td></tr>
            <tr><td style="padding:8px 0;color:var(--text-2);border-top:1px solid var(--border)">GitHub</td><td style="text-align:right"><a href="https://github.com/mewerner/sistema-werner" target="_blank" style="color:var(--accent)">mewerner/sistema-werner</a></td></tr>
            <tr><td style="padding:8px 0;color:var(--text-2);border-top:1px solid var(--border)">Planilha</td><td style="text-align:right"><a href="https://docs.google.com/spreadsheets/d/13QfEoGi7G9nSRyFWgTaNKjQOj3lHXpSftcTxst_qe0Q" target="_blank" style="color:var(--accent)">Abrir Sheets</a></td></tr>
            <tr><td style="padding:8px 0;color:var(--text-2);border-top:1px solid var(--border)">Drive</td><td style="text-align:right"><a href="https://drive.google.com/drive/folders/1pNbepYdSDG8vmspO63lxL3hIqMgLIWBX" target="_blank" style="color:var(--accent)">Abrir Drive</a></td></tr>
          </table>
        </div>
      </div>
      <div>
        ${renderListaEditavel('Contas bancarias / caixa', 'contas', cfg.contas)}
        ${renderListaEditavel('Segmentos de estoque / fornecedores', 'segmentos', cfg.segmentos)}
        ${renderListaEditavel('Categorias do fluxo de caixa', 'categorias_fluxo', cfg.categorias_fluxo)}
        ${renderListaEditavel('Categorias de custos fixos', 'categorias_cf', cfg.categorias_cf)}
        ${renderListaEditavel('Empresas de custos fixos', 'empresas_cf', cfg.empresas_cf)}
        ${renderListaEditavel('Formas de pagamento', 'formas_pagamento', cfg.formas_pagamento)}
      </div>
    </div>`;
}

function renderListaEditavel(titulo, chave, lista) {
  return `<div class="card" style="margin-bottom:16px;">
    <div class="card-title">${titulo}</div>
    <div id="cfg-lista-${chave}" style="margin-bottom:12px;">
      ${(lista||[]).map((item,i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${item}</span>
          <button onclick="removerItemConfig('${chave}',${i})" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;padding:0 4px;">✕</button>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;">
      <input id="cfg-novo-${chave}" placeholder="Novo item..." style="flex:1;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" 
        onkeydown="if(event.key==='Enter')adicionarItemConfig('${chave}')" />
      <button class="btn btn-primary btn-sm" onclick="adicionarItemConfig('${chave}')">Adicionar</button>
    </div>
  </div>`;
}

async function adicionarItemConfig(chave) {
  const input = document.getElementById('cfg-novo-' + chave);
  const val = input?.value?.trim();
  if (!val) return;
  const cfg = window._sysConfig || CONFIG_DEFAULTS;
  const lista = [...(cfg[chave] || [])];
  if (lista.includes(val)) { mostrarToast('Item ja existe', 'error'); return; }
  lista.push(val);
  await salvarConfiguracao(chave, lista);
  input.value = '';
  renderConfigConteudo();
  mostrarToast('Adicionado e salvo', 'success');
}

async function removerItemConfig(chave, idx) {
  const cfg = window._sysConfig || CONFIG_DEFAULTS;
  const lista = [...(cfg[chave] || [])];
  lista.splice(idx, 1);
  await salvarConfiguracao(chave, lista);
  renderConfigConteudo();
  mostrarToast('Removido e salvo', 'success');
}

async function salvarConfigEmpresa() {
  mostrarToast('Salvando...', '');
  await salvarConfiguracao('empresa_nome', document.getElementById('cfg-empresa')?.value || '');
  await salvarConfiguracao('empresa_cnpj', document.getElementById('cfg-cnpj')?.value || '');
  await salvarConfiguracao('empresa_telefone', document.getElementById('cfg-telefone')?.value || '');
  await salvarConfiguracao('empresa_email', document.getElementById('cfg-email')?.value || '');
  await salvarConfiguracao('empresa_cidade', document.getElementById('cfg-cidade')?.value || '');
  mostrarToast('Dados da empresa salvos', 'success');
}

async function salvarConfigFiscal() {
  const aliquota = parseFloat(document.getElementById('cfg-aliquota')?.value) / 100;
  await salvarConfiguracao('aliquota', aliquota);
  if (CONFIG.DEFAULTS) CONFIG.DEFAULTS.ALIQUOTA_SIMPLES = aliquota;
  mostrarToast('Aliquota salva no sistema', 'success');
}
