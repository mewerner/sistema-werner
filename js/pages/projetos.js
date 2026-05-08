// PROJETOS
function renderProjetos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Projetos</h1><p class="page-subtitle">Controle de projetos em andamento</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormProjeto()">+ Novo Projeto</button>
      </div>
    </div>
    <div id="proj-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarProj('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarProj('Em andamento',this)">Em andamento</button>
      <button class="filter-btn" onclick="filtrarProj('Atrasado',this)">Atrasado</button>
      <button class="filter-btn" onclick="filtrarProj('Concluido',this)">Concluido</button>
      <button class="filter-btn" onclick="filtrarProj('Pausado',this)">Pausado</button>
      <button class="filter-btn" onclick="filtrarProj('Cancelado',this)">Cancelado</button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar projeto..." oninput="buscarProj(this.value)" />
        <span id="proj-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="proj-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.PROJETOS, CONFIG.SHEETS.CLIENTES, CONFIG.SHEETS.PROJETO_CUSTOS, CONFIG.SHEETS.PROJETO_EXTRAS, CONFIG.SHEETS.PROJETO_ADITIVOS]);
    atualizarStatusProj();
    renderProjMetricas();
    aplicarFiltrosProj();
  });
}

function atualizarStatusProj() {
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  (window.DB.projetos || []).forEach(p => {
    if (['Concluido','Cancelado'].includes(p.status)) return;
    if (p.prazo_entrega) {
      const prazo = new Date(p.prazo_entrega + 'T00:00:00');
      if (prazo < hoje_d && p.status !== 'Pausado') p.status = 'Atrasado';
    }
  });
}

function renderProjMetricas() {
  const lista = window.DB.projetos || [];
  const andamento = lista.filter(p => p.status === 'Em andamento').length;
  const atrasados = lista.filter(p => p.status === 'Atrasado').length;
  const concluidos = lista.filter(p => p.status === 'Concluido').length;
  const totalFaturado = somarCampo(lista.filter(p => p.status === 'Concluido'), 'valor_total');
  document.getElementById('proj-metricas').innerHTML = `
    <div class="metric-card blue"><div class="metric-label">Em andamento</div><div class="metric-value" style="color:var(--blue)">${andamento}</div></div>
    <div class="metric-card red"><div class="metric-label">Atrasados</div><div class="metric-value red">${atrasados}</div></div>
    <div class="metric-card green"><div class="metric-label">Concluidos</div><div class="metric-value green">${concluidos}</div></div>
    <div class="metric-card accent"><div class="metric-label">Total faturado</div><div class="metric-value accent">${formatMoeda(totalFaturado)}</div></div>`;
}

window._projFiltro = 'todos';
window._projBusca = '';

function filtrarProj(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._projFiltro = tipo;
  aplicarFiltrosProj();
}

function buscarProj(q) { window._projBusca = q.toLowerCase(); aplicarFiltrosProj(); }

function aplicarFiltrosProj() {
  let lista = window.DB.projetos || [];
  if (window._projFiltro !== 'todos') lista = lista.filter(p => p.status === window._projFiltro);
  if (window._projBusca) lista = lista.filter(p => (p.nome + p.cliente_nome + p.numero).toLowerCase().includes(window._projBusca));
  lista = lista.sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
  renderTabelaProj(lista);
}

function renderTabelaProj(lista) {
  document.getElementById('proj-count').textContent = lista.length + ' projetos';
  if (!lista.length) { document.getElementById('proj-table').innerHTML = estadoVazio('Nenhum projeto encontrado'); return; }
  document.getElementById('proj-table').innerHTML = `
    <table><thead><tr>
      <th>No</th><th>Nome</th><th>Cliente</th><th>Valor</th><th>Recebido</th><th>Prazo</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(p => `<tr>
        <td style="color:var(--text-3)">${p.numero || '—'}</td>
        <td><strong>${p.nome || '—'}</strong></td>
        <td style="font-size:12px">${p.cliente_nome || '—'}</td>
        <td style="font-weight:600;color:var(--accent)">${formatMoeda(p.valor_total)}</td>
        <td style="color:var(--green)">${formatMoeda(p.valor_recebido)}</td>
        <td>${p.prazo_entrega ? formatData(p.prazo_entrega) + ' ' + urgencia(p.prazo_entrega) : '—'}</td>
        <td>${badgeStatus(p.status || 'Em andamento')}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="abrirDetalhesProjeto('${p.id}')">Ver</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarProjBtn(this)" data-p="${JSON.stringify(p).replace(/"/g,'&quot;')}">✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirProj('${p.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormProjeto(p) {
  const edit = !!p;
  const clientes = window.DB.clientes || [];
  const v = (id) => p ? (p[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Nome do projeto *</label><input id="pj-nome" value="${v('nome')}" placeholder="Ex: Cozinha planejada" /></div>
      <div class="input-group"><label>Cliente *</label>
        <select id="pj-cliente_id" onchange="preencherNomeClienteProj()">
          <option value="">Selecione...</option>
          ${clientes.map(c => `<option value="${c.id}" data-nome="${c.nome}" ${v('cliente_id')===c.id?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="input-group"><label>Descricao</label><textarea id="pj-descricao" rows="2">${v('descricao')}</textarea></div>
    <div class="form-row cols-3" style="margin-top:16px;">
      <div class="input-group"><label>Data de inicio</label><input type="date" id="pj-data_inicio" value="${v('data_inicio') || hoje()}" /></div>
      <div class="input-group"><label>Prazo de entrega</label><input type="date" id="pj-prazo_entrega" value="${v('prazo_entrega')}" /></div>
      <div class="input-group"><label>Data entrega real</label><input type="date" id="pj-data_entrega_real" value="${v('data_entrega_real')}" /></div>
    </div>
    <hr class="divider"/>
    <div class="form-row cols-3">
      <div class="input-group"><label>Valor total (R$) *</label><input type="number" step="0.01" id="pj-valor_total" value="${v('valor_total')}" /></div>
      <div class="input-group"><label>Valor entrada (R$)</label><input type="number" step="0.01" id="pj-valor_entrada" value="${v('valor_entrada')}" /></div>
      <div class="input-group"><label>Valor recebido (R$)</label><input type="number" step="0.01" id="pj-valor_recebido" value="${v('valor_recebido') || '0'}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Custo previsto (R$)</label><input type="number" step="0.01" id="pj-custo_previsto" value="${v('custo_previsto')}" /></div>
      <div class="input-group"><label>Custo realizado (R$)</label><input type="number" step="0.01" id="pj-custo_realizado" value="${v('custo_realizado') || '0'}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Status</label>
        <select id="pj-status">
          ${['Em andamento','Pausado','Concluido','Atrasado','Cancelado'].map(s => `<option ${v('status')===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Origem</label>
        <select id="pj-origem">
          <option ${v('origem')==='Manual'||!v('origem')?'selected':''}>Manual</option>
          <option ${v('origem')==='Orcamento'?'selected':''}>Orcamento</option>
        </select>
      </div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="pj-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarProjeto('${edit ? p.id : ''}')">${edit ? 'Salvar' : 'Criar projeto'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Projeto' : 'Novo Projeto', html, 'modal-lg');
}

function preencherNomeClienteProj() {}

async function salvarProjeto(id) {
  const sel = document.getElementById('pj-cliente_id');
  const opt = sel.options[sel.selectedIndex];
  const valorTotal = parseFloat(document.getElementById('pj-valor_total').value) || 0;
  const custoReal = parseFloat(document.getElementById('pj-custo_realizado').value) || 0;
  const extras = id ? somarCampo((window.DB.projeto_extras || []).filter(e => e.projeto_id === id), 'valor') : 0;
  const lucroBruto = valorTotal - custoReal - extras;
  const margem = valorTotal > 0 ? (lucroBruto / valorTotal * 100).toFixed(1) : '0';
  const obj = {
    nome: document.getElementById('pj-nome').value,
    cliente_id: sel.value,
    cliente_nome: sel.value ? (opt.dataset.nome || '') : '',
    descricao: document.getElementById('pj-descricao').value,
    data_inicio: document.getElementById('pj-data_inicio').value,
    prazo_entrega: document.getElementById('pj-prazo_entrega').value,
    data_entrega_real: document.getElementById('pj-data_entrega_real').value,
    valor_total: valorTotal,
    valor_entrada: document.getElementById('pj-valor_entrada').value,
    valor_recebido: document.getElementById('pj-valor_recebido').value,
    saldo_receber: (valorTotal - parseFloat(document.getElementById('pj-valor_recebido').value || 0)).toFixed(2),
    custo_previsto: document.getElementById('pj-custo_previsto').value,
    custo_realizado: custoReal,
    lucro_bruto: lucroBruto.toFixed(2),
    margem_pct: margem,
    status: document.getElementById('pj-status').value,
    origem: document.getElementById('pj-origem').value,
    observacoes: document.getElementById('pj-observacoes').value,
  };
  if (!obj.nome || !obj.cliente_id || !obj.valor_total) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id; obj.atualizado_em = hoje();
    await Sheets.atualizar(CONFIG.SHEETS.PROJETOS, id, obj);
    mostrarToast('Projeto atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.numero = gerarNumero('PRO', window.DB.projetos || []);
    obj.criado_em = hoje(); obj.atualizado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.PROJETOS, obj);
    mostrarToast('Projeto criado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.PROJETOS]);
  atualizarStatusProj();
  renderProjMetricas();
  aplicarFiltrosProj();
}

function abrirDetalhesProjeto(id) {
  const p = (window.DB.projetos || []).find(x => x.id === id);
  if (!p) return;
  const extras = (window.DB.projeto_extras || []).filter(e => e.projeto_id === id);
  const aditivos = (window.DB.projeto_aditivos || []).filter(a => a.projeto_id === id);
  const totalExtras = somarCampo(extras, 'valor');
  const totalAditivos = somarCampo(aditivos.filter(a => a.aprovado === 'true'), 'valor_extra');
  const lucroBruto = (parseFloat(p.valor_total) || 0) - (parseFloat(p.custo_realizado) || 0) - totalExtras;
  const margem = parseFloat(p.valor_total) > 0 ? (lucroBruto / parseFloat(p.valor_total) * 100).toFixed(1) : '0';
  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px;">
      <div><span style="color:var(--text-3)">No</span><br><strong>${p.numero}</strong></div>
      <div><span style="color:var(--text-3)">Cliente</span><br>${p.cliente_nome}</div>
      <div><span style="color:var(--text-3)">Status</span><br>${badgeStatus(p.status)}</div>
      <div><span style="color:var(--text-3)">Inicio</span><br>${formatData(p.data_inicio)}</div>
      <div><span style="color:var(--text-3)">Prazo</span><br>${formatData(p.prazo_entrega)} ${urgencia(p.prazo_entrega)}</div>
      <div><span style="color:var(--text-3)">Entrega real</span><br>${p.data_entrega_real ? formatData(p.data_entrega_real) : '—'}</div>
    </div>
    <hr class="divider"/>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="card">
        <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Financeiro</div>
        <table style="width:100%;font-size:13px;">
          <tr><td style="padding:4px 0;color:var(--text-2)">Valor total</td><td style="text-align:right;font-weight:600">${formatMoeda(p.valor_total)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Recebido</td><td style="text-align:right;color:var(--green)">${formatMoeda(p.valor_recebido)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Saldo a receber</td><td style="text-align:right;color:var(--yellow)">${formatMoeda(p.saldo_receber)}</td></tr>
          ${totalAditivos > 0 ? `<tr><td style="padding:4px 0;color:var(--text-2)">Aditivos aprovados</td><td style="text-align:right;color:var(--accent)">+${formatMoeda(totalAditivos)}</td></tr>` : ''}
        </table>
      </div>
      <div class="card">
        <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Lucratividade</div>
        <table style="width:100%;font-size:13px;">
          <tr><td style="padding:4px 0;color:var(--text-2)">Custo previsto</td><td style="text-align:right">${formatMoeda(p.custo_previsto)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Custo realizado</td><td style="text-align:right;color:var(--red)">${formatMoeda(p.custo_realizado)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Gastos extras</td><td style="text-align:right;color:var(--red)">${formatMoeda(totalExtras)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)"><strong>Lucro bruto</strong></td><td style="text-align:right;font-weight:600;color:${lucroBruto>=0?'var(--green)':'var(--red)'}">${formatMoeda(lucroBruto)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Margem</td><td style="text-align:right;color:var(--accent)">${margem}%</td></tr>
        </table>
      </div>
    </div>
    ${extras.length ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Gastos Extras / Imprevistos</div>
      ${extras.map(e => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span>${e.descricao} <span style="color:var(--text-3);font-size:11px">${e.motivo ? '— '+e.motivo : ''}</span></span>
        <span style="color:var(--red)">${formatMoeda(e.valor)}</span>
      </div>`).join('')}
    </div>` : ''}
    ${aditivos.length ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Aditivos de Valor</div>
      ${aditivos.map(a => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span>${a.descricao} ${a.aprovado==='true'?'<span class="badge badge-green">Aprovado</span>':'<span class="badge badge-yellow">Pendente</span>'}</span>
        <span style="color:var(--green)">+${formatMoeda(a.valor_extra)}</span>
      </div>`).join('')}
    </div>` : ''}
    ${p.observacoes ? `<div style="font-size:13px;color:var(--text-2);margin-bottom:16px;"><span style="color:var(--text-3)">Obs:</span> ${p.observacoes}</div>` : ''}
    <div class="modal-footer" style="flex-wrap:wrap;gap:8px;">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn btn-secondary" onclick="fecharModal();abrirGastoExtra('${id}')">+ Gasto extra</button>
      <button class="btn btn-secondary" onclick="fecharModal();abrirAditivo('${id}')">+ Aditivo</button>
      <button class="btn btn-primary" onclick="fecharModal();editarProjeto('${id}')">Editar</button>
    </div>`;
  abrirModal('Projeto — ' + p.nome, html, 'modal-lg');
}

function abrirGastoExtra(projetoId) {
  const html = `
    <div class="input-group"><label>Descricao *</label><input id="ge-desc" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="ge-valor" /></div>
      <div class="input-group"><label>Data</label><input type="date" id="ge-data" value="${hoje()}" /></div>
    </div>
    <div class="input-group"><label>Motivo</label>
      <select id="ge-motivo">
        <option>Retrabalho</option><option>Material danificado</option><option>Medida errada</option><option>Imprevisto</option><option>Outro</option>
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarGastoExtra('${projetoId}')">Registrar</button>
    </div>`;
  abrirModal('Gasto Extra / Imprevisto', html, 'modal-sm');
}

async function salvarGastoExtra(projetoId) {
  const desc = document.getElementById('ge-desc').value;
  const valor = document.getElementById('ge-valor').value;
  if (!desc || !valor) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  await Sheets.adicionar(CONFIG.SHEETS.PROJETO_EXTRAS, {
    id: gerarId(), projeto_id: projetoId, descricao: desc,
    valor, motivo: document.getElementById('ge-motivo').value,
    data: document.getElementById('ge-data').value,
  });
  mostrarToast('Gasto extra registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.PROJETO_EXTRAS]);
}

function abrirAditivo(projetoId) {
  const html = `
    <div class="input-group"><label>Descricao *</label><input id="ad-desc" placeholder="O que foi alterado/adicionado" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>Valor extra (R$) *</label><input type="number" step="0.01" id="ad-valor" /></div>
      <div class="input-group"><label>Aprovado pelo cliente?</label>
        <select id="ad-aprovado"><option value="true">Sim</option><option value="false">Nao</option></select>
      </div>
    </div>
    <div class="input-group"><label>Data</label><input type="date" id="ad-data" value="${hoje()}" /></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarAditivo('${projetoId}')">Registrar aditivo</button>
    </div>`;
  abrirModal('Aditivo de Valor', html, 'modal-sm');
}

async function salvarAditivo(projetoId) {
  const desc = document.getElementById('ad-desc').value;
  const valor = document.getElementById('ad-valor').value;
  if (!desc || !valor) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  await Sheets.adicionar(CONFIG.SHEETS.PROJETO_ADITIVOS, {
    id: gerarId(), projeto_id: projetoId, descricao: desc,
    valor_extra: valor, aprovado: document.getElementById('ad-aprovado').value,
    data: document.getElementById('ad-data').value,
  });
  mostrarToast('Aditivo registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.PROJETO_ADITIVOS]);
}

function editarProjeto(id) {
  const p = (window.DB.projetos || []).find(x => x.id === id);
  if (p) abrirFormProjeto(p);
}

function editarProjBtn(btn) { abrirFormProjeto(JSON.parse(btn.dataset.p.replace(/&quot;/g,'"'))); }

function excluirProj(id) {
  confirmar('Excluir este projeto?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.PROJETOS, id);
    mostrarToast('Projeto excluido', 'success');
    await carregarDados([CONFIG.SHEETS.PROJETOS]);
    atualizarStatusProj();
    renderProjMetricas();
    aplicarFiltrosProj();
  });
}
