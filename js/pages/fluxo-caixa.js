// =============================================
// FLUXO DE CAIXA
// =============================================

function renderFluxoCaixa() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Fluxo de Caixa</h1><p class="page-subtitle">Movimentações reais de entradas e saídas</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormFluxo()">+ Novo Lançamento</button>
      </div>
    </div>
    <div id="fluxo-saldos" class="grid-3" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarFluxo('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarFluxo('Entrada',this)">Entradas</button>
      <button class="filter-btn" onclick="filtrarFluxo('Saída',this)">Saídas</button>
      <select id="fluxo-conta" onchange="aplicarFiltrosFluxo()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todas as contas</option>
        ${(typeof getSysConfig === 'function' ? getSysConfig('contas') : ['Viacredi','Caixa']).map(c=>`<option>${c}</option>`).join('')}
      </select>
      <select id="fluxo-periodo" onchange="aplicarFiltrosFluxo()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="30">Últimos 30 dias</option>
        <option value="7">Últimos 7 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="0">Tudo</option>
      </select>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar lançamento..." oninput="buscarFluxo(this.value)" />
        <span id="fluxo-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="fluxo-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    if (!window._sysConfig && typeof carregarConfiguracoes === 'function') await carregarConfiguracoes();
    await carregarDados([CONFIG.SHEETS.FLUXO_CAIXA]);
    renderFluxoSaldos();
    aplicarFiltrosFluxo();
  });
}

window.carregar_fluxo_caixa = async () => {
  await carregarDados([CONFIG.SHEETS.FLUXO_CAIXA]);
  renderFluxoSaldos();
  aplicarFiltrosFluxo();
};

function renderFluxoSaldos() {
  const todos = window.DB.fluxo_caixa || [];
  const contasNoDados = [...new Set(todos.map(f => f.conta).filter(Boolean))];
  const contas = contasNoDados.length ? contasNoDados : ['Viacredi','Caixa'];
  const saldos = contas.map(conta => {
    const val = somarCampo(todos.filter(f=>f.conta===conta&&f.tipo==='Entrada'),'valor') -
                somarCampo(todos.filter(f=>f.conta===conta&&(f.tipo==='Saída'||f.tipo==='Saida')),'valor');
    return { conta, val };
  });
  const saldoTotal = saldos.reduce((acc,s) => acc + s.val, 0);
  document.getElementById('fluxo-saldos').innerHTML =
    saldos.map(s => `<div class="metric-card ${s.val>=0?'green':'red'}"><div class="metric-label">Saldo ${s.conta}</div><div class="metric-value ${s.val>=0?'green':'red'}">${formatMoeda(s.val)}</div></div>`).join('') +
    `<div class="metric-card accent"><div class="metric-label">Saldo Total</div><div class="metric-value accent">${formatMoeda(saldoTotal)}</div></div>`;
}

window._fluxoTipo = 'todos';
window._fluxoBusca = '';

function filtrarFluxo(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  window._fluxoTipo = tipo;
  aplicarFiltrosFluxo();
}

function buscarFluxo(q) { window._fluxoBusca = q.toLowerCase(); aplicarFiltrosFluxo(); }

function aplicarFiltrosFluxo() {
  let lista = window.DB.fluxo_caixa || [];
  const periodo = parseInt(document.getElementById('fluxo-periodo')?.value||'30');
  const conta = document.getElementById('fluxo-conta')?.value||'';
  if (periodo > 0) {
    const lim = new Date(); lim.setDate(lim.getDate()-periodo);
    lista = lista.filter(f=>new Date(f.data+'T00:00:00')>=lim);
  }
  if (conta) lista = lista.filter(f=>f.conta===conta);
  if (window._fluxoTipo !== 'todos') lista = lista.filter(f=>f.tipo===window._fluxoTipo);
  if (window._fluxoBusca) lista = lista.filter(f=>(f.descricao+f.categoria+f.forma_pagamento).toLowerCase().includes(window._fluxoBusca));
  lista = lista.sort((a,b)=>new Date(b.data)-new Date(a.data));
  renderTabelaFluxo(lista);
}

function renderTabelaFluxo(lista) {
  document.getElementById('fluxo-count').textContent = `${lista.length} registros`;
  if (!lista.length) { document.getElementById('fluxo-table').innerHTML = estadoVazio('Nenhum lançamento encontrado'); return; }
  document.getElementById('fluxo-table').innerHTML = `
    <table><thead><tr>
      <th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th>Conta</th><th>Tipo</th><th>Valor</th><th></th>
    </tr></thead><tbody>
      ${lista.map(f=>`<tr>
        <td style="color:var(--text-3)">${formatData(f.data)}</td>
        <td>${f.descricao||'—'}</td>
        <td><span class="badge badge-gray">${f.categoria||'—'}</span></td>
        <td style="font-size:12px;color:var(--text-2)">${f.forma_pagamento||'—'}</td>
        <td><span class="badge badge-blue">${f.conta||'—'}</span></td>
        <td>${f.tipo==='Entrada'?'<span class="badge badge-green">Entrada</span>':'<span class="badge badge-red">Saída</span>'}</td>
        <td style="font-family:'Syne',sans-serif;font-weight:600;color:${f.tipo==='Entrada'?'var(--green)':'var(--red)'}">${formatMoeda(f.valor)}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick='editarFluxo(${JSON.stringify(f)})'>✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirFluxo('${f.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormFluxo(f = null) {
  const edit = !!f;
  const cats = typeof getSysConfig === 'function' ? getSysConfig('categorias_fluxo') : ['Materiais','Custos fixos','Projeto','Combustível','Cartão de crédito','Fornecedores','Pessoal','Impostos','Outros'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Data *</label><input type="date" id="f-data" value="${f?.data||hoje()}" /></div>
      <div class="input-group"><label>Tipo *</label>
        <select id="f-tipo">
          <option ${f?.tipo==='Entrada'?'selected':''}>Entrada</option>
          <option ${f?.tipo==='Saída'?'selected':''}>Saída</option>
        </select>
      </div>
    </div>
    <div class="input-group"><label>Descrição *</label><input id="f-descricao" value="${f?.descricao||''}" /></div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Categoria</label>
        <select id="f-categoria">${cats.map(c=>`<option ${f?.categoria===c?'selected':''}>${c}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Valor *</label><input type="number" step="0.01" id="f-valor" value="${f?.valor||''}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Forma de Pagamento</label>
        <select id="f-forma_pagamento">
          ${(typeof getSysConfig === 'function' ? getSysConfig('formas_pagamento') : ['PIX','Dinheiro','Boleto','Cheque','Financiamento','Cartão']).map(x=>`<option ${f?.forma_pagamento===x?'selected':''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Conta</label>
        <select id="f-conta">
          ${getSysConfig('contas').map(c=>`<option ${f?.conta===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="input-group"><label>Observações</label><textarea id="f-observacoes" rows="2">${f?.observacoes||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarFluxo(${edit?`'${f.id}'`:'null'})">${edit?'Salvar':'Lançar'}</button>
    </div>`;
  abrirModal(edit?'Editar Lançamento':'Novo Lançamento', html, 'modal-sm');
}

async function salvarFluxo(id) {
  const obj = {
    data: document.getElementById('f-data').value,
    tipo: document.getElementById('f-tipo').value,
    descricao: document.getElementById('f-descricao').value,
    categoria: document.getElementById('f-categoria').value,
    valor: document.getElementById('f-valor').value,
    forma_pagamento: document.getElementById('f-forma_pagamento').value,
    conta: document.getElementById('f-conta').value,
    observacoes: document.getElementById('f-observacoes').value,
  };
  if (!obj.descricao || !obj.valor) { mostrarToast('Preencha os campos obrigatórios', 'error'); return; }
  if (id) { obj.id=id; await Sheets.atualizar(CONFIG.SHEETS.FLUXO_CAIXA,id,obj); mostrarToast('Lançamento atualizado ✓','success'); }
  else { obj.id=gerarId(); obj.criado_em=hoje(); await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA,obj); mostrarToast('Lançamento registrado ✓','success'); }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.FLUXO_CAIXA]);
  renderFluxoSaldos(); aplicarFiltrosFluxo();
}

function editarFluxo(f) { abrirFormFluxo(f); }

function excluirFluxo(id) {
  confirmar('Excluir este lançamento? O saldo será atualizado automaticamente.', async () => {
    await Sheets.excluir(CONFIG.SHEETS.FLUXO_CAIXA, id);
    mostrarToast('Lançamento excluído ✓','success');
    await carregarDados([CONFIG.SHEETS.FLUXO_CAIXA]);
    renderFluxoSaldos(); aplicarFiltrosFluxo();
  });
}
