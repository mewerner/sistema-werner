// CONTROLE DE CHEQUES — v2
// Ações: Emitido → Lançar CP / Estornar
//        Recebido → Lançar CR / Compensar / Repassar / Devolver / Estornar

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
      <button class="filter-btn" onclick="filtrarCH('Recebido',this)">Recebidos</button>
      <button class="filter-btn" onclick="filtrarCH('Emitido',this)">Emitidos</button>
      <button class="filter-btn" onclick="filtrarCH('Aguardando',this)">Aguardando</button>
      <button class="filter-btn" onclick="filtrarCH('Compensado',this)">Compensado</button>
      <button class="filter-btn" onclick="filtrarCH('Repassado',this)">Repassado</button>
      <button class="filter-btn" onclick="filtrarCH('Devolvido',this)">Devolvido</button>
      <button class="filter-btn" onclick="filtrarCH('Lançado',this)">Lançado</button>
      <button class="filter-btn" onclick="filtrarCH('Inutilizado',this)">Inutilizado</button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar cheque..." oninput="buscarCH(this.value)" />
        <span id="ch-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="ch-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.CHEQUES, CONFIG.SHEETS.CONTAS_RECEBER, CONFIG.SHEETS.CONTAS_PAGAR]);
    renderCHMetricas();
    aplicarFiltrosCH();
  });
}

function renderCHMetricas() {
  const lista = window.DB.cheques || [];
  const aReceber  = lista.filter(c => c.tipo === 'Recebido'  && ['Aguardando','Lançado'].includes(c.status));
  const emitidos  = lista.filter(c => c.tipo === 'Emitido'   && ['Aguardando','Lançado'].includes(c.status));
  const devolvidos = lista.filter(c => c.status === 'Devolvido');
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  const venceHoje = lista.filter(c => {
    if (c.status !== 'Aguardando') return false;
    const d = new Date(c.data_bom_para + 'T00:00:00');
    return d.getTime() === hoje_d.getTime();
  });
  document.getElementById('ch-metricas').innerHTML = `
    <div class="metric-card green"><div class="metric-label">A Compensar</div><div class="metric-value green">${formatMoeda(somarCampo(aReceber,'valor'))}</div><div class="metric-sub">${aReceber.length} cheques recebidos</div></div>
    <div class="metric-card red"><div class="metric-label">A Debitar</div><div class="metric-value red">${formatMoeda(somarCampo(emitidos,'valor'))}</div><div class="metric-sub">${emitidos.length} cheques emitidos</div></div>
    <div class="metric-card yellow"><div class="metric-label">Bom para hoje</div><div class="metric-value yellow">${venceHoje.length}</div><div class="metric-sub">${formatMoeda(somarCampo(venceHoje,'valor'))}</div></div>
    <div class="metric-card red"><div class="metric-label">Devolvidos</div><div class="metric-value red">${devolvidos.length}</div><div class="metric-sub">${formatMoeda(somarCampo(devolvidos,'valor'))}</div></div>`;
}

window._chFiltro = 'todos';
window._chBusca  = '';

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
  else if (['Aguardando','Compensado','Devolvido','Repassado','Estornado','Inutilizado','Lançado'].includes(window._chFiltro))
    lista = lista.filter(c => c.status === window._chFiltro);
  if (window._chBusca) lista = lista.filter(c =>
    (c.titular_destinatario + c.numero + c.banco).toLowerCase().includes(window._chBusca));
  lista = lista.sort((a, b) => new Date(a.data_bom_para) - new Date(b.data_bom_para));
  renderTabelaCH(lista);
}

function renderTabelaCH(lista) {
  document.getElementById('ch-count').textContent = lista.length + ' registros';
  if (!lista.length) { document.getElementById('ch-table').innerHTML = estadoVazio('Nenhum cheque cadastrado'); return; }
  document.getElementById('ch-table').innerHTML = `
    <table><thead><tr>
      <th>Tipo</th><th>No</th><th>Banco</th><th>Titular/Dest.</th><th>Valor</th><th>Emissao</th><th>Bom para</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c => {
        const isRecebido = c.tipo === 'Recebido';
        const isAguardando = c.status === 'Aguardando';
        const isEmitido = c.tipo === 'Emitido';
        return `<tr>
          <td>${isRecebido ? '<span class="badge badge-green">Recebido</span>' : '<span class="badge badge-red">Emitido</span>'}</td>
          <td style="font-size:12px;color:var(--text-2)">${c.numero || '—'}</td>
          <td style="font-size:12px">${c.banco || '—'}</td>
          <td><strong>${c.titular_destinatario || '—'}</strong></td>
          <td style="font-weight:600;color:${isRecebido?'var(--green)':'var(--red)'}">${formatMoeda(c.valor)}</td>
          <td style="font-size:12px;color:var(--text-3)">${formatData(c.data_emissao_recebimento)}</td>
          <td>${formatData(c.data_bom_para)} ${isAguardando ? urgencia(c.data_bom_para) : ''}</td>
          <td>${badgeStatus(c.status || 'Aguardando')}</td>
          <td><div class="td-actions">
            ${isRecebido && isAguardando ? `
              <button class="btn btn-secondary btn-sm" onclick="lancarCRCheque('${c.id}')">Lançar CR</button>
              <button class="btn btn-success btn-sm" onclick="compensarCheque('${c.id}')">Compensar</button>
              <button class="btn btn-danger btn-sm" onclick="devolverCheque('${c.id}')">Devolver</button>` : ''}
            ${isRecebido && c.status === 'Lançado' ? `
              <button class="btn btn-success btn-sm" onclick="compensarCheque('${c.id}')">Compensar</button>
              <button class="btn btn-danger btn-sm" onclick="devolverCheque('${c.id}')">Devolver</button>` : ''}
            ${isEmitido && isAguardando ? `
              <button class="btn btn-secondary btn-sm" onclick="lancarCPCheque('${c.id}')">Lançar CP</button>
              <button class="btn btn-danger btn-sm" onclick="inutilizarCheque('${c.id}')">Inutilizar</button>` : ''}
            ${c.status === 'Compensado' ? `
              <button class="btn btn-danger btn-sm" onclick="estornarChequeCompensado('${c.id}')">Estornar</button>` : ''}
            <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCHBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCH('${c.id}')">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
}

// ─── FORMULÁRIO ───────────────────────────────────────────────────────────
function abrirFormCheque(c) {
  const edit = !!c;
  const v = (id) => c ? (c[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Tipo *</label>
        <select id="ch-tipo">
          <option ${v('tipo')==='Recebido'||!v('tipo')?'selected':''}>Recebido</option>
          <option ${v('tipo')==='Emitido'?'selected':''}>Emitido</option>
        </select>
      </div>
      <div class="input-group"><label>No do Cheque</label><input id="ch-numero" value="${v('numero')}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Banco</label><input id="ch-banco" value="${v('banco')}" placeholder="Ex: Bradesco, Itau..." /></div>
      <div class="input-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="ch-valor" value="${v('valor')}" /></div>
    </div>
    <div class="input-group"><label>Titular / Destinatario</label><input id="ch-titular_destinatario" value="${v('titular_destinatario')}" placeholder="Nome de quem emitiu ou para quem foi emitido" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>Data de emissao/recebimento *</label><input type="date" id="ch-data_emissao_recebimento" value="${v('data_emissao_recebimento') || hoje()}" /></div>
      <div class="input-group"><label>Bom para (data compensacao) *</label><input type="date" id="ch-data_bom_para" value="${v('data_bom_para')}" /></div>
    </div>
    <div class="input-group"><label>Cliente / Fornecedor</label><input id="ch-cliente_fornecedor_nome" value="${v('cliente_fornecedor_nome')}" /></div>
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
    cliente_fornecedor_nome: document.getElementById('ch-cliente_fornecedor_nome').value,
    observacoes: document.getElementById('ch-observacoes').value,
  };
  if (!obj.valor || !obj.data_bom_para) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    obj.status = (window.DB.cheques || []).find(c => c.id === id)?.status || 'Aguardando';
    await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, obj);
    mostrarToast('Cheque atualizado', 'success');
  } else {
    obj.id = gerarId(); obj.status = 'Aguardando'; obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CHEQUES, obj);
    mostrarToast('Cheque cadastrado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas();
  aplicarFiltrosCH();
}

// ─── LANÇAR CR (cheque recebido vincula a CR) ─────────────────────────────
function lancarCRCheque(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const crs = (window.DB.contas_receber || []).filter(x => x.status === 'Pendente' || x.status === 'Atrasado');
  const html = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Cheque de <strong>${formatMoeda(c.valor)}</strong> — ${c.titular_destinatario || 'Sem titular'}
    </div>
    <div class="input-group"><label>Vincular a conta a receber (opcional)</label>
      <select id="ch-cr-id">
        <option value="">Nenhuma — apenas registrar</option>
        ${crs.map(cr => `<option value="${cr.id}">${cr.cliente_nome} — ${cr.descricao} — ${formatMoeda(cr.valor_parcela||cr.valor_total)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarLancarCR('${id}')">Confirmar</button>
    </div>`;
  abrirModal('Lançar no Contas a Receber', html);
}

async function confirmarLancarCR(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const crId = document.getElementById('ch-cr-id')?.value || '';
  mostrarToast('Salvando...', '');
  let vinculoId = crId;

  if (crId) {
    // Vincular a CR existente
    const cr = (window.DB.contas_receber || []).find(x => x.id === crId);
    if (cr) await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, crId, { ...cr, status: 'A Compensar', forma_recebimento: 'Cheque' });
  } else {
    // Criar novo CR automaticamente
    const novoCrId = gerarId();
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_RECEBER, {
      id: novoCrId,
      cliente_id: '',
      cliente_nome: c.titular_destinatario || 'Nao informado',
      descricao: 'Cheque recebido — No ' + (c.numero || 'S/N') + (c.banco ? ' — ' + c.banco : ''),
      valor_total: c.valor,
      valor_parcela: c.valor,
      numero_parcelas: 1,
      parcela_atual: 1,
      data_emissao: c.data_emissao_recebimento || hoje(),
      data_vencimento: c.data_bom_para || hoje(),
      forma_recebimento: 'Cheque',
      categoria: 'Projeto',
      conta: '',
      status: 'A Compensar',
      observacoes: c.observacoes || '',
      criado_em: hoje(),
    });
    vinculoId = novoCrId;
  }

  // Atualizar cheque com status Lancado
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, vinculo_tipo: 'contas_receber', vinculo_id: vinculoId, status: 'Lançado' });
  mostrarToast('Cheque lançado no Contas a Receber', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES, CONFIG.SHEETS.CONTAS_RECEBER]);
  renderCHMetricas(); aplicarFiltrosCH();
}

// ─── LANÇAR CP (cheque emitido vincula a CP) ──────────────────────────────
function lancarCPCheque(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const cps = (window.DB.contas_pagar || []).filter(x => x.status === 'Pendente' || x.status === 'Atrasado');
  const html = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Cheque emitido de <strong>${formatMoeda(c.valor)}</strong> para ${c.titular_destinatario || '—'}
    </div>
    <div class="input-group"><label>Vincular a conta a pagar (opcional)</label>
      <select id="ch-cp-id">
        <option value="">Nenhuma — apenas registrar</option>
        ${cps.map(cp => `<option value="${cp.id}">${cp.fornecedor_nome||cp.descricao} — ${formatMoeda(cp.valor_parcela||cp.valor_total)}</option>`).join('')}
      </select>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarLancarCP('${id}')">Confirmar</button>
    </div>`;
  abrirModal('Lançar no Contas a Pagar', html);
}

async function confirmarLancarCP(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const cpId = document.getElementById('ch-cp-id')?.value || '';
  mostrarToast('Salvando...', '');
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, vinculo_tipo: 'contas_pagar', vinculo_id: cpId });
  if (cpId) {
    const cp = (window.DB.contas_pagar || []).find(x => x.id === cpId);
    if (cp) await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, cpId, { ...cp, status: 'Pago', forma_pagamento: 'Cheque', data_pagamento: c.data_bom_para });
  }
  mostrarToast('Cheque vinculado ao CP', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES, CONFIG.SHEETS.CONTAS_PAGAR]);
  renderCHMetricas(); aplicarFiltrosCH();
}

// ─── COMPENSAR ────────────────────────────────────────────────────────────
function compensarCheque(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  confirmar(`Compensar cheque de ${formatMoeda(c.valor)} — ${c.titular_destinatario || c.numero || ''}?`, async () => {
    try {
      mostrarToast('Compensando...', '');
      await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, status: 'Compensado' });
      await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
        id: gerarId(), data: hoje(),
        descricao: 'Cheque compensado — ' + (c.titular_destinatario || c.numero),
        categoria: 'Cheque Recebido', tipo: 'Entrada',
        valor: c.valor, forma_pagamento: 'Cheque',
        conta: 'Banco ViaCredi', vinculo_tipo: 'cheques', vinculo_id: id, criado_em: hoje(),
      });
      if (c.vinculo_id) {
        const cr = (window.DB.contas_receber || []).find(x => x.id === c.vinculo_id);
        if (cr) await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, cr.id, { ...cr, status: 'Recebido' });
      }
      mostrarToast('Cheque compensado — lançado no fluxo', 'success');
      await carregarDados([CONFIG.SHEETS.CHEQUES]);
      renderCHMetricas(); aplicarFiltrosCH();
    } catch(e) {
      console.error('Erro ao compensar cheque:', e);
      mostrarToast('Erro ao compensar cheque: ' + (e.message || e), 'error');
    }
  });
}

// ─── REPASSAR ─────────────────────────────────────────────────────────────
function repassarCheque(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const cps = (window.DB.contas_pagar || []).filter(x => x.status === 'Pendente' || x.status === 'Atrasado');
  const html = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Cheque de <strong>${formatMoeda(c.valor)}</strong> — ${c.titular_destinatario || 'Sem titular'}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="input-group"><label>Repassado para *</label>
        <input id="ch-rep-dest" placeholder="Nome do destinatario" />
      </div>
      <div class="input-group"><label>Valor usado (R$) *</label>
        <input type="number" step="0.01" id="ch-rep-valor" value="${parseFloat(c.valor).toFixed(2)}"
          oninput="calcDiferencaRepasse(${parseFloat(c.valor).toFixed(2)})" />
      </div>
    </div>
    <div class="input-group"><label>Vincular a conta a pagar (opcional)</label>
      <select id="ch-rep-cp">
        <option value="">Nenhuma</option>
        ${cps.map(cp => `<option value="${cp.id}">${cp.fornecedor_nome||cp.descricao} — ${formatMoeda(cp.valor_parcela||cp.valor_total)}</option>`).join('')}
      </select>
    </div>
    <div id="ch-rep-diferenca" style="margin-top:8px;font-size:13px;"></div>
    <div class="input-group" style="margin-top:8px;"><label>Observacoes</label>
      <input id="ch-rep-obs" placeholder="Ex: Pagamento de material" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarRepasse('${id}','${parseFloat(c.valor).toFixed(2)}')">Confirmar repasse</button>
    </div>`;
  abrirModal('Repassar Cheque', html);
  calcDiferencaRepasse(parseFloat(c.valor));
}

function calcDiferencaRepasse(valorCheque) {
  const valorUsado = parseFloat(document.getElementById('ch-rep-valor')?.value) || 0;
  const diff = valorCheque - valorUsado;
  const el = document.getElementById('ch-rep-diferenca');
  if (!el) return;
  if (Math.abs(diff) < 0.01) { el.innerHTML = ''; return; }
  if (diff > 0) {
    el.innerHTML = `<div style="padding:8px 12px;background:var(--green-bg);border-radius:var(--radius);color:var(--green);">Troco a receber: <strong>${formatMoeda(diff)}</strong> — sera registrado no Contas a Receber</div>`;
  } else {
    el.innerHTML = `<div style="padding:8px 12px;background:var(--red-bg);border-radius:var(--radius);color:var(--red);">Diferenca a pagar: <strong>${formatMoeda(Math.abs(diff))}</strong> — sera registrado no Contas a Pagar</div>`;
  }
}

async function confirmarRepasse(id, valorChequeStr) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const dest     = document.getElementById('ch-rep-dest')?.value?.trim();
  const valorUsado = parseFloat(document.getElementById('ch-rep-valor')?.value) || 0;
  const cpId     = document.getElementById('ch-rep-cp')?.value || '';
  const obs      = document.getElementById('ch-rep-obs')?.value || '';
  const valorCheque = parseFloat(valorChequeStr);
  if (!dest) { mostrarToast('Informe o destinatário', 'error'); return; }
  mostrarToast('Registrando repasse...', '');

  // Atualizar cheque
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, {
    ...c, status: 'Repassado',
    repassado_para: dest, valor_repassado: valorUsado.toFixed(2),
    data_repasse: hoje(), obs_repasse: obs,
  });

  // Lançar no Fluxo de Caixa como saída
  await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
    id: gerarId(), data: hoje(),
    descricao: 'Cheque repassado para ' + dest,
    categoria: 'Cheque Emitido', tipo: 'Saída',
    valor: valorUsado.toFixed(2), forma_pagamento: 'Cheque',
    conta: 'Banco ViaCredi', observacoes: obs, criado_em: hoje(),
  });

  // Quitar conta no CP se vinculada
  if (cpId) {
    const cp = (window.DB.contas_pagar || []).find(x => x.id === cpId);
    if (cp) {
      const valorCP = parseFloat(cp.valor_parcela || cp.valor_total || 0);
      const novoStatus = valorUsado >= valorCP ? 'Pago' : 'Parcialmente pago';
      await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, cpId, {
        ...cp, status: novoStatus, forma_pagamento: 'Cheque', data_pagamento: hoje(),
      });
    }
  }

  // Diferença
  const diff = valorCheque - valorUsado;
  if (diff > 0.01) {
    // Troco a receber — lança no CR
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_RECEBER, {
      id: gerarId(), cliente_id: '', cliente_nome: dest,
      descricao: 'Troco cheque repassado — ' + (c.numero || ''),
      valor_total: diff.toFixed(2), valor_parcela: diff.toFixed(2),
      numero_parcelas: 1, parcela_atual: 1,
      data_emissao: hoje(), data_vencimento: hoje(),
      forma_recebimento: 'Dinheiro', status: 'Pendente',
      observacoes: 'Troco de repasse de cheque', criado_em: hoje(),
    });
    mostrarToast('Repasse registrado — troco de ' + formatMoeda(diff) + ' lançado no CR', 'success');
  } else if (diff < -0.01) {
    // Diferença a pagar — lança no CP
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
      id: gerarId(), fornecedor_id: '', fornecedor_nome: dest,
      descricao: 'Diferenca cheque repassado — ' + (c.numero || ''),
      valor_total: Math.abs(diff).toFixed(2), valor_parcela: Math.abs(diff).toFixed(2),
      data_vencimento: hoje(), data_emissao: hoje(),
      categoria: 'Outros', forma_pagamento: 'A definir', status: 'Pendente',
      observacoes: 'Diferenca de repasse de cheque', criado_em: hoje(),
    });
    mostrarToast('Repasse registrado — diferença de ' + formatMoeda(Math.abs(diff)) + ' lançada no CP', 'success');
  } else {
    mostrarToast('Cheque repassado com sucesso', 'success');
  }

  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas(); aplicarFiltrosCH();
}

// ─── DEVOLVER ─────────────────────────────────────────────────────────────
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
    <div class="input-group" style="margin-top:12px;"><label>Observacoes</label>
      <textarea id="ch-motivo-obs" rows="2"></textarea>
    </div>
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
  const obs    = document.getElementById('ch-motivo-obs').value;
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, status: 'Devolvido', motivo_devolucao: motivo, observacoes: obs });
  // Reverte CR vinculado para Pendente
  if (c.vinculo_id && c.vinculo_tipo === 'contas_receber') {
    const cr = (window.DB.contas_receber || []).find(x => x.id === c.vinculo_id);
    if (cr) await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, cr.id, { ...cr, status: 'Pendente' });
  }
  mostrarToast('Cheque marcado como devolvido', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas(); aplicarFiltrosCH();
}

// ─── INUTILIZAR ───────────────────────────────────────────────────────────
function inutilizarCheque(id) {
  const html = `
    <p style="color:var(--text-2);margin-bottom:16px;">Informe o motivo da inutilizacao:</p>
    <div class="input-group"><label>Motivo</label>
      <select id="ch-inut-motivo">
        <option>Cheque cancelado</option>
        <option>Cheque extraviado</option>
        <option>Erro de preenchimento</option>
        <option>Outro</option>
      </select>
    </div>
    <div class="input-group" style="margin-top:12px;"><label>Observacoes</label>
      <textarea id="ch-inut-obs" rows="2"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarInutilizacao('${id}')">Confirmar inutilizacao</button>
    </div>`;
  abrirModal('Inutilizar Cheque', html, 'modal-sm');
}

async function confirmarInutilizacao(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const motivo = document.getElementById('ch-inut-motivo').value;
  const obs    = document.getElementById('ch-inut-obs').value;
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, {
    ...c, status: 'Inutilizado', motivo_inutilizacao: motivo, observacoes: obs
  });
  mostrarToast('Cheque inutilizado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  renderCHMetricas(); aplicarFiltrosCH();
}

// ─── ESTORNAR COMPENSADO ──────────────────────────────────────────────────
function estornarChequeCompensado(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) return;
  const html = `
    <p style="color:var(--text-2);margin-bottom:16px;">
      Estornar a compensação do cheque de <strong>${formatMoeda(c.valor)}</strong> — ${c.titular_destinatario || c.numero || 'Sem titular'}?
    </p>
    <p style="font-size:12px;color:var(--text-3);">O lançamento no fluxo de caixa será revertido e o cheque voltará para <strong>Aguardando</strong>.</p>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarEstornoCheque('${id}')">Confirmar estorno</button>
    </div>`;
  abrirModal('Estornar Cheque Compensado', html, 'modal-sm');
}

async function confirmarEstornoCheque(id) {
  const c = (window.DB.cheques || []).find(x => x.id === id);
  if (!c) { mostrarToast('Cheque não encontrado', 'error'); return; }
  try {
    mostrarToast('Estornando...', '');

    await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
      id: gerarId(), data: hoje(),
      descricao: 'ESTORNO — Cheque compensado — ' + (c.titular_destinatario || c.numero || ''),
      categoria: 'Cheque Recebido', tipo: 'Saída',
      valor: c.valor, forma_pagamento: 'Cheque',
      conta: 'Banco ViaCredi', vinculo_tipo: 'estorno_cheque', vinculo_id: id, criado_em: hoje(),
    });

    await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, id, { ...c, status: 'Aguardando' });

    if (c.vinculo_id && c.vinculo_tipo === 'contas_receber') {
      await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
      const cr = (window.DB.contas_receber || []).find(x => x.id === c.vinculo_id);
      if (cr) await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, cr.id, { ...cr, status: 'A Compensar' });
    }

    mostrarToast('Cheque estornado — voltou para Aguardando', 'success');
    fecharModal();
    await carregarDados([CONFIG.SHEETS.CHEQUES, CONFIG.SHEETS.CONTAS_RECEBER]);
    renderCHMetricas(); aplicarFiltrosCH();
  } catch(e) {
    console.error('Erro ao estornar cheque:', e);
    mostrarToast('Erro ao estornar: ' + (e.message || JSON.stringify(e)), 'error');
  }
}

// ─── EDITAR / EXCLUIR ─────────────────────────────────────────────────────
function editarCHBtn(btn) { abrirFormCheque(JSON.parse(btn.dataset.c.replace(/&quot;/g, '"'))); }

function excluirCH(id) {
  confirmar('Excluir este cheque?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CHEQUES, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CHEQUES]);
    renderCHMetricas(); aplicarFiltrosCH();
  });
}
