// ORCAMENTOS — v2
// Estrutura: Listagem → Tela de edição com 3 abas (Dados, Ambientes/Itens, Precificação)

// ─── ESTADO LOCAL ─────────────────────────────────────────────────────────
window._orcFiltro    = 'todos';
window._orcBusca     = '';
window._orcAtual     = null;
window._orcAmbientes = [];

// ─── LISTAGEM ─────────────────────────────────────────────────────────────
function renderOrcamentos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Orcamentos</h1><p class="page-subtitle">Propostas e precificacao de projetos</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="novoOrcamento()">+ Novo Orcamento</button>
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
  const enviados  = lista.filter(o => o.status === 'Enviado');
  const totalAprov = somarCampo(aprovados, 'valor_final');
  const taxaConv = (enviados.length + aprovados.length) > 0
    ? (aprovados.length / (enviados.length + aprovados.length) * 100).toFixed(0) : 0;
  document.getElementById('orc-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total</div><div class="metric-value">${lista.length}</div></div>
    <div class="metric-card green"><div class="metric-label">Aprovados</div><div class="metric-value green">${aprovados.length}</div><div class="metric-sub">${formatMoeda(totalAprov)}</div></div>
    <div class="metric-card yellow"><div class="metric-label">Aguardando resposta</div><div class="metric-value yellow">${enviados.length}</div></div>
    <div class="metric-card accent"><div class="metric-label">Taxa de conversao</div><div class="metric-value accent">${taxaConv}%</div></div>`;
}

window._orcFiltro = 'todos';
window._orcBusca  = '';

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
  if (window._orcBusca) lista = lista.filter(o =>
    (o.numero + o.cliente_nome + o.descricao).toLowerCase().includes(window._orcBusca));
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
          <button class="btn btn-secondary btn-sm" onclick="abrirEditorOrc('${o.id}')">Abrir</button>
          <button class="btn btn-secondary btn-sm" onclick="exportarOrcamento('${o.id}')">Exportar</button>
          ${o.status === 'Aprovado' ? `<button class="btn btn-success btn-sm" onclick="converterEmProjeto('${o.id}')">Projeto</button>` : ''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirOrc('${o.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

// ─── EDITOR ───────────────────────────────────────────────────────────────
async function novoOrcamento() {
  window._orcAtual     = null;
  window._orcAmbientes = [];
  await carregarDados([CONFIG.SHEETS.CLIENTES, CONFIG.SHEETS.ORCAMENTOS]);
  renderEditorOrc();
}

async function abrirEditorOrc(id) {
  await carregarDados([CONFIG.SHEETS.ORCAMENTOS, CONFIG.SHEETS.ORCAMENTO_ITENS, CONFIG.SHEETS.CLIENTES]);
  window._orcAtual = (window.DB.orcamentos || []).find(o => o.id === id) || null;
  try { window._orcAmbientes = window._orcAtual?.ambientes_json ? JSON.parse(window._orcAtual.ambientes_json) : []; }
  catch(e) { window._orcAmbientes = []; }
  renderEditorOrc();
}

function renderEditorOrc(abaAtiva) {
  abaAtiva = abaAtiva || 'dados';
  const o = window._orcAtual;
  const clientes = window.DB.clientes || [];
  const v = (id) => o ? (o[id] || '') : '';
  const container = document.getElementById('page-container');

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-secondary btn-sm" onclick="renderOrcamentos()">← Voltar</button>
        <div>
          <h1 class="page-title">${o ? 'Orcamento ' + o.numero : 'Novo Orcamento'}</h1>
          <p class="page-subtitle">${o ? (o.cliente_nome || '') : 'Preencha os dados abaixo'}</p>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="salvarOrcamentoEditor(false)">Salvar rascunho</button>
        <button class="btn btn-primary" onclick="salvarOrcamentoEditor(true)">Salvar e fechar</button>
      </div>
    </div>

    <style>
      .orc-tab{background:none;border:none;padding:10px 20px;font-size:14px;cursor:pointer;color:var(--text-3);border-bottom:2px solid transparent;margin-bottom:-1px;font-family:inherit;}
      .orc-tab.active{color:var(--text);border-bottom-color:var(--accent);font-weight:600;}
      .orc-tab:hover{color:var(--text-2);}
    </style>
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:20px;">
      <button class="orc-tab ${abaAtiva==='dados'?'active':''}" onclick="trocarAbaOrc('dados',this)">Dados do projeto</button>
      <button class="orc-tab ${abaAtiva==='ambientes'?'active':''}" onclick="trocarAbaOrc('ambientes',this)">Ambientes e itens</button>
      <button class="orc-tab ${abaAtiva==='precificacao'?'active':''}" onclick="trocarAbaOrc('precificacao',this)">Precificacao</button>
    </div>

    <div id="orc-aba-dados" style="display:${abaAtiva==='dados'?'block':'none'}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-title">Cliente</div>
          <div class="input-group"><label>Cliente *</label>
            <select id="oc-cliente_id">
              <option value="">Selecione...</option>
              ${clientes.map(c => `<option value="${c.id}" data-nome="${c.nome}" ${v('cliente_id')===c.id?'selected':''}>${c.nome}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Data *</label><input type="date" id="oc-data" value="${v('data') || hoje()}" /></div>
            <div class="input-group"><label>Validade</label><input type="date" id="oc-validade" value="${v('validade')}" /></div>
          </div>
          <div class="input-group"><label>Status</label>
            <select id="oc-status">
              ${['Rascunho','Enviado','Aprovado','Recusado'].map(s =>
                `<option ${v('status')===s||(!v('status')&&s==='Rascunho')?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Projeto</div>
          <div class="input-group"><label>Descricao geral *</label>
            <input id="oc-descricao" value="${v('descricao')}" placeholder="Ex: Projeto de interiores residencial" />
          </div>
          <div class="input-group"><label>Forma de pagamento</label>
            <input id="oc-forma_pagamento" value="${v('forma_pagamento')}" placeholder="Ex: 50% entrada + 50% na entrega" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Prazo de entrega</label>
              <input id="oc-prazo_entrega" value="${v('prazo_entrega')}" placeholder="Ex: 45 dias uteis" />
            </div>
            <div class="input-group"><label>Garantia</label>
              <input id="oc-garantia" value="${v('garantia') || '180 dias conforme CDC art. 50'}" />
            </div>
          </div>
          <div class="input-group"><label>Observacoes</label>
            <textarea id="oc-observacoes" rows="2">${v('observacoes')}</textarea>
          </div>
        </div>
      </div>
    </div>

    <div id="orc-aba-ambientes" style="display:${abaAtiva==='ambientes'?'block':'none'}">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
        <button class="btn btn-secondary" onclick="adicionarAmbiente()">+ Ambiente</button>
      </div>
      <div id="orc-ambientes-lista"></div>
      <div id="orc-ambientes-vazio" style="display:none;text-align:center;padding:40px;color:var(--text-3);">
        Nenhum ambiente adicionado. Clique em "+ Ambiente" para comecar.
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
        <div style="font-size:14px;color:var(--text-2);">Custo total dos itens: <strong id="orc-custo-total" style="color:var(--accent);font-size:16px;">R$ 0,00</strong></div>
      </div>
    </div>

    <div id="orc-aba-precificacao" style="display:${abaAtiva==='precificacao'?'block':'none'}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-title">Parametros</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Desperdicio (%)</label>
              <input type="number" step="0.1" id="pc-desperdicio" value="${v('desperdicio_pct') || (CONFIG.DEFAULTS.DESPERDICIO_MATERIAL*100).toFixed(0)}" oninput="calcPrecificacao()" />
            </div>
            <div class="input-group"><label>Margem de lucro (%)</label>
              <input type="number" step="0.1" id="pc-margem" value="${v('margem_pct') || (CONFIG.DEFAULTS.MARGEM_PADRAO*100).toFixed(0)}" oninput="calcPrecificacao()" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Mao de obra (R$)</label>
              <input type="number" step="0.01" id="pc-mao_obra" value="${v('mao_obra') || '0'}" oninput="calcPrecificacao()" />
            </div>
            <div class="input-group"><label>Gasolina / Entrega (R$)</label>
              <input type="number" step="0.01" id="pc-entrega" value="${v('custo_entrega') || '0'}" oninput="calcPrecificacao()" />
            </div>
          </div>
          <div class="input-group"><label>Imposto</label>
            <select id="pc-imposto" onchange="calcPrecificacao()">
              <option value="nao" ${v('considerar_imposto')==='nao'||!v('considerar_imposto')?'selected':''}>Nao incluir</option>
              <option value="sim" ${v('considerar_imposto')==='sim'?'selected':''}>Simples Nacional (~6%)</option>
            </select>
          </div>
          <hr class="divider"/>
          <div class="card-title">Margem inversa</div>
          <div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">Preco que o cliente quer pagar</div>
          <input type="number" step="0.01" id="pc-preco_cliente" placeholder="R$ 0,00" oninput="calcMargensInversa()"
            style="width:100%;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
          <div id="pc-resultado-inverso" style="margin-top:8px;font-size:13px;"></div>
        </div>
        <div class="card">
          <div class="card-title">Resultado</div>
          <table style="width:100%;font-size:13px;margin-bottom:16px;">
            <tr><td style="padding:6px 0;color:var(--text-2)">Custo dos itens</td><td id="pr-custo-itens" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Desperdicio</td><td id="pr-desperdicio" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Mao de obra</td><td id="pr-mao-obra" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Gasolina / Entrega</td><td id="pr-entrega" style="text-align:right">R$ 0,00</td></tr>
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:8px 0;color:var(--text-2)">Subtotal custo</td>
              <td id="pr-subtotal" style="text-align:right;font-weight:600">R$ 0,00</td>
            </tr>
            <tr><td style="padding:6px 0;color:var(--text-2)" id="pr-margem-label">Margem 30%</td><td id="pr-margem" style="text-align:right;color:var(--accent)">R$ 0,00</td></tr>
            <tr id="pr-imp-row" style="display:none">
              <td style="padding:6px 0;color:var(--text-2)">Imposto ~6%</td>
              <td id="pr-imposto" style="text-align:right;color:var(--yellow)">R$ 0,00</td>
            </tr>
            <tr style="border-top:2px solid var(--accent)">
              <td style="padding:12px 0;font-size:15px;font-weight:700;">PRECO SUGERIDO</td>
              <td id="pr-final" style="text-align:right;font-size:22px;font-weight:800;color:var(--accent)">R$ 0,00</td>
            </tr>
          </table>
          <div>
            <div style="font-size:11px;color:var(--text-3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Valor final do orcamento</div>
            <input type="number" step="0.01" id="oc-valor_final" value="${v('valor_final')}"
              style="width:100%;font-size:18px;font-weight:700;color:var(--accent);background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:10px;"
              placeholder="Edite ou arredonde livremente" />
            <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Voce pode arredondar ou ajustar livremente.</div>
          </div>
        </div>
      </div>
    </div>`;

  renderAmbientes();
  calcPrecificacao();
}

function trocarAbaOrc(aba, btn) {
  document.querySelectorAll('.orc-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['dados','ambientes','precificacao'].forEach(a => {
    const el = document.getElementById('orc-aba-' + a);
    if (el) el.style.display = a === aba ? 'block' : 'none';
  });
  if (aba === 'precificacao') calcPrecificacao();
}

// ─── AMBIENTES E ITENS ────────────────────────────────────────────────────
function adicionarAmbiente() {
  const nome = prompt('Nome do ambiente (ex: Cozinha, Quarto master, Banheiro):');
  if (!nome || !nome.trim()) return;
  window._orcAmbientes.push({ id: gerarId(), nome: nome.trim(), itens: [] });
  renderAmbientes();
}

function removerAmbiente(ambId) {
  if (!confirm('Remover este ambiente e todos os seus itens?')) return;
  window._orcAmbientes = window._orcAmbientes.filter(a => a.id !== ambId);
  renderAmbientes();
}

function adicionarItem(ambId) {
  const amb = window._orcAmbientes.find(a => a.id === ambId);
  if (!amb) return;
  amb.itens.push({ id: gerarId(), nome: '', descricao: '', material: '', dimensoes: '', obs: '', aberto: true, componentes: [{ desc: '', qtd: 1, preco: 0 }] });
  renderAmbientes();
}

function removerItem(ambId, itemId) {
  const amb = window._orcAmbientes.find(a => a.id === ambId);
  if (!amb) return;
  amb.itens = amb.itens.filter(i => i.id !== itemId);
  renderAmbientes();
  calcPrecificacao();
}

function adicionarComponente(ambId, itemId) {
  sincronizarCamposItem(ambId, itemId);
  const amb = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item) return;
  item.componentes.push({ desc: '', qtd: 1, preco: 0 });
  renderAmbientes();
}

function removerComponente(ambId, itemId, idx) {
  sincronizarCamposItem(ambId, itemId);
  const amb = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item || item.componentes.length <= 1) return;
  item.componentes.splice(idx, 1);
  renderAmbientes();
  calcPrecificacao();
}

function toggleItem(ambId, itemId) {
  sincronizarCamposItem(ambId, itemId);
  const amb = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item) return;
  item.aberto = !item.aberto;
  renderAmbientes();
}

function sincronizarCamposItem(ambId, itemId) {
  const amb  = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item) return;
  const get = (id) => document.getElementById(id)?.value || '';
  item.nome      = get('item-nome-' + itemId);
  item.descricao = get('item-desc-' + itemId);
  item.material  = get('item-mat-' + itemId);
  item.dimensoes = get('item-dim-' + itemId);
  item.obs       = get('item-obs-' + itemId);
  item.componentes.forEach((c, idx) => {
    c.desc  = get('comp-desc-' + itemId + '-' + idx);
    c.qtd   = parseFloat(get('comp-qtd-'  + itemId + '-' + idx)) || 0;
    c.preco = parseFloat(get('comp-preco-' + itemId + '-' + idx)) || 0;
  });
}

function calcTotalItem(item) {
  return (item.componentes || []).reduce((s, c) => s + (c.qtd || 0) * (c.preco || 0), 0);
}
function calcTotalAmbiente(amb) {
  return (amb.itens || []).reduce((s, item) => s + calcTotalItem(item), 0);
}
function calcCustoTotal() {
  return (window._orcAmbientes || []).reduce((s, amb) => s + calcTotalAmbiente(amb), 0);
}

function renderAmbientes() {
  const lista = document.getElementById('orc-ambientes-lista');
  const vazio = document.getElementById('orc-ambientes-vazio');
  if (!lista) return;
  if (!window._orcAmbientes.length) {
    lista.innerHTML = '';
    if (vazio) vazio.style.display = 'block';
    atualizarCustoTotal();
    return;
  }
  if (vazio) vazio.style.display = 'none';

  lista.innerHTML = window._orcAmbientes.map(amb => {
    const totalAmb = calcTotalAmbiente(amb);
    return `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:600;">${amb.nome}</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:13px;color:var(--text-2);">Custo: <strong style="color:var(--accent)">${formatMoeda(totalAmb)}</strong></span>
          <button class="btn btn-secondary btn-sm" onclick="adicionarItem('${amb.id}')">+ Item</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="removerAmbiente('${amb.id}')">🗑</button>
        </div>
      </div>
      ${!amb.itens.length ? `<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px;">Nenhum item. Clique em "+ Item".</div>` :
        amb.itens.map(item => {
          const totalItem = calcTotalItem(item);
          return `
          <div style="border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer;background:var(--bg-2);border-radius:var(--radius);" onclick="sincronizarCamposItem('${amb.id}','${item.id}');toggleItem('${amb.id}','${item.id}')">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:12px;color:var(--text-3)">${item.aberto ? '▼' : '▶'}</span>
                <span style="font-size:14px;font-weight:500;">${item.nome || 'Novo item'}</span>
                ${item.material ? `<span style="font-size:11px;color:var(--text-3);background:var(--bg-3);padding:2px 8px;border-radius:999px;">${item.material}</span>` : ''}
                ${item.dimensoes ? `<span style="font-size:11px;color:var(--text-3);">${item.dimensoes}</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:13px;font-weight:600;color:var(--accent);">${formatMoeda(totalItem)}</span>
                <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();removerItem('${amb.id}','${item.id}')">✕</button>
              </div>
            </div>
            ${item.aberto ? `
            <div style="padding:14px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div class="input-group" style="margin:0;"><label>Nome do item</label>
                  <input id="item-nome-${item.id}" value="${item.nome}" placeholder="Ex: Balcao cozinha Vista A" oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
                <div class="input-group" style="margin:0;"><label>Material principal</label>
                  <input id="item-mat-${item.id}" value="${item.material}" placeholder="Ex: MDF Palha Duratex" oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div class="input-group" style="margin:0;"><label>Descricao</label>
                  <input id="item-desc-${item.id}" value="${item.descricao}" placeholder="Ex: 2 gavetas; 2 portas de giro..." oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
                <div class="input-group" style="margin:0;"><label>Dimensoes (L x A x P cm)</label>
                  <input id="item-dim-${item.id}" value="${item.dimensoes}" placeholder="Ex: 116 x 93 x 60" oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
              </div>
              <div class="input-group" style="margin-bottom:10px;"><label>Observacoes</label>
                <input id="item-obs-${item.id}" value="${item.obs||''}" placeholder="Ex: Puxador a definir" oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
              </div>
              <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Componentes / materiais</div>
              <div style="display:grid;grid-template-columns:2fr 80px 110px 36px;gap:6px;font-size:11px;color:var(--text-3);padding-bottom:4px;border-bottom:1px solid var(--border);margin-bottom:4px;">
                <span>Descricao</span><span>Qtd</span><span>R$/un</span><span></span>
              </div>
              ${item.componentes.map((c, idx) => `
                <div style="display:grid;grid-template-columns:2fr 80px 110px 36px;gap:6px;margin-bottom:4px;align-items:center;">
                  <input id="comp-desc-${item.id}-${idx}" value="${c.desc}" placeholder="Ex: Corredicca oculta"
                    style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}');atualizarTotalItem('${amb.id}','${item.id}')" />
                  <input type="number" step="0.01" id="comp-qtd-${item.id}-${idx}" value="${c.qtd}"
                    style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}');atualizarTotalItem('${amb.id}','${item.id}')" />
                  <input type="number" step="0.01" id="comp-preco-${item.id}-${idx}" value="${c.preco}"
                    style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}');atualizarTotalItem('${amb.id}','${item.id}')" />
                  <button onclick="removerComponente('${amb.id}','${item.id}',${idx})"
                    style="background:var(--red-bg);border:1px solid rgba(224,92,92,0.2);border-radius:var(--radius);padding:6px;color:var(--red);cursor:pointer;font-size:12px;">✕</button>
                </div>`).join('')}
              <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="adicionarComponente('${amb.id}','${item.id}')">+ Componente</button>
              <div style="text-align:right;margin-top:8px;font-size:13px;">
                Total do item: <strong id="total-item-${item.id}" style="color:var(--accent)">${formatMoeda(totalItem)}</strong>
              </div>
            </div>` : ''}
          </div>`;
        }).join('')}
      <div style="display:flex;justify-content:flex-end;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
        <span style="font-size:13px;">Subtotal — ${amb.nome}: <strong style="color:var(--accent)">${formatMoeda(totalAmb)}</strong></span>
      </div>
    </div>`;
  }).join('');

  atualizarCustoTotal();
}

function atualizarTotalItem(ambId, itemId) {
  const amb  = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item) return;
  const total = calcTotalItem(item);
  const el = document.getElementById('total-item-' + itemId);
  if (el) el.textContent = formatMoeda(total);
  atualizarCustoTotal();
  calcPrecificacao();
}

function atualizarCustoTotal() {
  const el = document.getElementById('orc-custo-total');
  if (el) el.textContent = formatMoeda(calcCustoTotal());
}

// ─── PRECIFICAÇÃO ─────────────────────────────────────────────────────────
function calcPrecificacao() {
  const custoItens = calcCustoTotal();
  const desp    = (parseFloat(document.getElementById('pc-desperdicio')?.value) || 0) / 100;
  const maoObra = parseFloat(document.getElementById('pc-mao_obra')?.value) || 0;
  const entrega = parseFloat(document.getElementById('pc-entrega')?.value) || 0;
  const margem  = (parseFloat(document.getElementById('pc-margem')?.value) || 0) / 100;
  const imposto = document.getElementById('pc-imposto')?.value === 'sim';
  const aliquota = imposto ? (CONFIG.DEFAULTS?.ALIQUOTA_SIMPLES || 0.06) : 0;

  const custoDesp = custoItens * desp;
  const subtotal  = custoItens + custoDesp + maoObra + entrega;
  const comMargem = subtotal * (1 + margem);
  const final     = comMargem * (1 + aliquota);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatMoeda(val); };
  set('pr-custo-itens', custoItens);
  set('pr-desperdicio', custoDesp);
  set('pr-mao-obra', maoObra);
  set('pr-entrega', entrega);
  set('pr-subtotal', subtotal);
  set('pr-margem', comMargem - subtotal);
  set('pr-final', final);

  const ml = document.getElementById('pr-margem-label');
  if (ml) ml.textContent = 'Margem ' + (margem * 100).toFixed(0) + '%';
  const ir = document.getElementById('pr-imp-row');
  if (ir) ir.style.display = imposto ? '' : 'none';
  if (imposto) set('pr-imposto', final - comMargem);

  window._precifResult = { custoItens, custoDesp, maoObra, entrega, subtotal, final };

  const vfEl = document.getElementById('oc-valor_final');
  if (vfEl && (!vfEl.value || parseFloat(vfEl.value) === 0)) vfEl.value = final.toFixed(2);

  atualizarCustoTotal();
  calcMargensInversa();
}

function calcMargensInversa() {
  const precoCliente = parseFloat(document.getElementById('pc-preco_cliente')?.value) || 0;
  const custo = window._precifResult?.subtotal || 0;
  const el = document.getElementById('pc-resultado-inverso');
  if (!el) return;
  if (!precoCliente || !custo) { el.innerHTML = ''; return; }
  const margem = ((precoCliente - custo) / precoCliente * 100);
  const viavel = margem >= 10;
  el.innerHTML = `<div style="padding:10px;background:${viavel?'var(--green-bg)':'var(--red-bg)'};border-radius:var(--radius);">
    <div style="color:${viavel?'var(--green)':'var(--red)'};font-weight:600;">${viavel?'Viavel':'Inviavel'}</div>
    <div style="font-size:12px;margin-top:4px;">Margem resultante: ${margem.toFixed(1)}%</div>
    <div style="font-size:12px;">Lucro: ${formatMoeda(precoCliente - custo)}</div>
    ${!viavel?`<div style="font-size:12px;margin-top:4px;">Preco minimo recomendado: ${formatMoeda(custo*1.15)}</div>`:''}
  </div>`;
}

// ─── SALVAR ───────────────────────────────────────────────────────────────
async function salvarOrcamentoEditor(fecharDepois) {
  (window._orcAmbientes || []).forEach(amb =>
    amb.itens.forEach(item => sincronizarCamposItem(amb.id, item.id)));

  const sel = document.getElementById('oc-cliente_id');
  const opt = sel?.options[sel.selectedIndex];
  const clienteId   = sel?.value || '';
  const clienteNome = opt?.dataset?.nome || '';
  const descricao   = document.getElementById('oc-descricao')?.value || '';
  const valorFinal  = document.getElementById('oc-valor_final')?.value || '0';

  if (!clienteId) { mostrarToast('Selecione um cliente', 'error'); return; }
  if (!descricao) { mostrarToast('Informe a descricao do projeto', 'error'); return; }

  const obj = {
    cliente_id: clienteId, cliente_nome: clienteNome,
    data:       document.getElementById('oc-data')?.value || hoje(),
    validade:   document.getElementById('oc-validade')?.value || '',
    status:     document.getElementById('oc-status')?.value || 'Rascunho',
    descricao,
    forma_pagamento:    document.getElementById('oc-forma_pagamento')?.value || '',
    prazo_entrega:      document.getElementById('oc-prazo_entrega')?.value || '',
    garantia:           document.getElementById('oc-garantia')?.value || '',
    observacoes:        document.getElementById('oc-observacoes')?.value || '',
    desperdicio_pct:    document.getElementById('pc-desperdicio')?.value || '0',
    margem_pct:         document.getElementById('pc-margem')?.value || '30',
    mao_obra:           document.getElementById('pc-mao_obra')?.value || '0',
    custo_entrega:      document.getElementById('pc-entrega')?.value || '0',
    considerar_imposto: document.getElementById('pc-imposto')?.value || 'nao',
    custo_total_itens:  calcCustoTotal().toFixed(2),
    valor_final:        valorFinal,
    ambientes_json:     JSON.stringify(window._orcAmbientes),
  };

  mostrarToast('Salvando...', '');
  const id = window._orcAtual?.id;
  if (id) {
    obj.id = id; obj.atualizado_em = hoje();
    await Sheets.atualizar(CONFIG.SHEETS.ORCAMENTOS, id, obj);
    window._orcAtual = { ...window._orcAtual, ...obj };
    mostrarToast('Orcamento atualizado', 'success');
  } else {
    obj.id      = gerarId();
    obj.numero  = gerarNumero('ORC', window.DB.orcamentos || []);
    obj.criado_em = hoje(); obj.atualizado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.ORCAMENTOS, obj);
    window._orcAtual = obj;
    if (window.DB.orcamentos) window.DB.orcamentos.push(obj);
    mostrarToast('Orcamento criado', 'success');
    const title = document.querySelector('.page-title');
    if (title) title.textContent = 'Orcamento ' + obj.numero;
    const sub = document.querySelector('.page-subtitle');
    if (sub) sub.textContent = clienteNome;
  }

  if (fecharDepois) {
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS]);
    renderOrcamentos();
  }
}

// ─── EXPORTAR ─────────────────────────────────────────────────────────────
function exportarOrcamento(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  const html = `
    <div style="display:flex;gap:12px;justify-content:center;padding:20px;">
      <button class="btn btn-primary" onclick="exportarPDF('${id}')">Exportar PDF</button>
      <button class="btn btn-secondary" onclick="exportarDOCX('${id}')">Exportar Word (.docx)</button>
    </div>
    <div style="font-size:13px;color:var(--text-3);text-align:center;">Identidade visual Werner sera aplicada automaticamente.</div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Fechar</button></div>`;
  abrirModal('Exportar Orcamento ' + o.numero, html);
}

function exportarPDF(id)  { mostrarToast('Exportacao PDF em desenvolvimento', ''); }
function exportarDOCX(id) { mostrarToast('Exportacao Word em desenvolvimento', ''); }

// ─── EXCLUIR / CONVERTER ──────────────────────────────────────────────────
function excluirOrc(id) {
  confirmar('Excluir este orcamento?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.ORCAMENTOS, id);
    mostrarToast('Orcamento excluido', 'success');
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS]);
    renderOrcMetricas();
    aplicarFiltrosOrc();
  });
}

async function converterEmProjeto(orcId) {
  const o = (window.DB.orcamentos || []).find(x => x.id === orcId);
  if (!o) return;
  await carregarDados([CONFIG.SHEETS.PROJETOS]);
  await Sheets.adicionar(CONFIG.SHEETS.PROJETOS, {
    id: gerarId(), numero: gerarNumero('PRO', window.DB.projetos || []),
    orcamento_id: orcId,
    cliente_id: o.cliente_id, cliente_nome: o.cliente_nome,
    nome: o.descricao, descricao: o.descricao,
    data_inicio: hoje(), prazo_entrega: o.prazo_entrega || '', data_entrega_real: '',
    valor_total: o.valor_final, valor_entrada: '', valor_recebido: '0',
    saldo_receber: o.valor_final, custo_previsto: o.custo_total_itens || '0',
    custo_realizado: '0', lucro_bruto: '0', margem_pct: o.margem_pct,
    status: 'Em andamento', origem: 'Orcamento',
    criado_em: hoje(), atualizado_em: hoje(),
  });
  mostrarToast('Projeto criado a partir do orcamento', 'success');
  navegarPara('projetos');
}
