// CUSTOS FIXOS
function renderCustosFixos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Custos Fixos</h1><p class="page-subtitle">Controle de despesas recorrentes</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="abrirGerenciarEmpresas()">⚙ Empresas</button>
        <button class="btn btn-primary" onclick="abrirFormCustoFixo()">+ Nova Despesa</button>
      </div>
    </div>
    <div id="cf-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarCF('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarCF('mensal',this)">Mensais</button>
      <button class="filter-btn" onclick="filtrarCF('anual',this)">Anuais/Semestrais</button>
      <button class="filter-btn" onclick="filtrarCF('Pendente',this)">Pendente</button>
      <button class="filter-btn" onclick="filtrarCF('Lancado',this)">Lancado</button>
      <button class="filter-btn" onclick="filtrarCF('Pago',this)">Pago</button>
      <select id="cf-filtro-mes" onchange="aplicarFiltrosCF()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todos os meses</option>
        ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>`<option value="${i+1}" ${new Date().getMonth()===i?'selected':''}>${m}</option>`).join('')}
      </select>
      <input type="number" id="cf-filtro-ano" value="${new Date().getFullYear()}" min="2020" max="2099" onchange="aplicarFiltrosCF()"
        style="width:75px;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;" />
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

function getCFEmpresas() {
  const salvas = localStorage.getItem('cf_empresas');
  return salvas ? JSON.parse(salvas) : ['Celesc','Guabiruba Saneamento','Aluguel','Internet e Telefone','Contador','Outros'];
}

function saveCFEmpresas(lista) {
  localStorage.setItem('cf_empresas', JSON.stringify(lista));
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
  else if (['Pendente','Lancado','Pago','Vencido'].includes(window._cfFiltro)) lista = lista.filter(c => c.status === window._cfFiltro);
  // Filtro por mes/ano de vencimento
  const filtroMes = document.getElementById('cf-filtro-mes')?.value || '';
  const filtroAno = document.getElementById('cf-filtro-ano')?.value || '';
  if (filtroMes) {
    lista = lista.filter(c => {
      if (!c.dia_vencimento) return false;
      const d = new Date(c.dia_vencimento + 'T00:00:00');
      const mesOk = d.getMonth() + 1 === parseInt(filtroMes);
      const anoOk = !filtroAno || d.getFullYear() === parseInt(filtroAno);
      return mesOk && anoOk;
    });
  }
  renderListaCF(lista);
}

function renderListaCF(lista) {
  if (!lista.length) { document.getElementById('cf-lista').innerHTML = estadoVazio('Nenhuma despesa cadastrada'); return; }
  const mensais = lista.filter(c => c.periodicidade === 'Mensal');
  const outros = lista.filter(c => c.periodicidade !== 'Mensal');
  let html = '';
  if (mensais.length) {
    html += `<h3 style="font-size:13px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Despesas Mensais</h3>`;
    html += `<div class="table-wrapper" style="margin-bottom:24px;"><table><thead><tr>
      <th>Empresa</th><th>Categoria</th><th>Valor</th><th>Vencimento</th><th>Referencia</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${mensais.map(c => {
        const mesNome = c.mes_referencia ? ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(c.mes_referencia)-1] : '';
        const refLabel = mesNome ? mesNome + (c.ano_referencia ? '/'+c.ano_referencia : '') : '—';
        const btnCP = c.status === 'Lancado'
          ? `<button class="btn btn-danger btn-sm" onclick="removerCPCustoFixo('${c.id}')">Remover CP</button>`
          : c.status !== 'Pago'
            ? `<button class="btn btn-success btn-sm" onclick="lancarCustoFixoCP('${c.id}')">Lancar CP</button>`
            : '';
        return `<tr>
          <td><strong>${c.descricao}</strong></td>
          <td><span class="badge badge-gray">${c.categoria || '—'}</span></td>
          <td style="font-weight:600;color:var(--accent)">${formatMoeda(c.valor)}</td>
          <td style="font-size:12px;color:var(--text-2)">${c.dia_vencimento ? formatData(c.dia_vencimento) : '—'}</td>
          <td style="font-size:12px;color:var(--text-3)">${refLabel}</td>
          <td>${badgeStatus(c.status || 'Pendente')}</td>
          <td><div class="td-actions">
            ${btnCP}
            <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCFBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCF('${c.id}')">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table></div>`;
  }
  if (outros.length) {
    html += `<h3 style="font-size:13px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Despesas Anuais / Semestrais</h3>`;
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
        const sugestaoMes = falta > 0 && mesesRestantes > 0 ? (falta / mesesRestantes).toFixed(2) : 0;
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
          ${falta > 0 ? `<div style="font-size:12px;color:var(--red);margin-top:4px;">Falta: ${formatMoeda(falta)}</div>` : '<div style="font-size:12px;color:var(--green);margin-top:4px;">Meta atingida!</div>'}
        </div>`;
      }).join('')}
    </div>`;
  }
  document.getElementById('cf-lista').innerHTML = html;
}

function abrirFormCustoFixo(c) {
  const edit = !!c;
  const v = (id) => c ? (c[id] || '') : '';
  const empresas = getCFEmpresas();
  const cats = ['Aluguel','Energia','Agua','Internet e Telefone','Contador','Pessoal','Impostos','Outros'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Empresa *</label>
        <select id="cf-descricao">
          <option value="">Selecione...</option>
          ${empresas.map(e => `<option ${v('descricao')===e?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
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
              <option value="">Selecione...</option>
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
  abrirModal(edit ? 'Editar Despesa' : 'Nova Despesa', html, 'modal-lg');
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
  const desc = document.getElementById('cf-descricao').value;
  if (!desc) { mostrarToast('Selecione a empresa', 'error'); return; }
  const per = document.getElementById('cf-periodicidade').value;
  const obj = {
    descricao: desc,
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
  if (!obj.valor) { mostrarToast('Informe o valor', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    obj.status = (window.DB.custos_fixos || []).find(c => c.id === id)?.status || 'Pendente';
    await Sheets.atualizar(CONFIG.SHEETS.CUSTOS_FIXOS, id, obj);
    mostrarToast('Atualizado', 'success');
  } else {
    obj.id = gerarId(); obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CUSTOS_FIXOS, obj);
    mostrarToast('Despesa cadastrada', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
  renderComparativoCF();
}

async function lancarCustoFixoCP(id) {
  const c = (window.DB.custos_fixos || []).find(x => x.id === id);
  if (!c) return;
  const cpId = gerarId();
  await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
    id: cpId, descricao: c.descricao,
    categoria: c.categoria || 'Custos fixos',
    valor_total: c.valor, valor_parcela: c.valor,
    parcela_num: '1', parcela_total: '1',
    data_emissao: hoje(), data_vencimento: c.dia_vencimento || hoje(),
    status: 'Pendente', criado_em: hoje(),
  });
  await Sheets.atualizar(CONFIG.SHEETS.CUSTOS_FIXOS, id, { ...c, status: 'Lancado', cp_id: cpId });
  mostrarToast('Lancado no Contas a Pagar', 'success');
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
}

async function removerCPCustoFixo(id) {
  const c = (window.DB.custos_fixos || []).find(x => x.id === id);
  if (!c) return;
  // Remove do Contas a Pagar se tiver o ID salvo
  if (c.cp_id) {
    try { await Sheets.excluir(CONFIG.SHEETS.CONTAS_PAGAR, c.cp_id); } catch(e) {}
  }
  await Sheets.atualizar(CONFIG.SHEETS.CUSTOS_FIXOS, id, { ...c, status: 'Pendente', cp_id: '' });
  mostrarToast('Removido do Contas a Pagar', 'success');
  await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
  renderCFMetricas();
  aplicarFiltrosCF();
}

function abrirGerenciarEmpresas() {
  const empresas = getCFEmpresas();
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Gerencie as empresas disponiveis no cadastro de despesas.</p>
    <div id="emp-lista" style="margin-bottom:16px;">
      ${empresas.map((e, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${e}</span>
          <button onclick="removerEmpresaCF(${i})" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;">✕</button>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;">
      <input id="nova-empresa" placeholder="Nova empresa..." style="flex:1;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
      <button class="btn btn-primary btn-sm" onclick="adicionarEmpresaCF()">Adicionar</button>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
    </div>`;
  abrirModal('Gerenciar Empresas', html, 'modal-sm');
}

function adicionarEmpresaCF() {
  const val = document.getElementById('nova-empresa')?.value?.trim();
  if (!val) return;
  const empresas = getCFEmpresas();
  empresas.push(val);
  saveCFEmpresas(empresas);
  document.getElementById('nova-empresa').value = '';
  // Atualiza lista no modal
  const lista = document.getElementById('emp-lista');
  if (lista) {
    lista.innerHTML = empresas.map((e, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span>${e}</span>
        <button onclick="removerEmpresaCF(${i})" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;">✕</button>
      </div>`).join('');
  }
  mostrarToast('Empresa adicionada', 'success');
}

function removerEmpresaCF(i) {
  const empresas = getCFEmpresas();
  empresas.splice(i, 1);
  saveCFEmpresas(empresas);
  abrirGerenciarEmpresas();
}

function renderComparativoCF() {
  const lista = window.DB.custos_fixos || [];
  const mensais = lista.filter(c => c.periodicidade === 'Mensal' && c.mes_referencia);
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  if (!mensais.length) {
    document.getElementById('cf-comparativo').innerHTML = '<p style="color:var(--text-3);font-size:13px;">Nenhum lancamento com mes de referencia definido.</p>';
    return;
  }
  // Agrupar por empresa
  const grupos = {};
  mensais.forEach(c => {
    if (!grupos[c.descricao]) grupos[c.descricao] = [];
    grupos[c.descricao].push(c);
  });
  document.getElementById('cf-comparativo').innerHTML = `
    <div class="table-wrapper">
      <div style="overflow-x:auto;">
        <table style="min-width:800px;">
          <thead><tr>
            <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Empresa</th>
            ${meses.map(m => `<th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">${m}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${Object.entries(grupos).map(([nome, itens]) => {
              const celulasMeses = meses.map((m, idx) => {
                const mesNum = idx + 1;
                const itensMes = itens.filter(c => parseInt(c.mes_referencia) === mesNum);
                const total = itensMes.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
                const val = total > 0 ? formatMoeda(total) : '—';
                const cor = total > 0 ? 'var(--accent)' : 'var(--text-3)';
                return '<td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border);color:' + cor + '">' + val + '</td>';
              }).join('');
              return '<tr><td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border)">' + nome + '</td>' + celulasMeses + '</tr>';
            }).join('')}
            ${(function(){
              const celulasTotais = meses.map((m, idx) => {
                const mesNum = idx + 1;
                const totalMes = mensais.filter(c => parseInt(c.mes_referencia) === mesNum).reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
                return '<td style="padding:8px;font-size:14px;text-align:right;color:var(--accent);font-family:Syne,sans-serif;font-weight:800;border-bottom:1px solid var(--border)">' + (totalMes > 0 ? formatMoeda(totalMes) : '—') + '</td>';
              }).join('');
              return '<tr style="background:rgba(200,169,110,0.08);"><td style="padding:8px;font-size:14px;font-family:Syne,sans-serif;color:var(--accent);font-weight:700">TOTAL</td>' + celulasTotais + '</tr>';
            })()}
          </tbody>
        </table>
      </div>
    </div>`;
}

function abrirDepositoCF(custoId, nome) {
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Registrar deposito para: <strong>${nome}</strong></p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="dep-valor" /></div>
      <div class="input-group"><label>Data</label><input type="date" id="dep-data" value="${hoje()}" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="dep-obs" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarDepositoCF('${custoId}')">Registrar</button>
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

function editarCFBtn(btn) { abrirFormCustoFixo(JSON.parse(btn.dataset.c.replace(/&quot;/g,'"'))); }

function excluirCF(id) {
  confirmar('Excluir esta despesa?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CUSTOS_FIXOS, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CUSTOS_FIXOS]);
    renderCFMetricas();
    aplicarFiltrosCF();
    renderComparativoCF();
  });
}
