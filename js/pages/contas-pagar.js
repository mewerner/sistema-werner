// CONTAS A PAGAR
function renderContasPagar() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Contas a Pagar</h1><p class="page-subtitle">Controle de pagamentos em aberto</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormContaPagar()">+ Nova Conta</button>
      </div>
    </div>
    <div id="cp-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarCP('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarCP('Pendente',this)">Pendente</button>
      <button class="filter-btn" onclick="filtrarCP('Atrasado',this)">Atrasado</button>
      <button class="filter-btn" onclick="filtrarCP('Parcialmente pago',this)">Parcial</button>
      <button class="filter-btn" onclick="filtrarCP('Pago',this)">Pago</button>
      <select id="cp-categoria" onchange="aplicarFiltrosCP()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todas as categorias</option>
        ${['Materiais','Custos fixos','Servico','Combustivel','Pessoal','Impostos','Outros'].map(c => `<option>${c}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar..." oninput="buscarCP(this.value)" />
        <span id="cp-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="cp-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR, CONFIG.SHEETS.FORNECEDORES]);
    atualizarStatusCP();
    renderCPMetricas();
    aplicarFiltrosCP();
  });
}

function atualizarStatusCP() {
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  (window.DB.contas_pagar || []).forEach(c => {
    if (c.status === 'Pago') return;
    const venc = new Date(c.data_vencimento + 'T00:00:00');
    if (venc < hoje_d && c.status !== 'Parcialmente pago') c.status = 'Atrasado';
  });
}

function renderCPMetricas() {
  const lista = window.DB.contas_pagar || [];
  const emAberto = lista.filter(c => c.status !== 'Pago');
  const atrasado = lista.filter(c => c.status === 'Atrasado');
  const totalAberto = somarCampo(emAberto, 'valor_parcela');
  const totalAtrasado = somarCampo(atrasado, 'valor_parcela');
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  const em7 = new Date(); em7.setDate(em7.getDate() + 7);
  const vencendo = emAberto.filter(c => {
    const d = new Date(c.data_vencimento + 'T00:00:00');
    return d >= hoje_d && d <= em7;
  });
  document.getElementById('cp-metricas').innerHTML = `
    <div class="metric-card red"><div class="metric-label">Total em aberto</div><div class="metric-value red">${formatMoeda(totalAberto)}</div><div class="metric-sub">${emAberto.length} parcelas</div></div>
    <div class="metric-card red"><div class="metric-label">Atrasado</div><div class="metric-value red">${formatMoeda(totalAtrasado)}</div><div class="metric-sub">${atrasado.length} parcelas</div></div>
    <div class="metric-card yellow"><div class="metric-label">Vence em 7 dias</div><div class="metric-value yellow">${formatMoeda(somarCampo(vencendo,'valor_parcela'))}</div><div class="metric-sub">${vencendo.length} parcelas</div></div>
    <div class="metric-card"><div class="metric-label">Total de registros</div><div class="metric-value">${lista.length}</div></div>`;
}

window._cpFiltro = 'todos';
window._cpBusca = '';

function filtrarCP(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._cpFiltro = tipo;
  aplicarFiltrosCP();
}

function buscarCP(q) { window._cpBusca = q.toLowerCase(); aplicarFiltrosCP(); }

function aplicarFiltrosCP() {
  let lista = window.DB.contas_pagar || [];
  const cat = document.getElementById('cp-categoria')?.value || '';
  if (window._cpFiltro !== 'todos') lista = lista.filter(c => c.status === window._cpFiltro);
  if (cat) lista = lista.filter(c => c.categoria === cat);
  if (window._cpBusca) lista = lista.filter(c => (c.fornecedor_nome + c.descricao + c.numero_nf).toLowerCase().includes(window._cpBusca));
  lista = lista.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  renderTabelaCP(lista);
}

function renderTabelaCP(lista) {
  document.getElementById('cp-count').textContent = lista.length + ' registros';
  if (!lista.length) { document.getElementById('cp-table').innerHTML = estadoVazio('Nenhuma conta encontrada'); return; }
  document.getElementById('cp-table').innerHTML = `
    <table><thead><tr>
      <th>Fornecedor/Desc</th><th>NF</th><th>Categoria</th><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Forma</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c => `<tr>
        <td><strong>${c.fornecedor_nome || c.descricao || '—'}</strong>${c.fornecedor_nome && c.descricao ? `<br><span style="font-size:11px;color:var(--text-3)">${c.descricao}</span>` : ''}</td>
        <td style="font-size:12px;color:var(--text-2)">${c.numero_nf || '—'}</td>
        <td><span class="badge badge-gray">${c.categoria || '—'}</span></td>
        <td style="font-size:12px;color:var(--text-3)">${c.parcela_num && c.parcela_total ? c.parcela_num+'/'+c.parcela_total : '—'}</td>
        <td style="font-weight:600;color:var(--red)">${formatMoeda(c.valor_parcela)}</td>
        <td>${formatData(c.data_vencimento)} ${urgencia(c.data_vencimento)}</td>
        <td style="font-size:12px">${c.forma_pagamento || '—'}</td>
        <td>${badgeStatus(c.status || 'Pendente')}</td>
        <td><div class="td-actions">
          ${c.status !== 'Pago' ? `<button class="btn btn-primary btn-sm" onclick="abrirPagarConta('${c.id}')">Pagar</button>` : `<button class="btn btn-secondary btn-sm" onclick="estornarPagamento('${c.id}')">Estornar</button>`}
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCPBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCP('${c.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormContaPagar(c) {
  const edit = !!c;
  const fornecedores = window.DB.fornecedores || [];
  const v = (id) => c ? (c[id] || '') : '';
  const cats = ['Materiais','Custos fixos','Servico','Combustivel','Pessoal','Impostos','Outros'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Fornecedor</label>
        <select id="cp-fornecedor_id" onchange="preencherNomeFornecedor()">
          <option value="">Selecione ou deixe em branco</option>
          ${fornecedores.map(f => `<option value="${f.id}" data-nome="${f.razao_social}" ${v('fornecedor_id') === f.id ? 'selected' : ''}>${f.razao_social}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Numero da NF</label><input id="cp-numero_nf" value="${v('numero_nf')}" placeholder="Opcional" /></div>
    </div>
    <div class="input-group"><label>Descricao *</label><input id="cp-descricao" value="${v('descricao')}" placeholder="Ex: Compra de MDF" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>Categoria</label>
        <select id="cp-categoria-sel">${cats.map(x => `<option ${v('categoria') === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Forma de pagamento</label>
        <select id="cp-forma_pagamento">
          ${['PIX','Dinheiro','Cheque','Boleto','Financiamento','Cartao'].map(x => `<option ${v('forma_pagamento') === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
    </div>
    <hr class="divider"/>
    <div class="form-row cols-3">
      <div class="input-group"><label>Valor total (R$)</label><input type="number" step="0.01" id="cp-valor_total" value="${v('valor_total')}" oninput="calcParcelaCP()" /></div>
      <div class="input-group"><label>Numero de parcelas</label><input type="number" id="cp-parcela_total" value="${v('parcela_total') || '1'}" min="1" oninput="calcParcelaCP()" /></div>
      <div class="input-group"><label>Parcela atual</label><input type="number" id="cp-parcela_num" value="${v('parcela_num') || '1'}" min="1" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor desta parcela (R$)</label><input type="number" step="0.01" id="cp-valor_parcela" value="${v('valor_parcela')}" /></div>
      <div class="input-group"><label>Data de emissao</label><input type="date" id="cp-data_emissao" value="${v('data_emissao') || hoje()}" /></div>
    </div>
    <div class="input-group"><label>Data de vencimento *</label><input type="date" id="cp-data_vencimento" value="${v('data_vencimento')}" /></div>
    <div class="input-group" style="margin-top:16px;"><label>Observacoes</label><textarea id="cp-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCP('${edit ? c.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar', html, 'modal-lg');
}

function preencherNomeFornecedor() {}

function calcParcelaCP() {
  const total = parseFloat(document.getElementById('cp-valor_total')?.value) || 0;
  const parcelas = parseInt(document.getElementById('cp-parcela_total')?.value) || 1;
  if (total && parcelas) document.getElementById('cp-valor_parcela').value = (total / parcelas).toFixed(2);
}

async function salvarCP(id) {
  const sel = document.getElementById('cp-fornecedor_id');
  const opt = sel.options[sel.selectedIndex];
  const obj = {
    fornecedor_id: sel.value,
    fornecedor_nome: sel.value ? (opt.dataset.nome || '') : '',
    numero_nf: document.getElementById('cp-numero_nf').value,
    descricao: document.getElementById('cp-descricao').value,
    categoria: document.getElementById('cp-categoria-sel').value,
    forma_pagamento: document.getElementById('cp-forma_pagamento').value,
    valor_total: document.getElementById('cp-valor_total').value,
    parcela_num: document.getElementById('cp-parcela_num').value,
    parcela_total: document.getElementById('cp-parcela_total').value,
    valor_parcela: document.getElementById('cp-valor_parcela').value,
    data_emissao: document.getElementById('cp-data_emissao').value,
    data_vencimento: document.getElementById('cp-data_vencimento').value,
    observacoes: document.getElementById('cp-observacoes').value,
    status: 'Pendente',
  };
  if (!obj.descricao || !obj.valor_parcela || !obj.data_vencimento) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    obj.status = (window.DB.contas_pagar || []).find(c => c.id === id)?.status || 'Pendente';
    await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, id, obj);
    mostrarToast('Atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, obj);
    mostrarToast('Conta cadastrada', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR]);
  atualizarStatusCP();
  renderCPMetricas();
  aplicarFiltrosCP();
}

function abrirPagarConta(id) {
  const c = (window.DB.contas_pagar || []).find(x => x.id === id);
  if (!c) return;
  const html = `
    <p style="color:var(--text-2);margin-bottom:20px;">Registrar pagamento: <strong>${c.descricao}</strong> — ${formatMoeda(c.valor_parcela)}</p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor pago (R$)</label><input type="number" step="0.01" id="pv-valor" value="${c.valor_parcela}" /></div>
      <div class="input-group"><label>Data do pagamento</label><input type="date" id="pv-data" value="${hoje()}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Forma de pagamento</label>
        <select id="pv-forma">
          ${['PIX','Dinheiro','Cheque','Boleto','Financiamento','Cartao'].map(x => `<option ${c.forma_pagamento === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Conta debitada</label>
        <select id="pv-conta">${getSysConfig('contas').map(c=>`<option>${c}</option>`).join('')}</select>
      </div>
    </div>
    <div id="pv-parcial-wrap" style="margin-top:16px;padding:12px;background:var(--bg-3);border-radius:var(--radius);display:none;">
      <p style="font-size:13px;color:var(--yellow);margin-bottom:12px;">Pagamento parcial. O saldo restante ficara:</p>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="setSaldoCP('aberto')">Mesmo vencimento</button>
        <button class="btn btn-secondary btn-sm" onclick="setSaldoCP('renegociar')">Renegociar</button>
      </div>
      <div id="pv-novo-venc" style="display:none;margin-top:12px;">
        <div class="input-group"><label>Novo vencimento</label><input type="date" id="pv-data_venc_novo" value="${hoje()}" /></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarPagamento('${id}')">Confirmar pagamento</button>
    </div>`;
  abrirModal('Registrar Pagamento', html, 'modal-sm');
  document.getElementById('pv-valor').addEventListener('input', () => {
    const val = parseFloat(document.getElementById('pv-valor').value) || 0;
    const esp = parseFloat(c.valor_parcela) || 0;
    document.getElementById('pv-parcial-wrap').style.display = val < esp ? '' : 'none';
  });
}

window._saldoCP = 'aberto';
function setSaldoCP(tipo) {
  window._saldoCP = tipo;
  document.getElementById('pv-novo-venc').style.display = tipo === 'renegociar' ? '' : 'none';
}

async function confirmarPagamento(id) {
  const c = (window.DB.contas_pagar || []).find(x => x.id === id);
  if (!c) return;
  const valorPago = parseFloat(document.getElementById('pv-valor').value) || 0;
  const dataPag = document.getElementById('pv-data').value;
  const forma = document.getElementById('pv-forma').value;
  const conta = document.getElementById('pv-conta').value;
  const valorEsperado = parseFloat(c.valor_parcela) || 0;
  const parcial = valorPago < valorEsperado;
  mostrarToast('Processando...', '');

  const novoStatus = parcial ? 'Parcialmente pago' : 'Pago';
  await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, id, {
    ...c, status: novoStatus, data_pagamento: dataPag, forma_pagamento: forma
  });

  if (forma !== 'Cheque' && forma !== 'Cartao') {
    await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
      id: gerarId(), data: dataPag,
      descricao: c.descricao + (c.fornecedor_nome ? ' — ' + c.fornecedor_nome : ''),
      categoria: c.categoria || 'Outros', tipo: 'Saida', valor: valorPago,
      forma_pagamento: forma, conta: conta,
      vinculo_tipo: 'contas_pagar', vinculo_id: id, criado_em: hoje(),
    });
  }

  if (parcial) {
    const saldo = valorEsperado - valorPago;
    const novoVenc = window._saldoCP === 'renegociar'
      ? document.getElementById('pv-data_venc_novo')?.value || c.data_vencimento
      : c.data_vencimento;
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
      ...c, id: gerarId(), valor_parcela: saldo.toFixed(2),
      data_vencimento: novoVenc, status: 'Pendente',
      descricao: c.descricao + ' (saldo)', criado_em: hoje(),
    });
  }

  mostrarToast('Pagamento registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR]);
  atualizarStatusCP();
  renderCPMetricas();
  aplicarFiltrosCP();
}

function editarCPBtn(btn) { abrirFormContaPagar(JSON.parse(btn.dataset.c.replace(/&quot;/g, '"'))); }

function estornarPagamento(id) {
  const c = (window.DB.contas_pagar || []).find(x => x.id === id);
  if (!c) return;
  confirmar(`Estornar pagamento de ${formatMoeda(c.valor_parcela)} — ${c.descricao}? Sera criado um lancamento de estorno no Fluxo de Caixa.`, async () => {
    // Cria estorno no fluxo de caixa
    await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
      id: gerarId(),
      data: hoje(),
      descricao: 'ESTORNO — ' + c.descricao + (c.fornecedor_nome ? ' — ' + c.fornecedor_nome : ''),
      categoria: c.categoria || 'Outros',
      tipo: 'Entrada',
      valor: c.valor_parcela,
      forma_pagamento: c.forma_pagamento || '',
      conta: 'Banco',
      vinculo_tipo: 'estorno_cp',
      vinculo_id: id,
      criado_em: hoje(),
    });
    // Volta status para Pendente
    await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, id, {
      ...c,
      status: 'Pendente',
      data_pagamento: '',
    });
    mostrarToast('Pagamento estornado — fluxo de caixa atualizado', 'success');
    await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR]);
    atualizarStatusCP();
    renderCPMetricas();
    aplicarFiltrosCP();
  });
}

function excluirCP(id) {
  confirmar('Excluir esta conta a pagar?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CONTAS_PAGAR, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR]);
    atualizarStatusCP();
    renderCPMetricas();
    aplicarFiltrosCP();
  });
}
