// ORCAMENTOS
function renderOrcamentos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Orcamentos</h1><p class="page-subtitle">Propostas e orcamentos de servicos</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormOrcamento()">+ Novo Orcamento</button>
      </div>
    </div>
    <div id="orc-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarOrc('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarOrc('Rascunho',this)">Rascunho</button>
      <button class="filter-btn" onclick="filtrarOrc('Enviado',this)">Enviado</button>
      <button class="filter-btn" onclick="filtrarOrc('Aprovado',this)">Aprovado</button>
      <button class="filter-btn" onclick="filtrarOrc('Recusado',this)">Recusado</button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar orcamento..." oninput="buscarOrc(this.value)" />
        <span id="orc-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="orc-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS, CONFIG.SHEETS.ORCAMENTO_ITENS, CONFIG.SHEETS.CLIENTES]);
    renderOrcMetricas();
    aplicarFiltrosOrc();
  });
}

function renderOrcMetricas() {
  const lista = window.DB.orcamentos || [];
  const aprovados = lista.filter(o => o.status === 'Aprovado');
  const enviados = lista.filter(o => o.status === 'Enviado');
  const recusados = lista.filter(o => o.status === 'Recusado');
  const totalAprov = somarCampo(aprovados, 'valor_final');
  const taxaConv = (enviados.length + aprovados.length) > 0 ? (aprovados.length / (enviados.length + aprovados.length) * 100).toFixed(0) : 0;
  document.getElementById('orc-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total de orcamentos</div><div class="metric-value">${lista.length}</div></div>
    <div class="metric-card green"><div class="metric-label">Aprovados</div><div class="metric-value green">${aprovados.length}</div><div class="metric-sub">${formatMoeda(totalAprov)}</div></div>
    <div class="metric-card yellow"><div class="metric-label">Aguardando resposta</div><div class="metric-value yellow">${enviados.length}</div></div>
    <div class="metric-card accent"><div class="metric-label">Taxa de conversao</div><div class="metric-value accent">${taxaConv}%</div></div>`;
}

window._orcFiltro = 'todos';
window._orcBusca = '';

function filtrarOrc(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._orcFiltro = tipo;
  aplicarFiltrosOrc();
}

function buscarOrc(q) { window._orcBusca = q.toLowerCase(); aplicarFiltrosOrc(); }

function aplicarFiltrosOrc() {
  let lista = window.DB.orcamentos || [];
  if (window._orcFiltro !== 'todos') lista = lista.filter(o => o.status === window._orcFiltro);
  if (window._orcBusca) lista = lista.filter(o => (o.numero + o.cliente_nome + o.descricao).toLowerCase().includes(window._orcBusca));
  lista = lista.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
  renderTabelaOrc(lista);
}

function renderTabelaOrc(lista) {
  document.getElementById('orc-count').textContent = lista.length + ' orcamentos';
  if (!lista.length) { document.getElementById('orc-table').innerHTML = estadoVazio('Nenhum orcamento encontrado'); return; }
  document.getElementById('orc-table').innerHTML = `
    <table><thead><tr>
      <th>No</th><th>Data</th><th>Cliente</th><th>Descricao</th><th>Valor</th><th>Validade</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(o => `<tr>
        <td style="color:var(--text-3)">${o.numero || '—'}</td>
        <td style="font-size:12px">${formatData(o.data)}</td>
        <td><strong>${o.cliente_nome || '—'}</strong></td>
        <td style="font-size:12px;color:var(--text-2)">${o.descricao || '—'}</td>
        <td style="font-weight:600;color:var(--accent)">${formatMoeda(o.valor_final)}</td>
        <td style="font-size:12px">${o.validade ? formatData(o.validade) : '—'}</td>
        <td>${badgeStatus(o.status || 'Rascunho')}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="verOrcamento('${o.id}')">Ver</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarOrcBtn(this)" data-o="${JSON.stringify(o).replace(/"/g,'&quot;')}">✏</button>
          ${o.status === 'Aprovado' ? `<button class="btn btn-success btn-sm" onclick="converterEmProjeto('${o.id}')">→ Projeto</button>` : ''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirOrc('${o.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormOrcamento(o) {
  const edit = !!o;
  const clientes = window.DB.clientes || [];
  const v = (id) => o ? (o[id] || '') : '';
  const ambientes = ['Cozinha','Quarto','Sala','Escritorio','Banheiro','Area de servico','Varanda','Externo','Outro'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Cliente *</label>
        <select id="oc-cliente_id">
          <option value="">Selecione...</option>
          ${clientes.map(c => `<option value="${c.id}" data-nome="${c.nome}" data-cidade="${c.cidade||''}" ${v('cliente_id')===c.id?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Data *</label><input type="date" id="oc-data" value="${v('data') || hoje()}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Validade do orcamento</label><input type="date" id="oc-validade" value="${v('validade')}" /></div>
      <div class="input-group"><label>Status</label>
        <select id="oc-status">
          ${['Rascunho','Enviado','Aprovado','Recusado'].map(s => `<option ${v('status')===s||(!v('status')&&s==='Rascunho')?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <hr class="divider"/>
    <div class="form-row cols-2">
      <div class="input-group"><label>Descricao do servico *</label><input id="oc-descricao" value="${v('descricao')}" placeholder="Ex: Cozinha planejada em MDF" /></div>
      <div class="input-group"><label>Ambiente</label>
        <select id="oc-ambiente">${ambientes.map(a => `<option ${v('ambiente')===a?'selected':''}>${a}</option>`).join('')}</select>
      </div>
    </div>
    <div class="input-group"><label>Dimensoes (LxAxP)</label><input id="oc-dimensoes" value="${v('dimensoes')}" placeholder="Ex: 3,50m x 2,20m x 0,60m" /></div>
    <hr class="divider"/>
    <div class="form-row cols-2">
      <div class="input-group"><label>Total materiais — custo interno (R$)</label><input type="number" step="0.01" id="oc-total_materiais_custo" value="${v('total_materiais_custo')}" oninput="calcOrcTotal()" /></div>
      <div class="input-group"><label>Total materiais — preco venda (R$)</label><input type="number" step="0.01" id="oc-total_materiais_venda" value="${v('total_materiais_venda')}" oninput="calcOrcTotal()" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Mao de obra (R$)</label><input type="number" step="0.01" id="oc-mao_obra" value="${v('mao_obra')}" oninput="calcOrcTotal()" /></div>
      <div class="input-group"><label>Custos indiretos (R$)</label><input type="number" step="0.01" id="oc-custos_indiretos" value="${v('custos_indiretos')}" oninput="calcOrcTotal()" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Margem de lucro (%)</label><input type="number" step="0.1" id="oc-margem_pct" value="${v('margem_pct') || '30'}" oninput="calcOrcTotal()" /></div>
      <div class="input-group"><label>Considerar imposto?</label>
        <select id="oc-considerar_imposto" onchange="calcOrcTotal()">
          <option value="nao" ${v('considerar_imposto')==='nao'||!v('considerar_imposto')?'selected':''}>Nao</option>
          <option value="sim" ${v('considerar_imposto')==='sim'?'selected':''}>Sim</option>
        </select>
      </div>
      <div class="input-group"><label>VALOR FINAL (R$)</label>
        <input type="number" step="0.01" id="oc-valor_final" value="${v('valor_final')}" style="font-weight:700;color:var(--accent);" />
      </div>
    </div>
    <hr class="divider"/>
    <div class="form-row cols-2">
      <div class="input-group"><label>Forma de pagamento</label><input id="oc-forma_pagamento" value="${v('forma_pagamento')}" placeholder="Ex: 50% entrada + 50% entrega" /></div>
      <div class="input-group"><label>Prazo de entrega estimado</label><input id="oc-prazo_entrega" value="${v('prazo_entrega')}" placeholder="Ex: 45 dias uteis" /></div>
    </div>
    <div class="input-group"><label>Garantia</label><input id="oc-garantia" value="${v('garantia') || '180 dias conforme CDC art. 50'}" /></div>
    <div class="input-group"><label>Observacoes</label><textarea id="oc-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarOrcamento('${edit ? o.id : ''}')">${edit ? 'Salvar' : 'Criar orcamento'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Orcamento' : 'Novo Orcamento', html, 'modal-lg');
  calcOrcTotal();
}

function calcOrcTotal() {
  const matVenda = parseFloat(document.getElementById('oc-total_materiais_venda')?.value) || 0;
  const maoObra = parseFloat(document.getElementById('oc-mao_obra')?.value) || 0;
  const indiretos = parseFloat(document.getElementById('oc-custos_indiretos')?.value) || 0;
  const margem = parseFloat(document.getElementById('oc-margem_pct')?.value) || 0;
  const imposto = document.getElementById('oc-considerar_imposto')?.value === 'sim';
  const subtotal = matVenda + maoObra + indiretos;
  const comMargem = subtotal * (1 + margem / 100);
  const aliquota = imposto ? (CONFIG.DEFAULTS?.ALIQUOTA_SIMPLES || 0.06) : 0;
  const final = comMargem * (1 + aliquota);
  const el = document.getElementById('oc-valor_final');
  if (el) el.value = final.toFixed(2);
}

async function salvarOrcamento(id) {
  const sel = document.getElementById('oc-cliente_id');
  const opt = sel.options[sel.selectedIndex];
  const obj = {
    cliente_id: sel.value,
    cliente_nome: sel.value ? (opt.dataset.nome || '') : '',
    data: document.getElementById('oc-data').value,
    validade: document.getElementById('oc-validade').value,
    status: document.getElementById('oc-status').value,
    descricao: document.getElementById('oc-descricao').value,
    ambiente: document.getElementById('oc-ambiente').value,
    dimensoes: document.getElementById('oc-dimensoes').value,
    total_materiais_custo: document.getElementById('oc-total_materiais_custo').value,
    total_materiais_venda: document.getElementById('oc-total_materiais_venda').value,
    mao_obra: document.getElementById('oc-mao_obra').value,
    custos_indiretos: document.getElementById('oc-custos_indiretos').value,
    margem_pct: document.getElementById('oc-margem_pct').value,
    considerar_imposto: document.getElementById('oc-considerar_imposto').value,
    valor_final: document.getElementById('oc-valor_final').value,
    forma_pagamento: document.getElementById('oc-forma_pagamento').value,
    prazo_entrega: document.getElementById('oc-prazo_entrega').value,
    garantia: document.getElementById('oc-garantia').value,
    observacoes: document.getElementById('oc-observacoes').value,
  };
  if (!obj.cliente_id || !obj.descricao || !obj.valor_final) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id; obj.atualizado_em = hoje();
    await Sheets.atualizar(CONFIG.SHEETS.ORCAMENTOS, id, obj);
    mostrarToast('Orcamento atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.numero = gerarNumero('ORC', window.DB.orcamentos || []);
    obj.criado_em = hoje(); obj.atualizado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.ORCAMENTOS, obj);
    mostrarToast('Orcamento criado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.ORCAMENTOS]);
  renderOrcMetricas();
  aplicarFiltrosOrc();
}

function verOrcamento(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  const custo = parseFloat(o.total_materiais_custo || 0) + parseFloat(o.mao_obra || 0) + parseFloat(o.custos_indiretos || 0);
  const lucro = parseFloat(o.valor_final || 0) - custo;
  const margem = parseFloat(o.valor_final) > 0 ? (lucro / parseFloat(o.valor_final) * 100).toFixed(1) : '0';
  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px;">
      <div><span style="color:var(--text-3)">No</span><br><strong>${o.numero}</strong></div>
      <div><span style="color:var(--text-3)">Data</span><br>${formatData(o.data)}</div>
      <div><span style="color:var(--text-3)">Validade</span><br>${o.validade ? formatData(o.validade) : '—'}</div>
      <div><span style="color:var(--text-3)">Cliente</span><br>${o.cliente_nome}</div>
      <div><span style="color:var(--text-3)">Ambiente</span><br>${o.ambiente || '—'}</div>
      <div><span style="color:var(--text-3)">Dimensoes</span><br>${o.dimensoes || '—'}</div>
    </div>
    <div style="background:var(--bg-3);border-radius:var(--radius);padding:12px;margin-bottom:16px;font-size:13px;">
      <strong>${o.descricao}</strong>
    </div>
    <hr class="divider"/>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div>
        <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Composicao do preco</div>
        <table style="width:100%;font-size:13px;">
          <tr><td style="padding:4px 0;color:var(--text-2)">Materiais (venda)</td><td style="text-align:right">${formatMoeda(o.total_materiais_venda)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Mao de obra</td><td style="text-align:right">${formatMoeda(o.mao_obra)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Custos indiretos</td><td style="text-align:right">${formatMoeda(o.custos_indiretos)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Margem ${o.margem_pct}%</td><td style="text-align:right;color:var(--accent)">inclusa</td></tr>
          ${o.considerar_imposto==='sim'?'<tr><td style="padding:4px 0;color:var(--text-2)">Imposto (Simples)</td><td style="text-align:right;color:var(--yellow)">incluso</td></tr>':''}
          <tr style="border-top:1px solid var(--border)"><td style="padding:8px 0;font-weight:700;">VALOR FINAL</td><td style="text-align:right;font-weight:700;color:var(--accent);font-family:'Syne',sans-serif;font-size:16px">${formatMoeda(o.valor_final)}</td></tr>
        </table>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Lucratividade interna</div>
        <table style="width:100%;font-size:13px;">
          <tr><td style="padding:4px 0;color:var(--text-2)">Materiais (custo)</td><td style="text-align:right;color:var(--red)">${formatMoeda(o.total_materiais_custo)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Custo total</td><td style="text-align:right;color:var(--red)">${formatMoeda(custo)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Lucro estimado</td><td style="text-align:right;color:var(--green)">${formatMoeda(lucro)}</td></tr>
          <tr><td style="padding:4px 0;color:var(--text-2)">Margem real</td><td style="text-align:right;color:var(--accent)">${margem}%</td></tr>
        </table>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text-2);margin-bottom:8px;"><span style="color:var(--text-3)">Pagamento:</span> ${o.forma_pagamento || '—'}</div>
    <div style="font-size:13px;color:var(--text-2);margin-bottom:8px;"><span style="color:var(--text-3)">Prazo:</span> ${o.prazo_entrega || '—'}</div>
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;"><span style="color:var(--text-3)">Garantia:</span> ${o.garantia || '—'}</div>
    ${o.observacoes ? `<div style="font-size:13px;color:var(--text-2);margin-bottom:16px;"><span style="color:var(--text-3)">Obs:</span> ${o.observacoes}</div>` : ''}
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn btn-secondary" onclick="fecharModal();editarOrcamento('${id}')">Editar</button>
      ${o.status === 'Aprovado' ? `<button class="btn btn-success" onclick="fecharModal();converterEmProjeto('${id}')">Converter em Projeto</button>` : ''}
    </div>`;
  abrirModal('Orcamento ' + o.numero, html, 'modal-lg');
}

async function converterEmProjeto(orcId) {
  const o = (window.DB.orcamentos || []).find(x => x.id === orcId);
  if (!o) return;
  await carregarDados([CONFIG.SHEETS.PROJETOS]);
  const projetoId = gerarId();
  const numero = gerarNumero('PRO', window.DB.projetos || []);
  await Sheets.adicionar(CONFIG.SHEETS.PROJETOS, {
    id: projetoId, numero, orcamento_id: orcId,
    cliente_id: o.cliente_id, cliente_nome: o.cliente_nome,
    nome: o.descricao, descricao: o.descricao,
    data_inicio: hoje(), prazo_entrega: '', data_entrega_real: '',
    valor_total: o.valor_final, valor_entrada: '', valor_recebido: '0',
    saldo_receber: o.valor_final,
    custo_previsto: parseFloat(o.total_materiais_custo || 0) + parseFloat(o.mao_obra || 0) + parseFloat(o.custos_indiretos || 0),
    custo_realizado: '0', lucro_bruto: '0', margem_pct: o.margem_pct,
    status: 'Em andamento', origem: 'Orcamento',
    criado_em: hoje(), atualizado_em: hoje(),
  });
  mostrarToast('Projeto criado a partir do orcamento', 'success');
  navegarPara('projetos');
}

function editarOrcamento(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (o) abrirFormOrcamento(o);
}

function editarOrcBtn(btn) { abrirFormOrcamento(JSON.parse(btn.dataset.o.replace(/&quot;/g,'"'))); }

function excluirOrc(id) {
  confirmar('Excluir este orcamento?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.ORCAMENTOS, id);
    mostrarToast('Orcamento excluido', 'success');
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS]);
    renderOrcMetricas();
    aplicarFiltrosOrc();
  });
}
