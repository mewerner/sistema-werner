// COMBUSTIVEL
function renderCombustivel() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Combustivel</h1><p class="page-subtitle">Controle de abastecimentos</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="abrirFormVeiculo()">+ Veiculo</button>
        <button class="btn btn-primary" onclick="abrirFormCombustivel()">+ Abastecimento</button>
      </div>
    </div>
    <div id="comb-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarComb('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarComb('avista',this)">A vista</button>
      <button class="filter-btn" onclick="filtrarComb('prazo',this)">A prazo</button>
      <select id="comb-veiculo" onchange="aplicarFiltrosComb()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todos os veiculos</option>
      </select>
      <select id="comb-periodo" onchange="aplicarFiltrosComb()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="30">Ultimos 30 dias</option>
        <option value="7">Ultimos 7 dias</option>
        <option value="90">Ultimos 90 dias</option>
        <option value="0">Tudo</option>
      </select>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <span style="font-size:13px;font-weight:500;">Lancamentos</span>
        <span id="comb-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="comb-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.COMBUSTIVEL, CONFIG.SHEETS.VEICULOS]);
    popularSelectVeiculos();
    renderCombMetricas();
    aplicarFiltrosComb();
  });
}

function popularSelectVeiculos() {
  const sel = document.getElementById('comb-veiculo');
  if (!sel) return;
  const veiculos = window.DB.veiculos || [];
  veiculos.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.nome + (v.placa ? ' - ' + v.placa : '');
    sel.appendChild(opt);
  });
}

function renderCombMetricas() {
  const todos = window.DB.combustivel || [];
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const doMes = todos.filter(c => {
    const d = new Date(c.data + 'T00:00:00');
    return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
  });
  const totalMes = somarCampo(doMes, 'valor_total');
  const totalGeral = somarCampo(todos, 'valor_total');
  const totalLitros = somarCampo(doMes, 'litros');
  const kmL = doMes.reduce((acc, c) => acc + (parseFloat(c.km_litro) || 0), 0) / (doMes.filter(c => c.km_litro).length || 1);
  document.getElementById('comb-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Gasto no mes</div><div class="metric-value accent">${formatMoeda(totalMes)}</div></div>
    <div class="metric-card"><div class="metric-label">Total geral</div><div class="metric-value">${formatMoeda(totalGeral)}</div></div>
    <div class="metric-card"><div class="metric-label">Litros no mes</div><div class="metric-value">${totalLitros.toFixed(1)}L</div></div>
    <div class="metric-card"><div class="metric-label">Media km/L</div><div class="metric-value">${kmL > 0 ? kmL.toFixed(1) : '—'}</div></div>`;
}

window._combTipo = 'todos';

function filtrarComb(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._combTipo = tipo;
  aplicarFiltrosComb();
}

function aplicarFiltrosComb() {
  let lista = window.DB.combustivel || [];
  const periodo = parseInt(document.getElementById('comb-periodo')?.value || '30');
  const veiculo = document.getElementById('comb-veiculo')?.value || '';
  if (periodo > 0) {
    const lim = new Date(); lim.setDate(lim.getDate() - periodo);
    lista = lista.filter(c => new Date(c.data + 'T00:00:00') >= lim);
  }
  if (veiculo) lista = lista.filter(c => c.veiculo_id === veiculo);
  if (window._combTipo === 'avista') lista = lista.filter(c => c.tipo_lancamento === 'A vista');
  if (window._combTipo === 'prazo') lista = lista.filter(c => c.tipo_lancamento === 'A prazo');
  lista = lista.sort((a, b) => new Date(b.data) - new Date(a.data));
  renderTabelaComb(lista);
}

function renderTabelaComb(lista) {
  document.getElementById('comb-count').textContent = lista.length + ' registros';
  if (!lista.length) { document.getElementById('comb-table').innerHTML = estadoVazio('Nenhum abastecimento registrado'); return; }
  const veiculos = window.DB.veiculos || [];
  document.getElementById('comb-table').innerHTML = `
    <table><thead><tr>
      <th>Data</th><th>Veiculo</th><th>Motorista</th><th>Litros</th><th>R$/L</th><th>Total</th><th>KM</th><th>KM/L</th><th>Posto</th><th>Tipo</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c => {
        const v = veiculos.find(x => x.id === c.veiculo_id);
        return `<tr>
          <td style="color:var(--text-3)">${formatData(c.data)}</td>
          <td>${v ? v.nome : c.veiculo_id || '—'}</td>
          <td>${c.motorista || '—'}</td>
          <td>${c.litros ? c.litros + 'L' : '—'}</td>
          <td style="color:var(--text-2)">${c.valor_litro ? formatMoeda(c.valor_litro) : '—'}</td>
          <td style="font-weight:600;color:var(--accent)">${formatMoeda(c.valor_total)}</td>
          <td style="font-size:12px">${c.km_atual ? c.km_atual + 'km' : '—'}</td>
          <td style="font-size:12px">${c.km_litro ? c.km_litro + 'km/L' : '—'}</td>
          <td style="font-size:12px">${c.posto || '—'}</td>
          <td><span class="badge ${c.tipo_lancamento === 'A vista' ? 'badge-green' : 'badge-yellow'}">${c.tipo_lancamento || '—'}</span></td>
          <td>${c.tipo_lancamento === 'A prazo' ? badgeStatus(c.status || 'Pendente') : '—'}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCombBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="excluirComb('${c.id}')">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
}

function abrirFormCombustivel(c) {
  const edit = !!c;
  const veiculos = (window.DB.veiculos || []).filter(v => v.ativo !== 'false');
  const v = (id) => c ? (c[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Data *</label><input type="date" id="cb-data" value="${v('data') || hoje()}" /></div>
      <div class="input-group"><label>Veiculo *</label>
        <select id="cb-veiculo_id">
          <option value="">Selecione...</option>
          ${veiculos.map(x => `<option value="${x.id}" ${v('veiculo_id') === x.id ? 'selected' : ''}>${x.nome}${x.placa ? ' - ' + x.placa : ''}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Motorista</label><input id="cb-motorista" value="${v('motorista')}" /></div>
      <div class="input-group"><label>Posto</label><input id="cb-posto" value="${v('posto')}" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Litros</label><input type="number" step="0.01" id="cb-litros" value="${v('litros')}" oninput="calcComb()" /></div>
      <div class="input-group"><label>Valor por litro (R$)</label><input type="number" step="0.01" id="cb-valor_litro" value="${v('valor_litro')}" oninput="calcComb()" /></div>
      <div class="input-group"><label>Total (R$)</label><input type="number" step="0.01" id="cb-valor_total" value="${v('valor_total')}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>KM atual</label><input type="number" id="cb-km_atual" value="${v('km_atual')}" oninput="calcKmL()" /></div>
      <div class="input-group"><label>KM/Litro</label><input type="number" step="0.01" id="cb-km_litro" value="${v('km_litro')}" readonly style="opacity:0.6;" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Forma de pagamento</label>
        <select id="cb-forma_pagamento">
          ${['PIX','Dinheiro','Cartao','Boleto'].map(x => `<option ${v('forma_pagamento') === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Tipo de lancamento</label>
        <select id="cb-tipo_lancamento" onchange="toggleVencComb()">
          <option ${v('tipo_lancamento') === 'A vista' || !v('tipo_lancamento') ? 'selected' : ''}>A vista</option>
          <option ${v('tipo_lancamento') === 'A prazo' ? 'selected' : ''}>A prazo</option>
        </select>
      </div>
    </div>
    <div id="cb-venc-wrap" class="input-group" style="display:none;">
      <label>Data de vencimento</label>
      <input type="date" id="cb-data_vencimento" value="${v('data_vencimento')}" />
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="cb-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarComb('${edit ? c.id : ''}')">${edit ? 'Salvar' : 'Registrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Abastecimento' : 'Novo Abastecimento', html, 'modal-lg');
  toggleVencComb();
}

function calcComb() {
  const litros = parseFloat(document.getElementById('cb-litros')?.value) || 0;
  const valorL = parseFloat(document.getElementById('cb-valor_litro')?.value) || 0;
  if (litros && valorL) document.getElementById('cb-valor_total').value = (litros * valorL).toFixed(2);
}

function calcKmL() {
  // Busca ultimo KM do veiculo para calcular km/L
  const kmAtual = parseFloat(document.getElementById('cb-km_atual')?.value) || 0;
  const litros = parseFloat(document.getElementById('cb-litros')?.value) || 0;
  const veiculoId = document.getElementById('cb-veiculo_id')?.value;
  if (!kmAtual || !litros || !veiculoId) return;
  const historico = (window.DB.combustivel || [])
    .filter(c => c.veiculo_id === veiculoId && c.km_atual && parseFloat(c.km_atual) < kmAtual)
    .sort((a, b) => parseFloat(b.km_atual) - parseFloat(a.km_atual));
  if (historico.length) {
    const kmAnterior = parseFloat(historico[0].km_atual);
    const kmRodados = kmAtual - kmAnterior;
    document.getElementById('cb-km_litro').value = (kmRodados / litros).toFixed(2);
  }
}

function toggleVencComb() {
  const tipo = document.getElementById('cb-tipo_lancamento')?.value;
  const wrap = document.getElementById('cb-venc-wrap');
  if (wrap) wrap.style.display = tipo === 'A prazo' ? '' : 'none';
}

async function salvarComb(id) {
  const obj = {
    data: document.getElementById('cb-data').value,
    veiculo_id: document.getElementById('cb-veiculo_id').value,
    motorista: document.getElementById('cb-motorista').value,
    posto: document.getElementById('cb-posto').value,
    litros: document.getElementById('cb-litros').value,
    valor_litro: document.getElementById('cb-valor_litro').value,
    valor_total: document.getElementById('cb-valor_total').value,
    km_atual: document.getElementById('cb-km_atual').value,
    km_litro: document.getElementById('cb-km_litro').value,
    forma_pagamento: document.getElementById('cb-forma_pagamento').value,
    tipo_lancamento: document.getElementById('cb-tipo_lancamento').value,
    data_vencimento: document.getElementById('cb-data_vencimento')?.value || '',
    observacoes: document.getElementById('cb-observacoes').value,
    status: document.getElementById('cb-tipo_lancamento').value === 'A prazo' ? 'Pendente' : 'Pago',
  };
  if (!obj.data || !obj.veiculo_id || !obj.valor_total) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    await Sheets.atualizar(CONFIG.SHEETS.COMBUSTIVEL, id, obj);
    mostrarToast('Atualizado', 'success');
  } else {
    obj.id = gerarId();
    await Sheets.adicionar(CONFIG.SHEETS.COMBUSTIVEL, obj);
    // Se a prazo, lanca no contas a pagar
    if (obj.tipo_lancamento === 'A prazo') {
      const cp = {
        id: gerarId(), descricao: 'Combustivel - ' + (obj.posto || ''),
        valor_total: obj.valor_total, valor_parcela: obj.valor_total,
        parcela_num: '1', parcela_total: '1',
        data_emissao: obj.data, data_vencimento: obj.data_vencimento,
        categoria: 'Combustivel', status: 'Pendente', criado_em: hoje(),
      };
      await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, cp);
    }
    mostrarToast('Registrado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.COMBUSTIVEL]);
  renderCombMetricas();
  aplicarFiltrosComb();
}

function editarCombBtn(btn) { abrirFormCombustivel(JSON.parse(btn.dataset.c.replace(/&quot;/g, '"'))); }

function excluirComb(id) {
  confirmar('Excluir este abastecimento?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.COMBUSTIVEL, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.COMBUSTIVEL]);
    renderCombMetricas();
    aplicarFiltrosComb();
  });
}

// VEICULOS
function abrirFormVeiculo(v) {
  const edit = !!v;
  const val = (id) => v ? (v[id] || '') : '';
  const html = `
    <div class="input-group"><label>Nome *</label><input id="vv-nome" value="${val('nome')}" placeholder="Ex: Courier, Carro do Avo" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>Placa</label><input id="vv-placa" value="${val('placa')}" /></div>
      <div class="input-group"><label>Modelo/Ano</label><input id="vv-modelo_ano" value="${val('modelo_ano')}" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="vv-observacoes" rows="2">${val('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarVeiculo('${edit ? v.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Veiculo' : 'Novo Veiculo', html, 'modal-sm');
}

async function salvarVeiculo(id) {
  const obj = {
    nome: document.getElementById('vv-nome').value,
    placa: document.getElementById('vv-placa').value,
    modelo_ano: document.getElementById('vv-modelo_ano').value,
    observacoes: document.getElementById('vv-observacoes').value,
    ativo: 'true',
  };
  if (!obj.nome) { mostrarToast('Nome obrigatorio', 'error'); return; }
  if (id) { obj.id = id; await Sheets.atualizar(CONFIG.SHEETS.VEICULOS, id, obj); }
  else { obj.id = gerarId(); await Sheets.adicionar(CONFIG.SHEETS.VEICULOS, obj); }
  mostrarToast('Veiculo salvo', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.VEICULOS]);
  popularSelectVeiculos();
}
