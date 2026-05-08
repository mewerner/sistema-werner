// CONTROLE DE CHEQUES
function renderCheques() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Controle de Cheques</h1><p class="page-subtitle">Cheques recebidos e emitidos</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormCheque()">+ Novo Cheque</button>
      </div>
    </div>
    <div id="ch-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarCH('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarCH('Recebido',this)">A Receber</button>
      <button class="filter-btn" onclick="filtrarCH('Emitido',this)">Emitidos</button>
      <button class="filter-btn" onclick="filtrarCH('Aguardando',this)">Aguardando</button>
      <button class="filter-btn" onclick="filtrarCH('Compensado',this)">Compensado</button>
      <button class="filter-btn" onclick="filtrarCH('Devolvido',this)">Devolvido</button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar cheque..." oninput="buscarCH(this.value)" />
        <span id="ch-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="ch-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.CHEQUES]);
    renderCHMetricas();
    aplicarFiltrosCH();
  });
}

function renderCHMetricas() {
  const lista = window.DB.cheques || [];
  const aReceber = lista.filter(c => c.tipo === 'Recebido' && c.status === 'Aguardando');
  const emitidos = lista.filter(c => c.tipo === 'Emitido' && c.status === 'Aguardando');
  const devolvidos = lista.filter(c => c.status === 'Devolvido');
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  const venceHoje = lista.filter(c => {
    if (c.status !== 'Aguardando') return false;
    const d = new Date(c.data_bom_para + 'T00:00:00');
    return d.getTime() === hoje_d.getTime();
  });
  document.getElementById('ch-metricas').innerHTML = `
    <div class="metric-card green"><div class="metric-label">A Receber</div><div class="metric-value green">${formatMoeda(somarCampo(aReceber,'valor'))}</div><div class="metric-sub">${aReceber.length} cheques</div></div>
    <div class="metric-card red"><div class="metric-label">Emitidos</div><div class="metric-value red">${formatMoeda(somarCampo(emitidos,'valor'))}</div><div class="metric-sub">${emitidos.length} cheques</div></div>
    <div class="metric-card yellow"><div class="metric-label">Bom para hoje</div><div class="metric-value yellow">${venceHoje.length}</div><div class="metric-sub">${formatMoeda(somarCampo(venceHoje,'valor'))}</div></div>
    <div class="metric-card red"><div class="metric-label">Devolvidos</div><div class="metric-value red">${devolvidos.length}</div><div class="metric-sub">${formatMoeda(somarCampo(devolvidos,'valor'))}</div></div>`;
}

window._chFiltro = 'todos';
window._chBusca = '';

function filtrarCH(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._chFiltro = tipo;
  aplicarFiltrosCH();
}

function buscarCH(q) { window._chBusca = q.toLowerCase(); aplicarFiltrosCH(); }

function aplicarFiltrosCH() {
  let lista = window.DB.cheques || [];
  if (window._chFiltro === 'Recebido') lista = lista.filter(c => c.tipo === 'Recebido');
  else if (window._chFiltro === 'Emitido') lista = lista.filter(c => c.tipo === 'Emitido');
  else if (['Aguardando','Compensado','Devolvido'].includes(window._chFiltro)) lista = lista.filter(c => c.status === window._chFiltro);
  if (window._chBusca) lista = lista.filter(c => (c.titular_destinatario + c.numero + c.banco).toLowerCase().includes(window._chBusca));
  lista = lista.sort((a, b) => new Date(a.data_bom_para) - new Date(b.data_bom_para));
  renderTabelaCH(lista);
}

function renderTabelaCH(lista) {
  document.getElementById('ch-count').textContent = lista.length + ' registros';
  if (!lista.length) { document.getElementById('ch-table').innerHTML = estadoVazio('Nenhum cheque cadastrado'); return; }
  document.getElementById('ch-table').innerHTML = `
    <table><thead><tr>
      <th>Tipo</th><th>No Cheque</th><th>Banco</th><th>Titular/Dest.</th><th>Valor</th><th>Emissao/Receb.</th><th>Bom para</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c => `<tr>
        <td>${c.tipo === 'Recebido' ? '<span class="badge badge-green">Recebido</span>' : '<span class="badge badge-red">Emitido</span>'}</td>
        <td style="font-size:12px;color:var(--text-2)">${c.numero || '—'}</td>
        <td style="font-size:12px">${c.banco || '—'}</td>
        <td><strong>${c.titular_destinatario || '—'}</strong></td>
        <td style="font-weight:600;color:${c.tipo==='Recebido'?'var(--green)':'var(--red)'}">${formatMoeda(c.valor)}</td>
        <td style="font-size:12px;color:var(--text-3)">${formatData(c.data_emissao_recebimento)}</td>
        <td>${formatData(c.data_bom_para)} ${c.status==='Aguardando'?urgencia(c.data_bom_para):''}</td>
        <td>${badgeStatus(c.status || 'Aguardando')}</td>
        <td><div class="td-actions">
          ${c.status === 'Aguardando' ? `
            <button class="btn btn-success btn-sm" onclick="compensarCheque('${c.id}')">Compensar</button>
            <button class="btn btn-danger btn-sm" onclick="devolverCheque('${c.id}')">Devolver</button>` : ''}
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCHBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCH('${c.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormCheque(c) {
  const edit = !!c;
  const v = (id) => c ? (c[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Tipo *</label>
        <select id="ch-tipo">
          <option ${v('tipo') === 'Recebido' || !v('tipo') ? 'selected' : ''}>Recebido</option>
          <option ${v('tipo') === 'Emitido' ? 'selected' : ''}>Emitido</option>
        </select>
      </div>
      <div class="input-group"><label>No do Cheque</label><input id="ch-numero" value="${v('numero')}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Banco</label><input id="ch-banco" value="${v('banco')}" placeholder="Ex: Bradesco, Itau..." /></div>
      <div class="input-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="ch-valor" value="${v('valor')}" /></div>
    </div>
    <div class="input-group"><label>Titular / Destinatario *</label><input id="ch-titular_destinatario" value="${v('titular_destinatario')}" placeholder="Nome de quem emitiu ou para quem foi emitido" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>Data de emissao/recebimento *</label><input type="date" id="ch-data_emissao_recebimento" value="${v('data_emissao_recebimento') || hoje()}" /></div>
      <div class="input-group"><label>Bom para (data compensacao) *</label><input type="date" id="ch-data_bom_para" value="${v('data_bom_para')}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Vinculado a</label>
        <select id="ch-vinculo_tipo">
          <option value="">Nenhum</option>
          <option ${v('vinculo_tipo')==='contas_receber'?'selected':''} value="contas_receber">Conta a Receber</option>
          <option ${v('vinculo_tipo')==='contas_pagar'?'selected':''} value="contas_pagar">Conta a Pagar</option>
        </select>
      </div>
      <div class="input-group"><label>Cliente / Fornecedor</label><input id="ch-cliente_fornecedor_nome" value="${v('cliente_fornecedor_nome')}" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="ch-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCheque('${edit ? c.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Cheque' : 'Novo Cheque', html, 'modal-lg');
}

async function salvarCheque(id) {
  const obj = {
    tipo: document.getElementById('ch-tipo').value,
    numero: document.getElementById('ch-numero').value,
    banco: document.getElementById('ch-banco').value,
    valor: document.getElementById('ch-valor').value,
    titular_destinatario: document.getElementById('ch-titular_destinatario').value,
    data_emissao_recebimento: document.getElementById('ch-data_emissao_recebimento').value,
    data_bom_para: document.getElementById('ch-data_bom_para').value,
    vinculo_tipo: document.getElementById('ch-vinculo_tipo').value,
    cliente_fornecedor_nome: document.getElementById('ch-cliente_fornecedor_nome').value,
    observacoes: document.getElementById('ch-observacoes').value,
    status: 'Aguardando',
  };
  if (!obj.valor || !obj.titular_destinatario || !obj.data_bom_para) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    obj.status = (window.DB.cheques || []).find(c => c.id === id)?.status || 'Aguardando';
    await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, obj);
    mostrarToast('Cheque atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CHEQUES, obj);
    mostrarToast('Cheque cadastrado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas();
  aplicarFiltrosCH();
}

async function compensarCheque(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const dataComp = hoje();
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, status: 'Compensado' });
  // Lanca no fluxo de caixa
  await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
    id: gerarId(), data: dataComp,
    descricao: 'Cheque compensado — ' + c.titular_destinatario,
    categoria: 'Cheque', tipo: c.tipo === 'Recebido' ? 'Entrada' : 'Saida',
    valor: c.valor, forma_pagamento: 'Cheque', conta: 'Banco',
    vinculo_tipo: 'cheques', vinculo_id: id, criado_em: hoje(),
  });
  mostrarToast('Cheque compensado — lancado no fluxo de caixa', 'success');
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas();
  aplicarFiltrosCH();
}

function devolverCheque(id) {
  const html = `
    <p style="color:var(--text-2);margin-bottom:16px;">Informe o motivo da devolucao:</p>
    <div class="input-group"><label>Motivo</label>
      <select id="ch-motivo">
        <option>Sem fundos</option>
        <option>Assinatura divergente</option>
        <option>Cheque prescrito</option>
        <option>Sustacao pelo emitente</option>
        <option>Outro</option>
      </select>
    </div>
    <div class="input-group" style="margin-top:12px;"><label>Observacoes</label><textarea id="ch-motivo-obs" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarDevolucao('${id}')">Confirmar devolucao</button>
    </div>`;
  abrirModal('Devolver Cheque', html, 'modal-sm');
}

async function confirmarDevolucao(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const motivo = document.getElementById('ch-motivo').value;
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, status: 'Devolvido', motivo_devolucao: motivo });
  // Se era a receber, volta para contas a receber
  if (c.tipo === 'Recebido' && c.vinculo_id) {
    const cr = (window.DB.contas_receber || []).find(x => x.id === c.vinculo_id);
    if (cr) await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, cr.id, { ...cr, status: 'Pendente' });
  }
  mostrarToast('Cheque marcado como devolvido', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas();
  aplicarFiltrosCH();
}

function editarCHBtn(btn) { abrirFormCheque(JSON.parse(btn.dataset.c.replace(/&quot;/g, '"'))); }

function excluirCH(id) {
  confirmar('Excluir este cheque?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CHEQUES, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CHEQUES]);
    renderCHMetricas();
    aplicarFiltrosCH();
  });
}
