// FINANCIAMENTOS — acompanhamento de empréstimos e financiamentos

function renderFinanciamentos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Financiamentos</h1><p class="page-subtitle">Acompanhamento de empréstimos e financiamentos</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormFinanciamento()">+ Novo Financiamento</button>
      </div>
    </div>
    <div id="fin-lista"></div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.FINANCIAMENTOS, CONFIG.SHEETS.CONTAS_PAGAR]);
    renderListaFinanciamentos();
  });
}

// Retorna as parcelas CP vinculadas a um financiamento (por id ou por credor+padrão)
function _cpDoFinanciamento(finId, credor) {
  const todas = window.DB.contas_pagar || [];
  const porId = todas.filter(cp => cp.financiamento_id === finId);
  if (porId.length > 0) return porId;
  // Fallback: registros antigos sem financiamento_id
  return todas.filter(cp =>
    cp.fornecedor_nome === credor &&
    cp.descricao && cp.descricao.includes(' — Parcela ')
  );
}

function renderListaFinanciamentos() {
  const lista = window.DB.financiamentos || [];
  const container = document.getElementById('fin-lista');
  if (!lista.length) {
    container.innerHTML = estadoVazio('Nenhum financiamento cadastrado');
    return;
  }
  container.innerHTML = lista.map(f => {
    const totalParcelas = parseInt(f.total_parcelas) || 0;
    const cpList        = _cpDoFinanciamento(f.id, f.credor);
    const pagas         = cpList.filter(cp => cp.status === 'Pago').length || parseInt(f.parcelas_pagas) || 0;
    const restantes     = totalParcelas - pagas;
    const pct           = totalParcelas > 0 ? Math.min(100, (pagas / totalParcelas * 100)).toFixed(0) : 0;
    const saldo         = parseFloat(f.saldo_devedor) || 0;
    const parcela       = parseFloat(f.valor_parcela) || 0;
    return `
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:16px;font-weight:600;">${f.credor || '—'}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;">Contrato ${f.contrato || '—'} · ${f.produto || '—'} · Liberado em ${formatData(f.data_liberacao)}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="verParcelasFinanciamento('${f.id}')">Ver parcelas</button>
          <button class="btn btn-secondary btn-sm" onclick="abrirFormFinanciamento('${f.id}')">Editar</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirFinanciamento('${f.id}')">🗑</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px;">
        <div class="metric-card"><div class="metric-label">Valor original</div><div class="metric-value" style="font-size:15px;">${formatMoeda(f.valor_total)}</div></div>
        <div class="metric-card red"><div class="metric-label">Saldo devedor</div><div class="metric-value red" style="font-size:15px;">${formatMoeda(saldo)}</div></div>
        <div class="metric-card"><div class="metric-label">Parcela mensal</div><div class="metric-value" style="font-size:15px;">${formatMoeda(parcela)}</div></div>
        <div class="metric-card green"><div class="metric-label">Parcelas pagas</div><div class="metric-value green" style="font-size:15px;">${pagas} / ${totalParcelas}</div></div>
        <div class="metric-card yellow"><div class="metric-label">Restantes</div><div class="metric-value yellow" style="font-size:15px;">${restantes}</div></div>
      </div>
      <div style="margin-bottom:6px;display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);">
        <span>Progresso</span><span>${pct}% pago</span>
      </div>
      <div style="height:8px;background:var(--bg-3);border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--green);border-radius:999px;transition:width .3s;"></div>
      </div>
      ${f.dia_vencimento ? `<div style="font-size:12px;color:var(--text-3);margin-top:8px;">Vencimento todo dia <strong>${f.dia_vencimento}</strong> · Próxima parcela: <strong>${proximaParcelaFin(f, pagas)}</strong></div>` : ''}
    </div>`;
  }).join('');
}

function proximaParcelaFin(f, pagas) {
  const total = parseInt(f.total_parcelas) || 0;
  if (pagas >= total) return 'Quitado';
  const dia = parseInt(f.dia_vencimento) || 15;
  const dataLib = new Date(f.data_liberacao + 'T00:00:00');
  const d = new Date(dataLib.getFullYear(), dataLib.getMonth() + pagas + 1, dia);
  return d.toLocaleDateString('pt-BR');
}

// ─── FORMULÁRIO ───────────────────────────────────────────────────────────
function abrirFormFinanciamento(id) {
  const lista = window.DB.financiamentos || [];
  const f = id ? lista.find(x => x.id === id) : null;
  const v = (key) => f ? (f[key] || '') : '';

  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="input-group"><label>Credor *</label>
        <input id="fin-credor" value="${v('credor')}" placeholder="Ex: Viacredi" />
      </div>
      <div class="input-group"><label>Número do contrato</label>
        <input id="fin-contrato" value="${v('contrato')}" placeholder="Ex: 9.710.149" />
      </div>
      <div class="input-group"><label>Produto</label>
        <input id="fin-produto" value="${v('produto')}" placeholder="Ex: Price Pre-Fixado" />
      </div>
      <div class="input-group"><label>Data de liberação *</label>
        <input type="date" id="fin-data_liberacao" value="${v('data_liberacao')}" />
      </div>
      <div class="input-group"><label>Valor total (R$) *</label>
        <input type="number" step="0.01" id="fin-valor_total" value="${v('valor_total')}" placeholder="0,00" />
      </div>
      <div class="input-group"><label>Total de parcelas *</label>
        <input type="number" id="fin-total_parcelas" value="${v('total_parcelas')}" placeholder="Ex: 48" oninput="calcSaldoFin()" />
      </div>
      <div class="input-group"><label>Valor da parcela (R$) *</label>
        <input type="number" step="0.01" id="fin-valor_parcela" value="${v('valor_parcela')}" placeholder="0,00" oninput="calcSaldoFin()" />
      </div>
      <div class="input-group"><label>Parcelas já pagas</label>
        <input type="number" id="fin-parcelas_pagas" value="${v('parcelas_pagas') || '0'}" min="0" oninput="calcSaldoFin()" />
      </div>
      <div class="input-group"><label>Saldo devedor atual (R$)</label>
        <input type="number" step="0.01" id="fin-saldo_devedor" value="${v('saldo_devedor')}" placeholder="Calculado automaticamente" />
      </div>
      <div class="input-group"><label>Dia de vencimento</label>
        <input type="number" id="fin-dia_vencimento" value="${v('dia_vencimento') || '15'}" min="1" max="31" />
      </div>
    </div>
    <div class="input-group" style="margin-top:4px;"><label>Observações</label>
      <input id="fin-observacoes" value="${v('observacoes')}" placeholder="Ex: PEAC FGI BNDES" />
    </div>
    ${!f ? `<div style="margin-top:12px;padding:10px 14px;background:var(--bg-2);border-radius:var(--radius);font-size:12px;color:var(--text-3);">
      As parcelas restantes serão geradas automaticamente no Contas a Pagar.
    </div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarFinanciamento('${id || ''}')">${f ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(f ? 'Editar Financiamento' : 'Novo Financiamento', html);
}

function calcSaldoFin() {
  const total    = parseInt(document.getElementById('fin-total_parcelas')?.value) || 0;
  const pagas    = parseInt(document.getElementById('fin-parcelas_pagas')?.value) || 0;
  const parcela  = parseFloat(document.getElementById('fin-valor_parcela')?.value) || 0;
  const restantes = total - pagas;
  if (restantes > 0 && parcela > 0) {
    document.getElementById('fin-saldo_devedor').value = (restantes * parcela).toFixed(2);
  }
}

async function salvarFinanciamento(id) {
  const credor = document.getElementById('fin-credor')?.value?.trim();
  if (!credor) { mostrarToast('Informe o credor', 'error'); return; }

  const totalParcelas  = parseInt(document.getElementById('fin-total_parcelas')?.value) || 0;
  const parcelas_pagas = parseInt(document.getElementById('fin-parcelas_pagas')?.value) || 0;
  const valorParcela   = parseFloat(document.getElementById('fin-valor_parcela')?.value) || 0;
  const dataLib        = document.getElementById('fin-data_liberacao')?.value || '';
  const diaVenc        = parseInt(document.getElementById('fin-dia_vencimento')?.value) || 15;

  if (!totalParcelas || !valorParcela || !dataLib) {
    mostrarToast('Preencha os campos obrigatórios', 'error'); return;
  }

  const obj = {
    credor,
    contrato:        document.getElementById('fin-contrato')?.value || '',
    produto:         document.getElementById('fin-produto')?.value || '',
    data_liberacao:  dataLib,
    valor_total:     parseFloat(document.getElementById('fin-valor_total')?.value || 0).toFixed(2),
    total_parcelas:  totalParcelas,
    valor_parcela:   valorParcela.toFixed(2),
    parcelas_pagas,
    saldo_devedor:   parseFloat(document.getElementById('fin-saldo_devedor')?.value || 0).toFixed(2),
    dia_vencimento:  diaVenc,
    observacoes:     document.getElementById('fin-observacoes')?.value || '',
  };

  mostrarToast('Salvando...', '');

  if (id) {
    obj.id = id; obj.atualizado_em = hoje();
    await Sheets.atualizar(CONFIG.SHEETS.FINANCIAMENTOS, id, obj);
    mostrarToast('Financiamento atualizado', 'success');
  } else {
    obj.id = gerarId(); obj.criado_em = hoje(); obj.atualizado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.FINANCIAMENTOS, obj);
    await gerarParcelasCP(obj, parcelas_pagas, totalParcelas, valorParcela, dataLib, diaVenc);
    mostrarToast('Financiamento cadastrado e parcelas geradas no Contas a Pagar', 'success');
  }

  fecharModal();
  await carregarDados([CONFIG.SHEETS.FINANCIAMENTOS, CONFIG.SHEETS.CONTAS_PAGAR]);
  renderListaFinanciamentos();
}

async function gerarParcelasCP(fin, pagas, total, valorParcela, dataLib, diaVenc) {
  const dataLiberacao = new Date(dataLib + 'T00:00:00');
  for (let i = pagas; i < total; i++) {
    const numParcela = i + 1;
    const d = new Date(dataLiberacao.getFullYear(), dataLiberacao.getMonth() + i + 1, diaVenc);
    const vencimento = d.toISOString().split('T')[0];
    const cp = {
      id:               gerarId(),
      descricao:        fin.credor + ' — Parcela ' + numParcela + '/' + total,
      categoria:        'Financiamento ' + fin.credor,
      valor_parcela:    valorParcela.toFixed(2),
      valor_total:      valorParcela.toFixed(2),
      data_vencimento:  vencimento,
      data_emissao:     hoje(),
      forma_pagamento:  'Débito Automático',
      status:           'Pendente',
      fornecedor_id:    '',
      fornecedor_nome:  fin.credor,
      observacoes:      'Contrato ' + fin.contrato + (fin.produto ? ' · ' + fin.produto : ''),
      financiamento_id: fin.id,
      criado_em:        hoje(),
    };
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, cp);
  }
}

// ─── VER PARCELAS ─────────────────────────────────────────────────────────
async function verParcelasFinanciamento(finId) {
  await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR]);
  const f = (window.DB.financiamentos || []).find(x => x.id === finId);
  if (!f) return;

  const totalParcelas  = parseInt(f.total_parcelas) || 0;
  const cpList         = _cpDoFinanciamento(finId, f.credor)
    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  const pagas          = cpList.filter(cp => cp.status === 'Pago').length || parseInt(f.parcelas_pagas) || 0;
  const totalPago      = cpList.filter(cp => cp.status === 'Pago').reduce((s, cp) => s + parseFloat(cp.valor_parcela || 0), 0);
  const saldo          = parseFloat(f.saldo_devedor) || 0;

  // Encontra a parcela CP pelo número (ex: "Viacredi — Parcela 4/48")
  const cpPorNum = (num) => cpList.find(cp =>
    cp.descricao && cp.descricao.includes('— Parcela ' + num + '/')
  );

  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px;">
      <div><span style="color:var(--text-3)">Valor total</span><br><strong>${formatMoeda(f.valor_total)}</strong></div>
      <div><span style="color:var(--text-3)">Saldo devedor</span><br><strong style="color:var(--red)">${formatMoeda(saldo)}</strong></div>
      <div><span style="color:var(--text-3)">Parcelas</span><br><strong>${pagas} pagas / ${totalParcelas - pagas} restantes</strong></div>
    </div>
    <div style="max-height:50vh;overflow-y:auto;">
      <table style="width:100%;font-size:13px;">
        <thead><tr>
          <th style="padding:8px;text-align:left;">Parcela</th>
          <th style="padding:8px;text-align:left;">Vencimento</th>
          <th style="padding:8px;text-align:right;">Valor</th>
          <th style="padding:8px;text-align:left;">Pagamento</th>
          <th style="padding:8px;text-align:center;">Status</th>
        </tr></thead>
        <tbody>
          ${Array.from({length: totalParcelas}, (_, i) => {
            const num  = i + 1;
            const cp   = cpPorNum(num);
            const dataLib = new Date(f.data_liberacao + 'T00:00:00');
            const d    = new Date(dataLib.getFullYear(), dataLib.getMonth() + i + 1, parseInt(f.dia_vencimento) || 15);
            const venc = cp ? formatData(cp.data_vencimento) : d.toLocaleDateString('pt-BR');
            const status = cp ? cp.status : (num <= pagas ? 'Pago' : 'Pendente');
            const isPago = status === 'Pago';
            const dataPgto = cp?.data_pagamento ? formatData(cp.data_pagamento) : '—';
            return `<tr style="border-bottom:1px solid var(--border);background:${isPago ? 'rgba(34,197,94,.06)' : ''};">
              <td style="padding:8px;font-weight:600;">${num}</td>
              <td style="padding:8px;">${venc}</td>
              <td style="padding:8px;text-align:right;font-weight:600;">${formatMoeda(cp?.valor_parcela || f.valor_parcela)}</td>
              <td style="padding:8px;font-size:12px;color:var(--text-3);">${isPago ? dataPgto : '—'}</td>
              <td style="padding:8px;text-align:center;">${isPago
                ? '<span style="color:var(--green);font-size:11px;font-weight:600;">PAGA</span>'
                : badgeStatus(status)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--bg-2);border-radius:var(--radius);display:flex;justify-content:space-between;font-size:13px;">
      <span>Total pago: <strong style="color:var(--green);">${formatMoeda(totalPago)}</strong></span>
      <span>Total restante: <strong style="color:var(--red);">${formatMoeda((totalParcelas - pagas) * parseFloat(f.valor_parcela))}</strong></span>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn btn-primary" onclick="fecharModal();registrarPagamentoFin('${finId}')">Registrar pagamento</button>
    </div>`;
  abrirModal('Parcelas — ' + f.credor, html, 'modal-lg');
}

// ─── REGISTRAR PAGAMENTO ──────────────────────────────────────────────────
function registrarPagamentoFin(finId) {
  const f = (window.DB.financiamentos || []).find(x => x.id === finId);
  if (!f) return;

  const cpList   = _cpDoFinanciamento(finId, f.credor);
  const pagas    = cpList.filter(cp => cp.status === 'Pago').length || parseInt(f.parcelas_pagas) || 0;
  const total    = parseInt(f.total_parcelas) || 0;
  if (pagas >= total) { mostrarToast('Financiamento já quitado', 'success'); return; }

  const numParcela  = pagas + 1;
  const dataLib     = new Date(f.data_liberacao + 'T00:00:00');
  const d           = new Date(dataLib.getFullYear(), dataLib.getMonth() + pagas + 1, parseInt(f.dia_vencimento) || 15);
  const valorParcela = parseFloat(f.valor_parcela) || 0;
  const saldoAtual   = parseFloat(f.saldo_devedor) || 0;

  const html = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Parcela <strong>${numParcela}/${total}</strong> · Vencimento: <strong>${d.toLocaleDateString('pt-BR')}</strong>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="input-group"><label>Data do pagamento</label>
        <input type="date" id="finpg-data" value="${hoje()}" />
      </div>
      <div class="input-group"><label>Valor pago (R$)</label>
        <input type="number" step="0.01" id="finpg-valor" value="${valorParcela.toFixed(2)}"
          oninput="document.getElementById('finpg-saldo').value=(Math.max(0,${saldoAtual}-parseFloat(this.value||0))).toFixed(2)" />
      </div>
    </div>
    <div class="input-group"><label>Novo saldo devedor (R$)</label>
      <input type="number" step="0.01" id="finpg-saldo" value="${Math.max(0, saldoAtual - valorParcela).toFixed(2)}" />
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarPagamentoFin('${finId}','${numParcela}')">Confirmar pagamento</button>
    </div>`;
  abrirModal('Registrar Pagamento — Parcela ' + numParcela, html);
}

async function confirmarPagamentoFin(finId, numParcela) {
  const f = (window.DB.financiamentos || []).find(x => x.id === finId);
  if (!f) return;

  const dataPgto   = document.getElementById('finpg-data')?.value || hoje();
  const valorPago  = parseFloat(document.getElementById('finpg-valor')?.value) || 0;
  const novoSaldo  = parseFloat(document.getElementById('finpg-saldo')?.value) || 0;
  const pagas      = parseInt(f.parcelas_pagas) || 0;

  mostrarToast('Registrando...', '');

  // 1. Atualizar financiamento
  await Sheets.atualizar(CONFIG.SHEETS.FINANCIAMENTOS, finId, {
    ...f, parcelas_pagas: pagas + 1, saldo_devedor: novoSaldo.toFixed(2), atualizado_em: hoje()
  });

  // 2. Marcar parcela no Contas a Pagar como Paga (busca por id ou por descrição)
  await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR]);
  const chave = f.credor + ' — Parcela ' + numParcela + '/' + f.total_parcelas;
  const cpList = _cpDoFinanciamento(finId, f.credor);
  const cp = cpList.find(x => x.descricao === chave && x.status !== 'Pago');
  if (cp) {
    await Sheets.atualizar(CONFIG.SHEETS.CONTAS_PAGAR, cp.id, {
      ...cp, status: 'Pago', data_pagamento: dataPgto
    });
  }

  // 3. Lançar no Fluxo de Caixa
  await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
    id:              gerarId(),
    data:            dataPgto,
    tipo:            'Saída',
    descricao:       f.credor + ' — Parcela ' + numParcela + '/' + f.total_parcelas,
    categoria:       'Financiamento ' + f.credor,
    valor:           valorPago.toFixed(2),
    forma_pagamento: 'Débito Automático',
    conta:           'Banco ' + f.credor,
    vinculo_tipo:    'financiamento',
    vinculo_id:      finId,
    observacoes:     'Contrato ' + f.contrato,
    criado_em:       hoje(),
  });

  mostrarToast('Pagamento registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.FINANCIAMENTOS, CONFIG.SHEETS.CONTAS_PAGAR]);
  renderListaFinanciamentos();
}

// ─── EXCLUIR ──────────────────────────────────────────────────────────────
function excluirFinanciamento(id) {
  confirmar('Excluir este financiamento e TODOS os registros vinculados? Isso remove as parcelas do Contas a Pagar e os lançamentos no Fluxo de Caixa.', async () => {
    try {
      mostrarToast('Removendo registros...', '');

      // Salvar credor antes de qualquer operação
      const fin = (window.DB.financiamentos || []).find(x => x.id === id);
      const credor = fin?.credor || '';

      // Carregar dados atualizados
      await carregarDados([CONFIG.SHEETS.CONTAS_PAGAR, CONFIG.SHEETS.FLUXO_CAIXA]);

      // Encontrar parcelas por financiamento_id ou por credor+padrão
      const todasCP = window.DB.contas_pagar || [];
      let parcelas = todasCP.filter(cp => cp.financiamento_id === id);
      if (parcelas.length === 0 && credor) {
        parcelas = todasCP.filter(cp =>
          cp.fornecedor_nome === credor &&
          cp.descricao && cp.descricao.includes(' — Parcela ')
        );
      }

      const fluxo = window.DB.fluxo_caixa || [];

      // Excluir lançamentos do fluxo vinculados a cada parcela
      for (const cp of parcelas) {
        const vinculados = fluxo.filter(fc =>
          (fc.vinculo_tipo === 'contas_pagar' || fc.vinculo_tipo === 'estorno_cp') &&
          fc.vinculo_id === cp.id
        );
        for (const fc of vinculados) {
          await Sheets.excluir(CONFIG.SHEETS.FLUXO_CAIXA, fc.id);
        }
      }

      // Excluir lançamentos do fluxo criados pela aba Financiamentos
      const fluxoFin = fluxo.filter(fc => fc.vinculo_tipo === 'financiamento' && fc.vinculo_id === id);
      for (const fc of fluxoFin) {
        await Sheets.excluir(CONFIG.SHEETS.FLUXO_CAIXA, fc.id);
      }

      // Excluir parcelas do CP
      for (const cp of parcelas) {
        await Sheets.excluir(CONFIG.SHEETS.CONTAS_PAGAR, cp.id);
      }

      // Excluir o financiamento
      await Sheets.excluir(CONFIG.SHEETS.FINANCIAMENTOS, id);

      mostrarToast('Financiamento e todos os registros vinculados excluídos', 'success');
      await carregarDados([CONFIG.SHEETS.FINANCIAMENTOS, CONFIG.SHEETS.CONTAS_PAGAR]);
      renderListaFinanciamentos();
    } catch(e) {
      console.error('Erro ao excluir financiamento:', e);
      mostrarToast('Erro ao excluir: ' + (e.message || e), 'error');
    }
  });
}
