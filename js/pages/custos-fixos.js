// CUSTOS FIXOS
function renderCustosFixos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Custos Fixos</h1><p class="page-subtitle">Controle de despesas recorrentes</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="abrirLancamentoMensal()">📅 Lancamento Mensal</button>
        <button class="btn btn-primary" onclick="abrirFormCustoFixo()">+ Novo Custo</button>
      </div>
    </div>
    <div id="cf-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarCF('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarCF('mensal',this)">Mensais</button>
      <button class="filter-btn" onclick="filtrarCF('anual',this)">Anuais/Semestrais</button>
      <button class="filter-btn" onclick="filtrarCF('Pendente',this)">Pendente</button>
      <button class="filter-btn" onclick="filtrarCF('Pago',this)">Pago</button>
    </div>
    <div id="cf-lista"></div>
    <hr class="divider"/>
    <div style="margin-top:20px;">
      <h2 style="font-family:'Syne',sans-serif;font-size:16px;margin-bottom:16px;">Comparativo Mensal</h2>
      <div id="cf-comparativo"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS, CONFIG.SHEETS.CUSTOS_FIXOS_DEPOSITOS]);
    renderCFMetricas();
    aplicarFiltrosCF();
    renderComparativoCF();
  });
}

function renderCFMetricas() {
  const lista = window.DB.custos_fixos || [];
  const mensais = lista.filter(c => c.periodicidade === 'Mensal');
  const totalMensal = somarCampo(mensais, 'valor');
  const pagos = mensais.filter(c => c.status === 'Pago');
  const totalPago = somarCampo(pagos, 'valor');
  const pendentes = mensais.filter(c => c.status === 'Pendente' || c.status === 'Lancado');
  const totalPendente = somarCampo(pendentes, 'valor');
  const vencidos = mensais.filter(c => c.status === 'Vencido');
  document.getElementById('cf-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total mensal</div><div class="metric-value accent">${formatMoeda(totalMensal)}</div></div>
    <div class="metric-card green"><div class="metric-label">Ja pago</div><div class="metric-value green">${formatMoeda(totalPago)}</div></div>
    <div class="metric-card yellow"><div class="metric-label">Pendente</div><div class="metric-value yellow">${formatMoeda(totalPendente)}</div></div>
    <div class="metric-card red"><div class="metric-label">Vencido</div><div class="metric-value red">${vencidos.length}</div></div>`;
}

window._cfFiltro = 'todos';

function filtrarCF(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._cfFiltro = tipo;
  aplicarFiltrosCF();
}

function aplicarFiltrosCF() {
  let lista = window.DB.custos_fixos || [];
  if (window._cfFiltro === 'mensal') lista = lista.filter(c => c.periodicidade === 'Mensal');
  else if (window._cfFiltro === 'anual') lista = lista.filter(c => ['Anual','Semestral','Trimestral'].includes(c.periodicidade));
  else if (['Pendente','Pago','Vencido'].includes(window._cfFiltro)) lista = lista.filter(c => c.status === window._cfFiltro || (window._cfFiltro === 'Pendente' && c.status === 'Lancado'));
  renderListaCF(lista);
}

function renderListaCF(lista) {
  if (!lista.length) { document.getElementById('cf-lista').innerHTML = estadoVazio('Nenhum custo fixo cadastrado'); return; }
  const mensais = lista.filter(c => c.periodicidade === 'Mensal');
  const outros = lista.filter(c => c.periodicidade !== 'Mensal');
  let html = '';
  if (mensais.length) {
    html += `<h3 style="font-size:13px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Custos Mensais</h3>`;
    html += `<div class="table-wrapper" style="margin-bottom:24px;"><table><thead><tr>
      <th>Descricao</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${mensais.map(c => `<tr>
        <td><strong>${c.descricao}</strong></td>
        <td><span class="badge badge-gray">${c.categoria || '—'}</span></td>
        <td style="font-weight:600;color:var(--accent)">${formatMoeda(c.valor)}</td>
        <td style="font-size:12px;color:var(--text-2)">${c.dia_vencimento ? formatData(c.dia_vencimento) : '—'}${c.mes_referencia ? '<br><span style="font-size:10px;color:var(--text-3)">Ref: ' + ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(c.mes_referencia)-1] + (c.ano_referencia?'/'+c.ano_referencia:'') + '</span>' : ''}</td>
        <td>${badgeStatus(c.status || 'Pendente')}</td>
        <td><div class="td-actions">
          ${c.status === 'Pago' ? '' : c.status === 'Lancado' ? '<span class="badge badge-blue" style="padding:6px 10px;">Lancado no CP</span>' : `<button class="btn btn-success btn-sm" onclick="lancarCustoFixoCP('${c.id}')">Lancar CP</button>`}
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCFBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCF('${c.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }
  if (outros.length) {
    html += `<h3 style="font-size:13px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Custos Anuais / Semestrais</h3>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${outros.map(c => {
        const depositos = (window.DB.custos_fixos_depositos || []).filter(d => d.custo_fixo_id === c.id);
        const totalReservado = somarCampo(depositos, 'valor');
        const totalAnual = parseFloat(c.valor_total_anual) || parseFloat(c.valor) || 0;
        const pct = totalAnual > 0 ? Math.min((totalReservado / totalAnual) * 100, 100) : 0;
        const falta = Math.max(totalAnual - totalReservado, 0);
        const vencimento = c.mes_vencimento && c.ano_vencimento ? c.mes_vencimento + '/' + c.ano_vencimento : '—';
        const hoje_d = new Date();
        const mesesRestantes = c.mes_vencimento && c.ano_vencimento ? 
          Math.max((parseInt(c.ano_vencimento) - hoje_d.getFullYear()) * 12 + (parseInt(c.mes_vencimento) - (hoje_d.getMonth() + 1)), 1) : 1;
        const sugestaoMes = mesesRestantes > 0 ? (falta / mesesRestantes).toFixed(2) : 0;
        return `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-weight:600">${c.descricao}</div>
              <div style="font-size:11px;color:var(--text-3)">${c.periodicidade} · Vence ${vencimento}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-success btn-sm btn-icon" onclick="abrirDepositoCF('${c.id}','${c.descricao}')">+</button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCFBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
              <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCF('${c.id}')">🗑</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-2);margin-bottom:6px;">
            <span>Reservado: ${formatMoeda(totalReservado)}</span>
            <span>Total: ${formatMoeda(totalAnual)}</span>
          </div>
          <div class="progress-wrap"><div class="progress-bar ${pct >= 100 ? 'green' : pct >= 50 ? '' : 'red'}" style="width:${pct}%"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px;">
            <span style="color:var(--text-3)">${pct.toFixed(0)}% reservado</span>
            <span style="color:var(--accent)">Sugestao: ${formatMoeda(sugestaoMes)}/mes</span>
          </div>
          ${falta > 0 ? `<div style="font-size:12px;color:var(--red);margin-top:4px;">Falta reservar: ${formatMoeda(falta)}</div>` : '<div style="font-size:12px;color:var(--green);margin-top:4px;">Meta atingida!</div>'}
        </div>`;
      }).join('')}
    </div>`;
  }
  document.getElementById('cf-lista').innerHTML = html;
}

function abrirFormCustoFixo(c) {
  const edit = !!c;
  const v = (id) => c ? (c[id] || '') : '';
  const cats = ['Aluguel','Energia','Agua','Internet e Telefone','Contador','Pessoal','Impostos','Outros'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Descricao *</label><input id="cf-descricao" value="${v('descricao')}" /></div>
      <div class="input-group"><label>Categoria</label>
        <select id="cf-categoria">${cats.map(x => `<option ${v('categoria')===x?'selected':''}>${x}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Periodicidade</label>
        <select id="cf-periodicidade" onchange="toggleCFAnual()">
          <option ${v('periodicidade')==='Mensal'||!v('periodicidade')?'selected':''}>Mensal</option>
          <option ${v('periodicidade')==='Trimestral'?'selected':''}>Trimestral</option>
          <option ${v('periodicidade')==='Semestral'?'selected':''}>Semestral</option>
          <option ${v('periodicidade')==='Anual'?'selected':''}>Anual</option>
        </select>
      </div>
      <div class="input-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="cf-valor" value="${v('valor')}" /></div>
    </div>
    <div id="cf-mensal-wrap">
      <div class="form-row cols-2">
        <div class="input-group"><label>Data de vencimento</label><input type="date" id="cf-dia_vencimento" value="${v('dia_vencimento')}" /></div>
        <div class="input-group"><label>Mes de referencia</label>
          <div style="display:flex;gap:8px;">
            <select id="cf-mes_referencia" style="flex:1;">
              <option value="">Todos</option>
              ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>`<option value="${i+1}" ${v('mes_referencia')==String(i+1)?'selected':''}>${m}</option>`).join('')}
            </select>
            <input type="number" id="cf-ano_referencia" value="${v('ano_referencia') || new Date().getFullYear()}" min="2020" max="2099"
              style="width:80px;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
          </div>
        </div>
      </div>
    </div>
    <div id="cf-anual-wrap" style="display:none;">
      <div class="form-row cols-2">
        <div class="input-group"><label>Mes de vencimento</label><input type="number" id="cf-mes_vencimento" value="${v('mes_vencimento')}" min="1" max="12" /></div>
        <div class="input-group"><label>Ano de vencimento</label><input type="number" id="cf-ano_vencimento" value="${v('ano_vencimento') || new Date().getFullYear()}" /></div>
      </div>
      <div class="input-group"><label>Valor total a reservar (R$)</label><input type="number" step="0.01" id="cf-valor_total_anual" value="${v('valor_total_anual')}" /></div>
    </div>
    <div class="input-group" style="margin-top:16px;"><label>Observacoes</label><textarea id="cf-obs" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCustoFixo('${edit ? c.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Custo Fixo' : 'Novo Custo Fixo', html, 'modal-lg');
  toggleCFAnual();
}

function toggleCFAnual() {
  const per = document.getElementById('cf-periodicidade')?.value;
  const isMensal = per === 'Mensal';
  const mensal = document.getElementById('cf-mensal-wrap');
  const anual = document.getElementById('cf-anual-wrap');
  if (mensal) mensal.style.display = isMensal ? '' : 'none';
  if (anual) anual.style.display = isMensal ? 'none' : '';
}

async function salvarCustoFixo(id) {
  const per = document.getElementById('cf-periodicidade').value;
  const obj = {
    descricao: document.getElementById('cf-descricao').value,
    categoria: document.getElementById('cf-categoria').value,
    periodicidade: per,
    valor: document.getElementById('cf-valor').value,
    dia_vencimento: document.getElementById('cf-dia_vencimento')?.value || '',
    mes_referencia: document.getElementById('cf-mes_referencia')?.value || '',
    ano_referencia: document.getElementById('cf-ano_referencia')?.value || '',
    mes_vencimento: document.getElementById('cf-mes_vencimento')?.value || '',
    ano_vencimento: document.getElementById('cf-ano_vencimento')?.value || '',
    valor_total_anual: document.getElementById('cf-valor_total_anual')?.value || '',
    valor_reservado: '0',
    status: 'Pendente',
    observacoes: document.getElementById('cf-obs').value,
  };
  if (!obj.descricao || !obj.valor) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    obj.status = (window.DB.custos_fixos || []).find(c => c.id === id)?.status || 'Pendente';
    await Sheets.atualizar(CONFIG.SHEETS.CUSTOS_FIXOS, id, obj);
    mostrarToast('Atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CUSTOS_FIXOS, obj);
    mostrarToast('Custo fixo cadastrado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
}

async function lancarCustoFixoCP(id) {
  const c = (window.DB.custos_fixos || []).find(x => x.id === id);
  if (!c) return;
  // dia_vencimento agora e uma data completa (YYYY-MM-DD)
  const dataVenc = c.dia_vencimento || hoje();
  await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
    id: gerarId(), descricao: c.descricao,
    categoria: c.categoria || 'Custos fixos',
    valor_total: c.valor, valor_parcela: c.valor,
    parcela_num: '1', parcela_total: '1',
    data_emissao: hoje(), data_vencimento: dataVenc,
    status: 'Pendente', criado_em: hoje(),
  });
  // Marca como lancado no CF
  await Sheets.atualizar(CONFIG.SHEETS.CUSTOS_FIXOS, id, { ...c, status: 'Lancado' });
  mostrarToast('Lancado no Contas a Pagar', 'success');
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
}

function abrirDepositoCF(custoId, nome) {
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Registrar deposito para: <strong>${nome}</strong></p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor depositado (R$) *</label><input type="number" step="0.01" id="dep-valor" /></div>
      <div class="input-group"><label>Data</label><input type="date" id="dep-data" value="${hoje()}" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="dep-obs" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarDepositoCF('${custoId}')">Registrar deposito</button>
    </div>`;
  abrirModal('Novo Deposito', html, 'modal-sm');
}

async function salvarDepositoCF(custoId) {
  const valor = document.getElementById('dep-valor').value;
  if (!valor) { mostrarToast('Informe o valor', 'error'); return; }
  await Sheets.adicionar(CONFIG.SHEETS.CUSTOS_FIXOS_DEPOSITOS, {
    id: gerarId(), custo_fixo_id: custoId,
    data: document.getElementById('dep-data').value,
    valor, observacoes: document.getElementById('dep-obs').value,
  });
  mostrarToast('Deposito registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS, CONFIG.SHEETS.CUSTOS_FIXOS_DEPOSITOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
}

function renderComparativoCF() {
  const lista = window.DB.custos_fixos || [];
  const mensais = lista.filter(c => c.periodicidade === 'Mensal');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  document.getElementById('cf-comparativo').innerHTML = `
    <div class="table-wrapper">
      <div style="overflow-x:auto;">
        <table style="min-width:800px;">
          <thead><tr>
            <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Custo</th>
            ${meses.map(m => `<th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">${m}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${(function(){
              // Agrupar por descricao
              const grupos = {};
              mensais.forEach(c => {
                if (!grupos[c.descricao]) grupos[c.descricao] = [];
                grupos[c.descricao].push(c);
              });
              return Object.entries(grupos).map(([nome, itens]) => {
                const celulasMeses = meses.map((m, idx) => {
                  const mesNum = idx + 1;
                  // Soma todos os itens do mesmo mes
                  const itensMes = itens.filter(c => !c.mes_referencia || parseInt(c.mes_referencia) === mesNum);
                  const total = itensMes.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
                  const val = total > 0 ? formatMoeda(total) : '—';
                  const cor = itensMes.length && itensMes[0].mes_referencia ? 'var(--accent)' : itensMes.length ? 'var(--text-2)' : 'var(--text-3)';
                  return '<td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border);color:' + cor + '">' + val + '</td>';
                }).join('');
                return '<tr><td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border)">' + nome + '</td>' + celulasMeses + '</tr>';
              }).join('');
            })()}
            ${(function(){
              const celulasTotais = meses.map((m,idx) => {
                const mesNum = idx + 1;
                const totalMes = mensais.filter(c => !c.mes_referencia || parseInt(c.mes_referencia) === mesNum).reduce((acc,c) => acc + (parseFloat(c.valor)||0), 0);
                return '<td style="padding:8px;font-size:14px;text-align:right;color:var(--accent);font-family:Syne,sans-serif;font-weight:800">' + formatMoeda(totalMes) + '</td>';
              }).join('');
              return '<tr style="font-weight:600;background:rgba(200,169,110,0.08);"><td style="padding:8px;font-size:14px;font-family:Syne,sans-serif;color:var(--accent)">TOTAL</td>' + celulasTotais + '</tr>';
            })()}
          </tbody>
        </table>
      </div>
    </div>`;
}

function abrirLancamentoMensal() {
  // Apenas cadastros base (sem mes_referencia) - sao os templates
  const lista = (window.DB.custos_fixos || []).filter(c => c.periodicidade === 'Mensal' && !c.mes_referencia);
  if (!lista.length) { mostrarToast('Nenhum custo fixo cadastrado', 'error'); return; }
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Selecione os custos fixos para lancar no Contas a Pagar.</p>
    <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;">
      <div class="input-group" style="margin:0;flex:1;">
        <label>Mes de referencia</label>
        <div style="display:flex;gap:8px;">
          <select id="lm-mes" style="flex:1;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;">
            ${meses.map((m,i) => `<option value="${i+1}" ${mesAtual===i+1?'selected':''}>${m}</option>`).join('')}
          </select>
          <input type="number" id="lm-ano" value="${anoAtual}"
            style="width:80px;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
        </div>
      </div>
    </div>
    <div id="lm-itens">
      ${lista.map(c => `
        <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:12px;align-items:center;padding:12px;border-bottom:1px solid var(--border);">
          <input type="checkbox" id="lm-chk-${c.id}" checked style="width:16px;height:16px;cursor:pointer;" />
          <label for="lm-chk-${c.id}" style="font-size:13px;cursor:pointer;">
            <strong>${c.descricao}</strong>
            <span style="font-size:11px;color:var(--text-3);display:block;">${c.categoria || ''}</span>
          </label>
          <div class="input-group" style="margin:0;">
            <label style="font-size:10px;">Valor (R$)</label>
            <input type="number" step="0.01" id="lm-val-${c.id}" value="${c.valor}"
              style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;" />
          </div>
          <div class="input-group" style="margin:0;">
            <label style="font-size:10px;">Vencimento</label>
            <input type="date" id="lm-venc-${c.id}" value="${c.dia_vencimento || ''}"
              style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;" />
          </div>
        </div>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="confirmarLancamentoMensal()">Lancar selecionados no CP</button>
    </div>`;
  abrirModal('Lancamento Mensal', html, 'modal-lg');
  window._lmLista = lista;
}

async function confirmarLancamentoMensal() {
  const mes = document.getElementById('lm-mes')?.value;
  const ano = document.getElementById('lm-ano')?.value;
  const lista = window._lmLista || [];
  const selecionados = lista.filter(c => document.getElementById('lm-chk-' + c.id)?.checked);
  if (!selecionados.length) { mostrarToast('Selecione ao menos um item', 'error'); return; }
  mostrarToast('Lancando...', '');
  for (const c of selecionados) {
    const valor = document.getElementById('lm-val-' + c.id)?.value || c.valor;
    const venc = document.getElementById('lm-venc-' + c.id)?.value || hoje();
    // 1. Lanca no Contas a Pagar
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
      id: gerarId(), descricao: c.descricao,
      categoria: c.categoria || 'Custos fixos',
      valor_total: valor, valor_parcela: valor,
      parcela_num: '1', parcela_total: '1',
      data_emissao: hoje(), data_vencimento: venc,
      status: 'Pendente', criado_em: hoje(),
    });
    // 2. Cria novo registro em Custos Fixos para esse mes/ano
    await Sheets.adicionar(CONFIG.SHEETS.CUSTOS_FIXOS, {
      id: gerarId(),
      descricao: c.descricao,
      categoria: c.categoria || '',
      periodicidade: c.periodicidade || 'Mensal',
      valor: valor,
      dia_vencimento: venc,
      mes_referencia: mes,
      ano_referencia: ano,
      mes_vencimento: '',
      ano_vencimento: '',
      valor_total_anual: '',
      valor_reservado: '0',
      status: 'Lancado',
      observacoes: 'Gerado pelo lancamento mensal',
      criado_em: hoje(),
    });
    // 3. Cadastro original NAO e alterado - continua disponivel para proximos meses
  }
  mostrarToast(selecionados.length + ' custo(s) lancado(s) no Contas a Pagar', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
  renderComparativoCF();
}

function editarCFBtn(btn) { abrirFormCustoFixo(JSON.parse(btn.dataset.c.replace(/&quot;/g,'"'))); }

function excluirCF(id) {
  confirmar('Excluir este custo fixo?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CUSTOS_FIXOS, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
    renderCFMetricas();
    aplicarFiltrosCF();
  });
}
