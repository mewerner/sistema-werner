// CONTAS A RECEBER
function renderContasReceber() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Contas a Receber</h1><p class="page-subtitle">Controle de recebimentos em aberto</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormContaReceber()">+ Nova Conta</button>
      </div>
    </div>
    <div id="cr-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarCR('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarCR('Pendente',this)">Pendente</button>
      <button class="filter-btn" onclick="filtrarCR('Atrasado',this)">Atrasado</button>
      <button class="filter-btn" onclick="filtrarCR('Parcialmente recebido',this)">Parcial</button>
      <button class="filter-btn" onclick="filtrarCR('A Compensar',this)">A Compensar</button>
      <button class="filter-btn" onclick="filtrarCR('Recebido',this)">Recebido</button>
      <select id="cr-filtro-mes" onchange="aplicarFiltrosCR()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todos os meses</option>
        ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>`<option value="${i+1}" ${new Date().getMonth()===i?'selected':''}>${m}</option>`).join('')}
      </select>
      <input type="number" id="cr-filtro-ano" value="${new Date().getFullYear()}" min="2020" max="2099" onchange="aplicarFiltrosCR()"
        style="width:75px;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;" />
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar..." oninput="buscarCR(this.value)" />
        <span id="cr-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="cr-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    if (!window._sysConfig && typeof carregarConfiguracoes === 'function') await carregarConfiguracoes();
    await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER, CONFIG.SHEETS.CLIENTES, CONFIG.SHEETS.CHEQUES]);
    await migrarCRChequesPendentes();
    atualizarStatusCR();
    renderCRMetricas();
    aplicarFiltrosCR();
  });
}

function atualizarStatusCR() {
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  (window.DB.contas_receber || []).forEach(c => {
    if (c.status === 'Recebido' || c.status === 'A Compensar') return;
    const venc = new Date(c.data_vencimento + 'T00:00:00');
    if (venc < hoje_d && c.status !== 'Parcialmente recebido') c.status = 'Atrasado';
  });
}

async function migrarCRChequesPendentes() {
  try {
    const crs = window.DB.contas_receber || [];
    const cheques = window.DB.cheques || [];

    const idsParaCorrigir = new Set();

    // Via cheque: cheques Lançados/Aguardando vinculados a um CR
    cheques.forEach(ch => {
      if (ch.vinculo_tipo === 'contas_receber' && ch.vinculo_id && ch.status !== 'Compensado') {
        const cr = crs.find(c => c.id === ch.vinculo_id && c.status === 'Recebido');
        if (cr) idsParaCorrigir.add(cr.id);
      }
    });

    // Via CR: forma_recebimento Cheque + Recebido sem cheque compensado vinculado
    crs.forEach(cr => {
      if (cr.status === 'Recebido' && cr.forma_recebimento === 'Cheque') {
        const chequeCompensado = cheques.find(ch =>
          ch.vinculo_id === cr.id && ch.vinculo_tipo === 'contas_receber' && ch.status === 'Compensado'
        );
        if (!chequeCompensado) idsParaCorrigir.add(cr.id);
      }
    });

    const paraCorrigir = crs.filter(c => idsParaCorrigir.has(c.id));
    for (const cr of paraCorrigir) {
      await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, cr.id, { ...cr, status: 'A Compensar' });
      cr.status = 'A Compensar';
    }
    if (paraCorrigir.length > 0)
      mostrarToast(`${paraCorrigir.length} registro(s) corrigido(s) para "A Compensar"`, 'success');
  } catch(e) {
    console.error('Erro na migração de cheques:', e);
  }
}

function renderCRMetricas() {
  const lista = window.DB.contas_receber || [];
  const emAberto = lista.filter(c => c.status !== 'Recebido');
  const totalAberto = somarCampo(emAberto, 'valor_parcela');
  const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
  const em7 = new Date(); em7.setDate(em7.getDate() + 7);
  const mesAtual = hoje_d.getMonth(); const anoAtual = hoje_d.getFullYear();
  const doMes = emAberto.filter(c => {
    if (!c.data_vencimento) return false;
    const d = new Date(c.data_vencimento + 'T00:00:00');
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });
  const vencendo = emAberto.filter(c => {
    const d = new Date(c.data_vencimento + 'T00:00:00');
    return d >= hoje_d && d <= em7;
  });
  document.getElementById('cr-metricas').innerHTML = `
    <div class="metric-card green"><div class="metric-label">Total em aberto</div><div class="metric-value green">${formatMoeda(totalAberto)}</div><div class="metric-sub">${emAberto.length} parcelas</div></div>
    <div class="metric-card green"><div class="metric-label">Mês atual</div><div class="metric-value green">${formatMoeda(somarCampo(doMes,'valor_parcela'))}</div><div class="metric-sub">${doMes.length} parcelas</div></div>
    <div class="metric-card yellow"><div class="metric-label">Vence em 7 dias</div><div class="metric-value yellow">${formatMoeda(somarCampo(vencendo,'valor_parcela'))}</div><div class="metric-sub">${vencendo.length} parcelas</div></div>
    <div class="metric-card"><div class="metric-label">Total de registros</div><div class="metric-value">${lista.length}</div></div>`;
}

window._crFiltro = 'todos';
window._crBusca = '';

function filtrarCR(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._crFiltro = tipo;
  aplicarFiltrosCR();
}

function buscarCR(q) { window._crBusca = q.toLowerCase(); aplicarFiltrosCR(); }

function aplicarFiltrosCR() {
  let lista = window.DB.contas_receber || [];
  if (window._crFiltro !== 'todos') lista = lista.filter(c => c.status === window._crFiltro);
  if (window._crBusca) lista = lista.filter(c => (c.cliente_nome + c.descricao).toLowerCase().includes(window._crBusca));
  const filtroMes = document.getElementById('cr-filtro-mes')?.value || '';
  const filtroAno = document.getElementById('cr-filtro-ano')?.value || '';
  if (filtroMes) {
    lista = lista.filter(c => {
      if (!c.data_vencimento) return false;
      const d = new Date(c.data_vencimento + 'T00:00:00');
      const mesOk = d.getMonth() + 1 === parseInt(filtroMes);
      const anoOk = !filtroAno || d.getFullYear() === parseInt(filtroAno);
      return mesOk && anoOk;
    });
  }
  lista = lista.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  renderTabelaCR(lista);
}

function renderTabelaCR(lista) {
  document.getElementById('cr-count').textContent = lista.length + ' registros';
  if (!lista.length) { document.getElementById('cr-table').innerHTML = estadoVazio('Nenhuma conta encontrada'); return; }
  document.getElementById('cr-table').innerHTML = `
    <table><thead><tr>
      <th>Cliente</th><th>Descricao</th><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Forma</th><th>Conta</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c => `<tr>
        <td><strong>${c.cliente_nome || '—'}</strong></td>
        <td style="font-size:12px;color:var(--text-2)">${c.descricao || '—'}</td>
        <td style="font-size:12px;color:var(--text-3)">${c.parcela_num && c.parcela_total ? c.parcela_num+'/'+c.parcela_total : '—'}</td>
        <td style="font-weight:600;color:var(--green)">${formatMoeda(c.valor_parcela)}</td>
        <td>${formatData(c.data_vencimento)} ${urgencia(c.data_vencimento)}</td>
        <td style="font-size:12px">${c.forma_recebimento || '—'}</td>
        <td style="font-size:12px">${c.conta ? `<span class="badge badge-blue">${c.conta}</span>` : '—'}</td>
        <td>${badgeStatus(c.status || 'Pendente')}</td>
        <td><div class="td-actions">
          ${c.status === 'A Compensar' ? `
            <button class="btn btn-success btn-sm" onclick="compensarChequeCR('${c.id}')">Compensar</button>
            <button class="btn btn-secondary btn-sm" onclick="repassarChequeCR('${c.id}')">Repassar</button>
            <button class="btn btn-danger btn-sm" onclick="estornarRecebimento('${c.id}')">Estornar</button>` : ''}
          ${c.status === 'Recebido' ? `
            <button class="btn btn-secondary btn-sm" onclick="estornarRecebimento('${c.id}')">Estornar</button>` : ''}
          ${c.status !== 'Recebido' && c.status !== 'A Compensar' ? `
            <button class="btn btn-success btn-sm" onclick="abrirReceberConta('${c.id}')">Receber</button>` : ''}
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCRBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCR('${c.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormContaReceber(c) {
  const edit = !!c;
  const clientes = window.DB.clientes || [];
  const v = (id) => c ? (c[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Cliente *</label>
        <select id="cr-cliente_id" onchange="preencherNomeCliente()">
          <option value="">Selecione...</option>
          ${clientes.map(cl => `<option value="${cl.id}" data-nome="${cl.nome}" ${v('cliente_id') === cl.id ? 'selected' : ''}>${cl.nome}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Descricao *</label><input id="cr-descricao" value="${v('descricao')}" placeholder="Ex: Projeto cozinha - entrada" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Valor total (R$)</label><input type="number" step="0.01" id="cr-valor_total" value="${v('valor_total')}" oninput="calcParcelaCR()" /></div>
      <div class="input-group"><label>Numero de parcelas</label><input type="number" id="cr-parcela_total" value="${v('parcela_total') || '1'}" min="1" oninput="calcParcelaCR()" /></div>
      <div class="input-group"><label>Parcela atual</label><input type="number" id="cr-parcela_num" value="${v('parcela_num') || '1'}" min="1" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor desta parcela (R$)</label><input type="number" step="0.01" id="cr-valor_parcela" value="${v('valor_parcela')}" /></div>
      <div class="input-group"><label>Data de emissao</label><input type="date" id="cr-data_emissao" value="${v('data_emissao') || hoje()}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Data de vencimento *</label><input type="date" id="cr-data_vencimento" value="${v('data_vencimento')}" /></div>
      <div class="input-group"><label>Forma de recebimento</label>
        <select id="cr-forma_recebimento">
          ${(typeof getSysConfig === 'function' ? getSysConfig('formas_pagamento') : ['PIX','Dinheiro','Cheque','Boleto','Financiamento','Cartao']).map(x => `<option ${v('forma_recebimento') === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Categoria</label>
        <select id="cr-categoria">
          ${(typeof getSysConfig === 'function' ? getSysConfig('categorias_fluxo') : ['Projeto','Materiais','Outros']).map(x => `<option ${v('categoria') === x ? 'selected' : x === 'Projeto' && !v('categoria') ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Conta</label>
        <select id="cr-conta">
          ${(typeof getSysConfig === 'function' ? getSysConfig('contas') : ['Viacredi','Caixa']).map(x => `<option ${v('conta') === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="cr-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCR('${edit ? c.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Conta a Receber' : 'Nova Conta a Receber', html, 'modal-lg');
}

function preencherNomeCliente() {
  const sel = document.getElementById('cr-cliente_id');
  const opt = sel.options[sel.selectedIndex];
  const nomeEl = document.getElementById('cr-cliente_nome_display');
  if (nomeEl) nomeEl.textContent = opt?.dataset.nome || '';
}

function calcParcelaCR() {
  const total = parseFloat(document.getElementById('cr-valor_total')?.value) || 0;
  const parcelas = parseInt(document.getElementById('cr-parcela_total')?.value) || 1;
  if (total && parcelas) {
    document.getElementById('cr-valor_parcela').value = (total / parcelas).toFixed(2);
  }
}

async function salvarCR(id) {
  const sel = document.getElementById('cr-cliente_id');
  const opt = sel.options[sel.selectedIndex];
  const obj = {
    cliente_id: sel.value,
    cliente_nome: opt.dataset.nome || '',
    descricao: document.getElementById('cr-descricao').value,
    valor_total: document.getElementById('cr-valor_total').value,
    parcela_num: document.getElementById('cr-parcela_num').value,
    parcela_total: document.getElementById('cr-parcela_total').value,
    valor_parcela: document.getElementById('cr-valor_parcela').value,
    data_emissao: document.getElementById('cr-data_emissao').value,
    data_vencimento: document.getElementById('cr-data_vencimento').value,
    forma_recebimento: document.getElementById('cr-forma_recebimento').value,
    categoria: document.getElementById('cr-categoria').value,
    conta: document.getElementById('cr-conta').value,
    observacoes: document.getElementById('cr-observacoes').value,
    status: 'Pendente',
  };
  if (!obj.cliente_id || !obj.descricao || !obj.valor_parcela || !obj.data_vencimento) {
    mostrarToast('Preencha os campos obrigatorios', 'error'); return;
  }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    obj.status = (window.DB.contas_receber || []).find(c => c.id === id)?.status || 'Pendente';
    await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, id, obj);
    mostrarToast('Atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_RECEBER, obj);
    mostrarToast('Conta cadastrada', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
  atualizarStatusCR();
  renderCRMetricas();
  aplicarFiltrosCR();
}

function abrirReceberConta(id) {
  const c = (window.DB.contas_receber || []).find(x => x.id === id);
  if (!c) return;
  const html = `
    <p style="color:var(--text-2);margin-bottom:20px;">Registrar recebimento para: <strong>${c.cliente_nome}</strong> — ${c.descricao}</p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor recebido (R$)</label><input type="number" step="0.01" id="rv-valor" value="${c.valor_parcela}" /></div>
      <div class="input-group"><label>Data do recebimento</label><input type="date" id="rv-data" value="${hoje()}" /></div>
    </div>
    <div class="form-row cols-2" style="margin-top:12px;">
      <div class="input-group"><label>Forma de recebimento</label>
        <select id="rv-forma">
          ${(typeof getSysConfig === 'function' ? getSysConfig('formas_pagamento') : ['PIX','Dinheiro','Cheque','Boleto','Financiamento']).map(x => `<option ${c.forma_recebimento === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Conta recebida</label>
        <select id="rv-conta">
          ${(typeof getSysConfig === 'function' ? getSysConfig('contas') : ['Viacredi','Caixa']).map(x => `<option ${c.conta === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row cols-2" style="margin-top:12px;">
      <div class="input-group"><label>Categoria</label>
        <select id="rv-categoria">
          ${(typeof getSysConfig === 'function' ? getSysConfig('categorias_fluxo') : ['Projeto','Materiais','Outros']).map(x => `<option ${c.categoria ? c.categoria === x ? 'selected' : '' : x==='Projeto'?'selected':''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Observacoes</label>
        <input id="rv-obs" placeholder="Opcional..." />
      </div>
    </div>
    <div id="rv-parcial-wrap" style="margin-top:16px;padding:12px;background:var(--bg-3);border-radius:var(--radius);display:none;">
      <p style="font-size:13px;color:var(--yellow);margin-bottom:12px;">Pagamento parcial detectado. O saldo restante ficara:</p>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="setSaldoCR('aberto',this)">Em aberto mesmo vencimento</button>
        <button class="btn btn-secondary btn-sm" onclick="setSaldoCR('renegociar',this)">Renegociar novo vencimento</button>
      </div>
      <div id="rv-novo-venc" style="display:none;margin-top:12px;">
        <div class="input-group"><label>Novo vencimento do saldo</label><input type="date" id="rv-data_venc_novo" value="${hoje()}" /></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-success" onclick="confirmarRecebimento('${id}')">Confirmar recebimento</button>
    </div>`;
  abrirModal('Registrar Recebimento', html, 'modal-sm');
  document.getElementById('rv-valor').addEventListener('input', () => {
    const val = parseFloat(document.getElementById('rv-valor').value) || 0;
    const esperado = parseFloat(c.valor_parcela) || 0;
    document.getElementById('rv-parcial-wrap').style.display = val < esperado ? '' : 'none';
  });
}

window._saldoCR = 'aberto';
function setSaldoCR(tipo, btn) {
  window._saldoCR = tipo;
  document.getElementById('rv-novo-venc').style.display = tipo === 'renegociar' ? '' : 'none';
  document.querySelectorAll('#rv-parcial-wrap .btn').forEach(b => b.classList.remove('btn-primary'));
  if (btn) btn.classList.add('btn-primary');
}

async function confirmarRecebimento(id) {
  const c = (window.DB.contas_receber || []).find(x => x.id === id);
  if (!c) return;
  const valorRecebido = parseFloat(document.getElementById('rv-valor').value) || 0;
  const dataReceb = document.getElementById('rv-data').value;
  const forma = document.getElementById('rv-forma').value;
  const conta = document.getElementById('rv-conta')?.value || 'Viacredi';
  const categoria = document.getElementById('rv-categoria')?.value || 'Projeto';
  const obs = document.getElementById('rv-obs')?.value || '';
  const valorEsperado = parseFloat(c.valor_parcela) || 0;
  const parcial = valorRecebido < valorEsperado;
  mostrarToast('Processando...', '');

  // Atualiza status da conta
  const novoStatus = parcial ? 'Parcialmente recebido' : 'Recebido';
  await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, id, {
    ...c, status: novoStatus, data_recebimento: dataReceb, forma_recebimento: forma
  });

  // Lanca no fluxo de caixa (apenas se nao for cheque)
  if (forma !== 'Cheque') {
    await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
      id: gerarId(), data: dataReceb, descricao: c.descricao + ' — ' + c.cliente_nome,
      categoria: categoria, tipo: 'Entrada', valor: valorRecebido,
      forma_pagamento: forma, conta: conta, observacoes: obs,
      vinculo_tipo: 'contas_receber',
      vinculo_id: id, criado_em: hoje(),
    });
  }

  // Se parcial, cria saldo restante
  if (parcial) {
    const saldo = valorEsperado - valorRecebido;
    const novoVenc = window._saldoCR === 'renegociar'
      ? document.getElementById('rv-data_venc_novo')?.value || c.data_vencimento
      : c.data_vencimento;
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_RECEBER, {
      ...c, id: gerarId(), valor_parcela: saldo.toFixed(2),
      data_vencimento: novoVenc, status: 'Pendente',
      descricao: c.descricao + ' (saldo)', criado_em: hoje(),
    });
  }

  mostrarToast('Recebimento registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
  atualizarStatusCR();
  renderCRMetricas();
  aplicarFiltrosCR();
}

function editarCRBtn(btn) { abrirFormContaReceber(JSON.parse(btn.dataset.c.replace(/&quot;/g, '"'))); }

function estornarRecebimento(id) {
  const c = (window.DB.contas_receber || []).find(x => x.id === id);
  if (!c) return;
  const aCompensar = c.status === 'A Compensar';
  const msg = aCompensar
    ? `Cancelar lançamento de ${formatMoeda(c.valor_parcela)} — ${c.cliente_nome}? O cheque voltará para Aguardando.`
    : `Estornar recebimento de ${formatMoeda(c.valor_parcela)} — ${c.cliente_nome}? Sera criado um lançamento de estorno no Fluxo de Caixa.`;
  confirmar(msg, async () => {
    try {
      if (!aCompensar) {
        // Recebido: cria estorno no Fluxo de Caixa
        await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
          id: gerarId(), data: hoje(),
          descricao: 'ESTORNO — ' + c.descricao + ' — ' + c.cliente_nome,
          categoria: c.categoria || 'Projeto', tipo: 'Saída',
          valor: c.valor_parcela, forma_pagamento: c.forma_recebimento || '',
          conta: c.conta || 'Viacredi', vinculo_tipo: 'estorno_cr',
          vinculo_id: id, criado_em: hoje(),
        });
      } else {
        // A Compensar: reverte cheque vinculado para Aguardando
        await carregarDados([CONFIG.SHEETS.CHEQUES]);
        const cheque = (window.DB.cheques || []).find(ch => ch.vinculo_id === id && ch.vinculo_tipo === 'contas_receber');
        if (cheque) await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, cheque.id, { ...cheque, status: 'Aguardando', vinculo_id: '', vinculo_tipo: '' });
      }
      await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, id, { ...c, status: 'Pendente', data_recebimento: '' });
      mostrarToast(aCompensar ? 'Lançamento cancelado — cheque voltou para Aguardando' : 'Recebimento estornado', 'success');
      await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
      atualizarStatusCR();
      renderCRMetricas();
      aplicarFiltrosCR();
    } catch(e) {
      console.error('Erro ao estornar:', e);
      mostrarToast('Erro ao estornar: ' + (e.message || e), 'error');
    }
  });
}

function excluirCR(id) {
  confirmar('Excluir esta conta a receber?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CONTAS_RECEBER, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
    atualizarStatusCR();
    renderCRMetricas();
    aplicarFiltrosCR();
  });
}

// ─── CHEQUE: COMPENSAR VIA CR ─────────────────────────────────────────────
function compensarChequeCR(crId) {
  const cr = (window.DB.contas_receber || []).find(x => x.id === crId);
  if (!cr) return;
  const contas = typeof getSysConfig === 'function' ? getSysConfig('contas') : ['Banco ViaCredi','Caixa'];
  const html = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Cheque de <strong>${formatMoeda(cr.valor_parcela||cr.valor_total)}</strong> — ${cr.cliente_nome}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="input-group"><label>Data da compensacao</label>
        <input type="date" id="comp-data" value="${hoje()}" />
      </div>
      <div class="input-group"><label>Conta de destino</label>
        <select id="comp-conta">
          ${contas.map(c => `<option>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarCompensacaoCR('${crId}')">Confirmar compensacao</button>
    </div>`;
  abrirModal('Compensar Cheque', html);
}

async function confirmarCompensacaoCR(crId) {
  const cr = (window.DB.contas_receber || []).find(x => x.id === crId);
  if (!cr) return;
  await carregarDados([CONFIG.SHEETS.CHEQUES]);
  const cheque = (window.DB.cheques || []).find(x => x.vinculo_id === crId && x.tipo === 'Recebido');
  if (!cheque) { mostrarToast('Nenhum cheque vinculado a este recebimento', 'error'); return; }
  const dataComp = document.getElementById('comp-data')?.value || hoje();
  const conta    = document.getElementById('comp-conta')?.value || 'Banco ViaCredi';
  // Atualizar cheque
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, cheque.id, { ...cheque, status: 'Compensado', data_compensacao: dataComp });
  // Atualizar CR
  await Sheets.atualizar(CONFIG.SHEETS.CONTAS_RECEBER, crId, { ...cr, status: 'Recebido', conta, data_recebimento: dataComp });
  // Lançar no Fluxo de Caixa
  await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
    id: gerarId(), data: dataComp,
    descricao: 'Cheque compensado — ' + cr.cliente_nome + (cr.descricao ? ' — ' + cr.descricao : ''),
    categoria: cr.categoria || 'Cheque Recebido', tipo: 'Entrada',
    valor: cheque.valor, forma_pagamento: 'Cheque',
    conta, criado_em: hoje(),
  });
  mostrarToast('Cheque compensado — lançado no fluxo de caixa', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
  renderCRMetricas(); aplicarFiltrosCR();
}

// ─── CHEQUE: REPASSAR VIA CR ──────────────────────────────────────────────
async function repassarChequeCR(crId) {
  const cr = (window.DB.contas_receber || []).find(x => x.id === crId);
  if (!cr) return;
  await carregarDados([CONFIG.SHEETS.CHEQUES, CONFIG.SHEETS.CONTAS_PAGAR]);
  const cheque = (window.DB.cheques || []).find(x => x.vinculo_id === crId && x.tipo === 'Recebido');
  if (!cheque) { mostrarToast('Nenhum cheque vinculado a este recebimento', 'error'); return; }
  const valorCheque = parseFloat(cheque.valor) || 0;
  const cps = (window.DB.contas_pagar || []).filter(x => x.status === 'Pendente' || x.status === 'Atrasado');
  const html = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Cheque de <strong>${formatMoeda(valorCheque)}</strong> de ${cheque.titular_destinatario || cr.cliente_nome}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="input-group"><label>Repassado para *</label>
        <input id="crch-dest" placeholder="Nome do destinatario" />
      </div>
      <div class="input-group"><label>Valor usado (R$) *</label>
        <input type="number" step="0.01" id="crch-valor" value="${valorCheque.toFixed(2)}"
          oninput="calcDiferencaRepasse(${valorCheque})" />
      </div>
    </div>
    <div class="input-group"><label>Vincular a conta a pagar (opcional)</label>
      <select id="crch-cp">
        <option value="">Nenhuma</option>
        ${cps.map(cp => `<option value="${cp.id}">${cp.fornecedor_nome||cp.descricao} — ${formatMoeda(cp.valor_parcela||cp.valor_total)}</option>`).join('')}
      </select>
    </div>
    <div id="ch-rep-diferenca" style="margin-top:8px;font-size:13px;"></div>
    <div class="input-group" style="margin-top:8px;"><label>Observacoes</label>
      <input id="crch-obs" placeholder="Ex: Pagamento de material" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarRepasseCR('${crId}','${cheque.id}','${valorCheque}')">Confirmar repasse</button>
    </div>`;
  abrirModal('Repassar Cheque', html);
  calcDiferencaRepasse(valorCheque);
}

async function confirmarRepasseCR(crId, chequeId, valorChequeStr) {
  const cr     = (window.DB.contas_receber || []).find(x => x.id === crId);
  const cheque = (window.DB.cheques || []).find(x => x.id === chequeId);
  if (!cr || !cheque) return;
  const dest       = document.getElementById('crch-dest')?.value?.trim();
  const valorUsado = parseFloat(document.getElementById('crch-valor')?.value) || 0;
  const cpId       = document.getElementById('crch-cp')?.value || '';
  const obs        = document.getElementById('crch-obs')?.value || '';
  const valorCheque = parseFloat(valorChequeStr);
  if (!dest) { mostrarToast('Informe o destinatário', 'error'); return; }
  mostrarToast('Registrando repasse...', '');
  // Atualizar cheque
  await Sheets.atualizar(CONFIG.SHEETS.CHEQUES, chequeId, {
    ...cheque, status: 'Repassado',
    repassado_para: dest, valor_repassado: valorUsado.toFixed(2),
    data_repasse: hoje(), obs_repasse: obs,
  });
  // Lançar no Fluxo de Caixa
  await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
    id: gerarId(), data: hoje(),
    descricao: 'Cheque repassado para ' + dest + ' — ref. ' + cr.cliente_nome,
    categoria: 'Cheque Emitido', tipo: 'Saída',
    valor: valorUsado.toFixed(2), forma_pagamento: 'Cheque',
    conta: 'Banco ViaCredi', observacoes: obs, criado_em: hoje(),
  });
  // Quitar CP vinculado
  if (cpId) {
    const cp = (window.DB.contas_pagar || []).find(x => x.id === cpId);
    if (cp) {
      const valorCP = parseFloat(cp.valor_parcela || cp.valor_total || 0);
      await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, cpId, {
        ...cp, status: valorUsado >= valorCP ? 'Pago' : 'Parcialmente pago',
        forma_pagamento: 'Cheque', data_pagamento: hoje(),
      });
    }
  }
  // Diferença
  const diff = valorCheque - valorUsado;
  if (diff > 0.01) {
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_RECEBER, {
      id: gerarId(), cliente_id: '', cliente_nome: dest,
      descricao: 'Troco cheque repassado — ' + (cheque.numero || ''),
      valor_total: diff.toFixed(2), valor_parcela: diff.toFixed(2),
      numero_parcelas: 1, parcela_atual: 1,
      data_emissao: hoje(), data_vencimento: hoje(),
      forma_recebimento: 'Dinheiro', status: 'Pendente',
      observacoes: 'Troco de repasse de cheque', criado_em: hoje(),
    });
    mostrarToast('Repasse registrado — troco de ' + formatMoeda(diff) + ' lançado no CR', 'success');
  } else if (diff < -0.01) {
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
      id: gerarId(), fornecedor_id: '', fornecedor_nome: dest,
      descricao: 'Diferenca cheque repassado — ' + (cheque.numero || ''),
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
  await carregarDados([CONFIG.SHEETS.CONTAS_RECEBER]);
  renderCRMetricas(); aplicarFiltrosCR();
}
