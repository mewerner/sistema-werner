// ESTOQUE
function renderEstoque() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Estoque</h1><p class="page-subtitle">Controle de materiais</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="abrirFormEntradaManual()">+ Entrada Manual</button>
        <button class="btn btn-primary" onclick="abrirFormItemEstoque()">+ Novo Item</button>
      </div>
    </div>
    <div id="est-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarEst('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarEst('baixo',this)">Abaixo do Minimo</button>
      ${['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Seguranca','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'].map(s=>
        `<button class="filter-btn" onclick="filtrarEst('${s}',this)">${s}</button>`).join('')}
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar material..." oninput="buscarEst(this.value)" />
        <span id="est-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="est-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.ESTOQUE, CONFIG.SHEETS.ESTOQUE_HISTORICO]);
    renderEstMetricas();
    aplicarFiltrosEst();
  });
}

function renderEstMetricas() {
  const lista = window.DB.estoque || [];
  const totalItens = lista.length;
  const totalValor = lista.reduce((acc, i) => acc + (parseFloat(i.valor_unitario_medio) || 0) * (parseFloat(i.quantidade) || 0), 0);
  const abaixoMin = lista.filter(i => parseFloat(i.quantidade) <= parseFloat(i.quantidade_minima)).length;
  const zerados = lista.filter(i => parseFloat(i.quantidade) <= 0).length;
  document.getElementById('est-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total de itens</div><div class="metric-value">${totalItens}</div></div>
    <div class="metric-card accent"><div class="metric-label">Valor em estoque</div><div class="metric-value accent">${formatMoeda(totalValor)}</div></div>
    <div class="metric-card yellow"><div class="metric-label">Abaixo do minimo</div><div class="metric-value yellow">${abaixoMin}</div></div>
    <div class="metric-card red"><div class="metric-label">Zerados</div><div class="metric-value red">${zerados}</div></div>`;
}

window._estFiltro = 'todos';
window._estBusca = '';

function filtrarEst(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._estFiltro = tipo;
  aplicarFiltrosEst();
}

function buscarEst(q) { window._estBusca = q.toLowerCase(); aplicarFiltrosEst(); }

function aplicarFiltrosEst() {
  let lista = window.DB.estoque || [];
  if (window._estFiltro === 'baixo') lista = lista.filter(i => parseFloat(i.quantidade) <= parseFloat(i.quantidade_minima));
  else if (window._estFiltro !== 'todos') lista = lista.filter(i => i.segmento === window._estFiltro);
  if (window._estBusca) lista = lista.filter(i => i.nome.toLowerCase().includes(window._estBusca));
  lista = lista.sort((a, b) => a.nome.localeCompare(b.nome));
  renderTabelaEst(lista);
}

function renderTabelaEst(lista) {
  document.getElementById('est-count').textContent = lista.length + ' itens';
  if (!lista.length) { document.getElementById('est-table').innerHTML = estadoVazio('Nenhum item no estoque'); return; }
  document.getElementById('est-table').innerHTML = `
    <table><thead><tr>
      <th>Nome</th><th>Segmento</th><th>Quantidade</th><th>Minimo</th><th>Unidade</th><th>Valor Unit.</th><th>Valor Total</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(i => {
        const qtd = parseFloat(i.quantidade) || 0;
        const min = parseFloat(i.quantidade_minima) || 0;
        const valorUnit = parseFloat(i.valor_unitario_medio) || 0;
        const abaixo = qtd <= min;
        const zerado = qtd <= 0;
        let statusBadge = '<span class="badge badge-green">OK</span>';
        if (zerado) statusBadge = '<span class="badge badge-red">Zerado</span>';
        else if (abaixo) statusBadge = '<span class="badge badge-yellow">Baixo</span>';
        return `<tr style="${abaixo ? 'background:rgba(240,192,64,0.03)' : ''}">
          <td><strong>${i.nome}</strong></td>
          <td><span class="badge badge-gray">${i.segmento || '—'}</span></td>
          <td style="font-family:'Syne',sans-serif;font-weight:600;color:${zerado?'var(--red)':abaixo?'var(--yellow)':'var(--text)'}">${qtd}</td>
          <td style="color:var(--text-3)">${min || '—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${i.unidade || '—'}</td>
          <td>${valorUnit > 0 ? formatMoeda(valorUnit) : '—'}</td>
          <td style="color:var(--accent)">${valorUnit > 0 ? formatMoeda(valorUnit * qtd) : '—'}</td>
          <td>${statusBadge}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="verHistoricoEst('${i.id}','${i.nome}')">Hist.</button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="editarEstBtn(this)" data-i="${JSON.stringify(i).replace(/"/g,'&quot;')}">✏</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="excluirEst('${i.id}')">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
}

function abrirFormItemEstoque(item) {
  const edit = !!item;
  const v = (id) => item ? (item[id] || '') : '';
  const segs = ['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Seguranca','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'];
  const units = ['unidade','peca','m','m²','m³','kg','litro','chapa','rolo','caixa'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Nome do material *</label><input id="ei-nome" value="${v('nome')}" /></div>
      <div class="input-group"><label>Segmento</label>
        <select id="ei-segmento">${segs.map(s => `<option ${v('segmento')===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Quantidade atual</label><input type="number" step="0.01" id="ei-quantidade" value="${v('quantidade') || '0'}" /></div>
      <div class="input-group"><label>Quantidade minima</label><input type="number" step="0.01" id="ei-quantidade_minima" value="${v('quantidade_minima') || '0'}" /></div>
      <div class="input-group"><label>Unidade</label>
        <select id="ei-unidade">${units.map(u => `<option ${v('unidade')===u?'selected':''}>${u}</option>`).join('')}</select>
      </div>
    </div>
    <div class="input-group"><label>Valor unitario medio (R$)</label><input type="number" step="0.01" id="ei-valor_unitario_medio" value="${v('valor_unitario_medio')}" /></div>
    <div class="input-group" style="margin-top:16px;"><label>Observacoes</label><textarea id="ei-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarItemEstoque('${edit ? item.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Item' : 'Novo Item no Estoque', html, 'modal-lg');
}

async function salvarItemEstoque(id) {
  const qtd = parseFloat(document.getElementById('ei-quantidade').value) || 0;
  const valorUnit = parseFloat(document.getElementById('ei-valor_unitario_medio').value) || 0;
  const obj = {
    nome: document.getElementById('ei-nome').value,
    segmento: document.getElementById('ei-segmento').value,
    quantidade: qtd,
    quantidade_minima: document.getElementById('ei-quantidade_minima').value,
    unidade: document.getElementById('ei-unidade').value,
    valor_unitario_medio: valorUnit,
    valor_total: (qtd * valorUnit).toFixed(2),
    observacoes: document.getElementById('ei-observacoes').value,
    atualizado_em: hoje(),
  };
  if (!obj.nome) { mostrarToast('Nome obrigatorio', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) { obj.id = id; await Sheets.atualizar(CONFIG.SHEETS.ESTOQUE, id, obj); mostrarToast('Item atualizado', 'success'); }
  else { obj.id = gerarId(); await Sheets.adicionar(CONFIG.SHEETS.ESTOQUE, obj); mostrarToast('Item cadastrado', 'success'); }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.ESTOQUE]);
  renderEstMetricas();
  aplicarFiltrosEst();
}

function abrirFormEntradaManual() {
  const lista = window.DB.estoque || [];
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Registrar entrada ou saida manual de material no estoque.</p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Material *</label>
        <select id="em-item_id">
          <option value="">Selecione...</option>
          ${lista.map(i => `<option value="${i.id}">${i.nome} (${i.quantidade} ${i.unidade})</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Tipo *</label>
        <select id="em-tipo">
          <option value="entrada">Entrada</option>
          <option value="saida">Saida</option>
          <option value="ajuste">Ajuste de inventario</option>
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Quantidade *</label><input type="number" step="0.01" id="em-quantidade" /></div>
      <div class="input-group"><label>Valor unitario (R$)</label><input type="number" step="0.01" id="em-valor_unitario" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Data</label><input type="date" id="em-data" value="${hoje()}" /></div>
      <div class="input-group"><label>Motivo</label><input id="em-motivo" placeholder="Ex: Ajuste inventario, perda..." /></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEntradaManual()">Registrar</button>
    </div>`;
  abrirModal('Entrada/Saida Manual', html, 'modal-lg');
}

async function salvarEntradaManual() {
  const itemId = document.getElementById('em-item_id').value;
  const tipo = document.getElementById('em-tipo').value;
  const qtd = parseFloat(document.getElementById('em-quantidade').value) || 0;
  const valorUnit = parseFloat(document.getElementById('em-valor_unitario').value) || 0;
  if (!itemId || !qtd) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  const item = (window.DB.estoque || []).find(i => i.id === itemId);
  if (!item) return;
  let novaQtd = parseFloat(item.quantidade) || 0;
  if (tipo === 'entrada') novaQtd += qtd;
  else if (tipo === 'saida') novaQtd -= qtd;
  else novaQtd = qtd;
  const novoValorMedio = valorUnit > 0 ? valorUnit : parseFloat(item.valor_unitario_medio) || 0;
  await Sheets.atualizar(CONFIG.SHEETS.ESTOQUE, itemId, {
    ...item, quantidade: novaQtd.toFixed(2),
    valor_unitario_medio: novoValorMedio,
    valor_total: (novaQtd * novoValorMedio).toFixed(2),
    atualizado_em: hoje(),
  });
  await Sheets.adicionar(CONFIG.SHEETS.ESTOQUE_HISTORICO, {
    id: gerarId(), estoque_id: itemId, tipo, quantidade: qtd,
    valor_unitario: valorUnit, data: document.getElementById('em-data').value,
    motivo: document.getElementById('em-motivo').value,
  });
  mostrarToast('Entrada registrada', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.ESTOQUE]);
  renderEstMetricas();
  aplicarFiltrosEst();
}

async function verHistoricoEst(itemId, nome) {
  await carregarDados([CONFIG.SHEETS.ESTOQUE_HISTORICO]);
  const hist = (window.DB.estoque_historico || []).filter(h => h.estoque_id === itemId).sort((a,b) => new Date(b.data) - new Date(a.data));
  const html = `
    ${hist.length === 0 ? '<p style="color:var(--text-3)">Nenhum historico de movimentacao.</p>' : `
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Data</th>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Tipo</th>
        <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Qtd</th>
        <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Valor Unit.</th>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Motivo</th>
      </tr></thead>
      <tbody>
        ${hist.map(h => `<tr>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border);color:var(--text-3)">${formatData(h.data)}</td>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border)">${h.tipo === 'entrada' ? '<span class="badge badge-green">Entrada</span>' : h.tipo === 'saida' ? '<span class="badge badge-red">Saida</span>' : '<span class="badge badge-yellow">Ajuste</span>'}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border);font-weight:600">${h.quantidade}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${h.valor_unitario > 0 ? formatMoeda(h.valor_unitario) : '—'}</td>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border);color:var(--text-2)">${h.motivo || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Fechar</button></div>`;
  abrirModal('Historico — ' + nome, html, 'modal-lg');
}

function editarEstBtn(btn) { abrirFormItemEstoque(JSON.parse(btn.dataset.i.replace(/&quot;/g,'"'))); }

function excluirEst(id) {
  confirmar('Excluir este item do estoque?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.ESTOQUE, id);
    mostrarToast('Item excluido', 'success');
    await carregarDados([CONFIG.SHEETS.ESTOQUE]);
    renderEstMetricas();
    aplicarFiltrosEst();
  });
}
