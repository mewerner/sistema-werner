// PESSOAL
function renderPessoal() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Pessoal</h1><p class="page-subtitle">Controle de salarios e provisoes</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormPessoal()">+ Nova Pessoa</button>
      </div>
    </div>
    <div id="ps-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div id="ps-lista"></div>
    <hr class="divider"/>
    <div style="margin-top:20px;">
      <h2 style="font-family:'Syne',sans-serif;font-size:16px;margin-bottom:16px;">Historico de Pagamentos</h2>
      <div id="ps-historico"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.PESSOAL, CONFIG.SHEETS.PESSOAL_PAGAMENTOS]);
    renderPSMetricas();
    renderListaPS();
    renderHistoricoPS();
  });
}

function renderPSMetricas() {
  const lista = (window.DB.pessoal || []).filter(p => p.ativo !== 'false');
  const totalSalarios = somarCampo(lista, 'salario_mensal');
  const decimo = lista.reduce((acc, p) => acc + (parseFloat(p.salario_mensal) || 0) / 12, 0);
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const pagamentos = window.DB.pessoal_pagamentos || [];
  const pagosMes = pagamentos.filter(p => parseInt(p.mes) === mesAtual && parseInt(p.ano) === anoAtual && p.tipo === 'Salario');
  const totalPagoMes = somarCampo(pagosMes, 'valor');
  document.getElementById('ps-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Pessoas ativas</div><div class="metric-value">${lista.length}</div></div>
    <div class="metric-card accent"><div class="metric-label">Folha mensal</div><div class="metric-value accent">${formatMoeda(totalSalarios)}</div></div>
    <div class="metric-card yellow"><div class="metric-label">Provisao 13o/mes</div><div class="metric-value yellow">${formatMoeda(decimo)}</div></div>
    <div class="metric-card green"><div class="metric-label">Pago este mes</div><div class="metric-value green">${formatMoeda(totalPagoMes)}</div></div>`;
}

function renderListaPS() {
  const lista = window.DB.pessoal || [];
  if (!lista.length) { document.getElementById('ps-lista').innerHTML = estadoVazio('Nenhuma pessoa cadastrada'); return; }
  const pagamentos = window.DB.pessoal_pagamentos || [];
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  document.getElementById('ps-lista').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${lista.map(p => {
        const salario = parseFloat(p.salario_mensal) || 0;
        const decimo = salario / 12;
        const pagoMes = pagamentos.filter(pg => pg.pessoal_id === p.id && parseInt(pg.mes) === mesAtual && parseInt(pg.ano) === anoAtual && pg.tipo === 'Salario');
        const totalPagoMes = somarCampo(pagoMes, 'valor');
        const totalDecimo = somarCampo(pagamentos.filter(pg => pg.pessoal_id === p.id && parseInt(pg.ano) === anoAtual && pg.tipo === 'Decimo'), 'valor');
        const pctDecimo = decimo * mesAtual > 0 ? Math.min((totalDecimo / (decimo * mesAtual)) * 100, 100) : 0;
        return `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;">${p.nome}</div>
              <div style="font-size:12px;color:var(--text-3)">${p.tipo} · Pag. dia ${p.dia_pagamento || '—'}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary btn-sm btn-icon" onclick="editarPSBtn(this)" data-p="${JSON.stringify(p).replace(/"/g,'&quot;')}">✏</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
            <div><div style="font-size:11px;color:var(--text-3)">Salario mensal</div><div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:var(--accent)">${formatMoeda(salario)}</div></div>
            <div style="text-align:right;"><div style="font-size:11px;color:var(--text-3)">Pago este mes</div><div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:${totalPagoMes>=salario?'var(--green)':'var(--yellow)'}">${formatMoeda(totalPagoMes)}</div></div>
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-bottom:6px;">Provisao 13o ${anoAtual}</div>
          <div class="progress-wrap"><div class="progress-bar ${pctDecimo>=100?'green':''}" style="width:${pctDecimo}%"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px;">
            <span style="color:var(--text-3)">${formatMoeda(totalDecimo)} reservado</span>
            <span style="color:var(--accent)">${formatMoeda(decimo * mesAtual)} esperado</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-primary btn-sm" onclick="abrirPagamentoPS('${p.id}','${p.nome}',${salario},'Salario')">Pagar salario</button>
            <button class="btn btn-secondary btn-sm" onclick="abrirPagamentoPS('${p.id}','${p.nome}',${decimo},'Decimo')">Provisao 13o</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderHistoricoPS() {
  const pagamentos = (window.DB.pessoal_pagamentos || []).sort((a,b) => new Date(b.data_pagamento) - new Date(a.data_pagamento)).slice(0, 20);
  const pessoas = window.DB.pessoal || [];
  if (!pagamentos.length) { document.getElementById('ps-historico').innerHTML = '<p style="color:var(--text-3);font-size:13px;">Nenhum pagamento registrado.</p>'; return; }
  document.getElementById('ps-historico').innerHTML = `
    <div class="table-wrapper">
      <table><thead><tr>
        <th>Pessoa</th><th>Tipo</th><th>Mes/Ano</th><th>Valor</th><th>Data pagamento</th><th>Obs</th><th></th>
      </tr></thead><tbody>
        ${pagamentos.map(pg => {
          const p = pessoas.find(x => x.id === pg.pessoal_id);
          return `<tr>
            <td><strong>${p ? p.nome : pg.pessoal_id}</strong></td>
            <td>${pg.tipo === 'Salario' ? '<span class="badge badge-blue">Salario</span>' : '<span class="badge badge-yellow">13o</span>'}</td>
            <td style="font-size:12px;color:var(--text-3)">${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][(parseInt(pg.mes)||1)-1]}/${pg.ano}</td>
            <td style="font-weight:600;color:var(--accent)">${formatMoeda(pg.valor)}</td>
            <td style="font-size:12px">${formatData(pg.data_pagamento)}</td>
            <td style="font-size:12px;color:var(--text-2)">${pg.observacoes || '—'}</td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="excluirPagamentoPS('${pg.id}')">🗑</button></td>
          </tr>`;
        }).join('')}
      </tbody></table>
    </div>`;
}

function abrirFormPessoal(p) {
  const edit = !!p;
  const v = (id) => p ? (p[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Nome *</label><input id="pf-nome" value="${v('nome')}" /></div>
      <div class="input-group"><label>Tipo</label>
        <select id="pf-tipo">
          <option ${v('tipo')==='Socio informal'||!v('tipo')?'selected':''}>Socio informal</option>
          <option ${v('tipo')==='Assalariado informal'?'selected':''}>Assalariado informal</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Salario mensal (R$) *</label><input type="number" step="0.01" id="pf-salario_mensal" value="${v('salario_mensal')}" /></div>
      <div class="input-group"><label>Dia de pagamento</label><input type="number" id="pf-dia_pagamento" value="${v('dia_pagamento')}" min="1" max="31" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="pf-obs" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarPessoal('${edit ? p.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar — ' + p.nome : 'Nova Pessoa', html, 'modal-sm');
}

async function salvarPessoal(id) {
  const obj = {
    nome: document.getElementById('pf-nome').value,
    tipo: document.getElementById('pf-tipo').value,
    salario_mensal: document.getElementById('pf-salario_mensal').value,
    dia_pagamento: document.getElementById('pf-dia_pagamento').value,
    observacoes: document.getElementById('pf-obs').value,
    ativo: 'true',
  };
  if (!obj.nome || !obj.salario_mensal) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  if (id) { obj.id = id; await Sheets.atualizar(CONFIG.SHEETS.PESSOAL, id, obj); mostrarToast('Atualizado', 'success'); }
  else { obj.id = gerarId(); obj.criado_em = hoje(); await Sheets.adicionar(CONFIG.SHEETS.PESSOAL, obj); mostrarToast('Pessoa cadastrada', 'success'); }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.PESSOAL]);
  renderPSMetricas();
  renderListaPS();
}

function abrirPagamentoPS(pessoalId, nome, valor, tipo) {
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Registrar ${tipo === 'Salario' ? 'salario' : 'provisao 13o'} para: <strong>${nome}</strong></p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor (R$) *</label><input type="number" step="0.01" id="pp-valor" value="${valor.toFixed(2)}" /></div>
      <div class="input-group"><label>Data de pagamento *</label><input type="date" id="pp-data" value="${hoje()}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Mes de referencia</label>
        <select id="pp-mes">${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>`<option value="${i+1}" ${mesAtual===i+1?'selected':''}>${m}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Ano</label><input type="number" id="pp-ano" value="${anoAtual}" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="pp-obs" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarPagamentoPS('${pessoalId}','${tipo}')">Registrar pagamento</button>
    </div>`;
  abrirModal('Registrar Pagamento', html, 'modal-sm');
}

async function salvarPagamentoPS(pessoalId, tipo) {
  const valor = document.getElementById('pp-valor').value;
  const data = document.getElementById('pp-data').value;
  if (!valor || !data) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  const obj = {
    id: gerarId(), pessoal_id: pessoalId, mes: document.getElementById('pp-mes').value,
    ano: document.getElementById('pp-ano').value, tipo, valor, data_pagamento: data,
    observacoes: document.getElementById('pp-obs').value,
  };
  await Sheets.adicionar(CONFIG.SHEETS.PESSOAL_PAGAMENTOS, obj);
  // Lanca no fluxo de caixa
  const pessoa = (window.DB.pessoal || []).find(p => p.id === pessoalId);
  await Sheets.adicionar(CONFIG.SHEETS.FLUXO_CAIXA, {
    id: gerarId(), data, descricao: (tipo === 'Salario' ? 'Salario' : 'Provisao 13o') + ' — ' + (pessoa?.nome || ''),
    categoria: 'Pessoal', tipo: 'Saida', valor, forma_pagamento: 'Dinheiro',
    conta: 'Caixa', criado_em: hoje(),
  });
  mostrarToast('Pagamento registrado', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.PESSOAL_PAGAMENTOS]);
  renderPSMetricas();
  renderListaPS();
  renderHistoricoPS();
}

function editarPSBtn(btn) { abrirFormPessoal(JSON.parse(btn.dataset.p.replace(/&quot;/g,'"'))); }

function excluirPagamentoPS(id) {
  confirmar('Excluir este pagamento?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.PESSOAL_PAGAMENTOS, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.PESSOAL_PAGAMENTOS]);
    renderPSMetricas();
    renderListaPS();
    renderHistoricoPS();
  });
}
