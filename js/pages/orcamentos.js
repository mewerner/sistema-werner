// ORCAMENTOS — v3
// Melhorias: unidade nos componentes, autocomplete materiais,
// horas×hora e km×custo/km, sem desperdicio, exportação PDF, lista de compras

window._orcFiltro    = 'todos';
window._orcBusca     = '';
window._orcAtual     = null;
window._orcAmbientes = [];
window._matCache     = null;

const ORC_UNIDADES = ['un','pç','m²','m³','ml','kg','cx','vb'];

// ─── MATERIAIS CADASTRADOS ────────────────────────────────────────────────
async function carregarMateriais() {
  if (window._matCache) return window._matCache;
  await carregarDados([CONFIG.SHEETS.MATERIAIS]);
  window._matCache = window.DB.materiais || [];
  return window._matCache;
}

function sugerirMaterial(inputEl, ambId, itemId, idx) {
  const q = inputEl.value.toLowerCase();
  const existing = document.getElementById('mat-suggest-' + itemId + '-' + idx);
  if (existing) existing.remove();
  if (!q || q.length < 2) return;
  const mats = (window._matCache || []).filter(m => m.nome.toLowerCase().includes(q)).slice(0, 6);
  if (!mats.length) return;
  const box = document.createElement('div');
  box.id = 'mat-suggest-' + itemId + '-' + idx;
  box.style.cssText = 'position:absolute;z-index:999;background:var(--bg-2);border:1px solid var(--border-2);border-radius:var(--radius);width:260px;box-shadow:0 4px 12px rgba(0,0,0,.3);';
  mats.forEach(m => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;';
    row.innerHTML = `<span>${m.nome}</span><span style="color:var(--text-3);font-size:11px;">${m.unidade || 'un'} · ${formatMoeda(m.preco_ref||0)}</span>`;
    row.onmousedown = () => {
      document.getElementById('comp-desc-'  + itemId + '-' + idx).value  = m.nome;
      document.getElementById('comp-unid-'  + itemId + '-' + idx).value  = m.unidade || 'un';
      document.getElementById('comp-preco-' + itemId + '-' + idx).value  = m.preco_ref || 0;
      sincronizarCamposItem(ambId, itemId);
      atualizarTotalItem(ambId, itemId);
      box.remove();
    };
    box.appendChild(row);
  });
  inputEl.parentElement.style.position = 'relative';
  inputEl.parentElement.appendChild(box);
  inputEl.onblur = () => setTimeout(() => box.remove(), 200);
}

// ─── LISTAGEM ─────────────────────────────────────────────────────────────
function renderOrcamentos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Orcamentos</h1><p class="page-subtitle">Propostas e precificacao de projetos</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="navegarPara('materiais-orc')">Materiais</button>
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
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS, CONFIG.SHEETS.CLIENTES]);
    await carregarMateriais();
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
    <div class="metric-card yellow"><div class="metric-label">Aguardando</div><div class="metric-value yellow">${enviados.length}</div></div>
    <div class="metric-card accent"><div class="metric-label">Taxa de conversao</div><div class="metric-value accent">${taxaConv}%</div></div>`;
}

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
          ${o.status === 'Aprovado' ? `<button class="btn btn-secondary btn-sm" onclick="verListaCompras('${o.id}')">Lista compras</button>` : ''}
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
  await carregarMateriais();
  renderEditorOrc();
}

async function abrirEditorOrc(id) {
  await carregarDados([CONFIG.SHEETS.ORCAMENTOS, CONFIG.SHEETS.CLIENTES]);
  await carregarMateriais();
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

    <!-- ABA DADOS -->
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

    <!-- ABA AMBIENTES -->
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

    <!-- ABA PRECIFICACAO -->
    <div id="orc-aba-precificacao" style="display:${abaAtiva==='precificacao'?'block':'none'}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-title">Mao de obra</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Horas estimadas</label>
              <input type="number" step="0.5" id="pc-horas" value="${v('horas_mao_obra') || '0'}" oninput="calcPrecificacao()" />
            </div>
            <div class="input-group"><label>Valor por hora (R$)</label>
              <input type="number" step="0.01" id="pc-valor_hora" value="${v('valor_hora') || '0'}" oninput="calcPrecificacao()" />
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-3);text-align:right;margin-top:-4px;margin-bottom:12px;">
            Total mao de obra: <strong id="pc-total-mao" style="color:var(--accent)">R$ 0,00</strong>
          </div>

          <div class="card-title" style="margin-top:4px;">Gasolina / Deslocamento</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Distancia (km)</label>
              <input type="number" step="1" id="pc-km" value="${v('km_entrega') || '0'}" oninput="calcPrecificacao()" />
            </div>
            <div class="input-group"><label>Custo por km (R$)</label>
              <input type="number" step="0.01" id="pc-custo_km" value="${v('custo_km') || '1.00'}" oninput="calcPrecificacao()" />
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-3);text-align:right;margin-top:-4px;margin-bottom:16px;">
            Total deslocamento: <strong id="pc-total-km" style="color:var(--accent)">R$ 0,00</strong>
          </div>

          <div class="card-title">Margem e imposto</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group"><label>Margem de lucro (%)</label>
              <input type="number" step="0.1" id="pc-margem" value="${v('margem_pct') || (CONFIG.DEFAULTS.MARGEM_PADRAO*100).toFixed(0)}" oninput="calcPrecificacao()" />
            </div>
            <div class="input-group"><label>Imposto</label>
              <select id="pc-imposto" onchange="calcPrecificacao()">
                <option value="nao" ${v('considerar_imposto')==='nao'||!v('considerar_imposto')?'selected':''}>Nao incluir</option>
                <option value="sim" ${v('considerar_imposto')==='sim'?'selected':''}>Simples (~6%)</option>
              </select>
            </div>
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
            <tr><td style="padding:6px 0;color:var(--text-2)">Mao de obra</td><td id="pr-mao-obra" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Deslocamento</td><td id="pr-entrega" style="text-align:right">R$ 0,00</td></tr>
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
  const nome = prompt('Nome do ambiente (ex: Cozinha, Quarto master):');
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
  amb.itens.push({ id: gerarId(), nome: '', descricao: '', material: '', dimensoes: '', obs: '', aberto: true,
    componentes: [{ desc: '', qtd: 1, unid: 'un', preco: 0 }] });
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
  const amb  = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item) return;
  item.componentes.push({ desc: '', qtd: 1, unid: 'un', preco: 0 });
  renderAmbientes();
}

function removerComponente(ambId, itemId, idx) {
  sincronizarCamposItem(ambId, itemId);
  const amb  = window._orcAmbientes.find(a => a.id === ambId);
  const item = amb?.itens.find(i => i.id === itemId);
  if (!item || item.componentes.length <= 1) return;
  item.componentes.splice(idx, 1);
  renderAmbientes();
  calcPrecificacao();
}

function toggleItem(ambId, itemId) {
  sincronizarCamposItem(ambId, itemId);
  const amb  = window._orcAmbientes.find(a => a.id === ambId);
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
  item.material  = get('item-mat-'  + itemId);
  item.dimensoes = get('item-dim-'  + itemId);
  item.obs       = get('item-obs-'  + itemId);
  item.componentes.forEach((c, idx) => {
    c.desc  = get('comp-desc-'  + itemId + '-' + idx);
    c.qtd   = parseFloat(get('comp-qtd-'   + itemId + '-' + idx)) || 0;
    c.unid  = get('comp-unid-'  + itemId + '-' + idx) || 'un';
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

  const unidOpts = ORC_UNIDADES.map(u => `<option value="${u}">${u}</option>`).join('');

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
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer;background:var(--bg-2);border-radius:var(--radius);"
              onclick="sincronizarCamposItem('${amb.id}','${item.id}');toggleItem('${amb.id}','${item.id}')">
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
                  <input id="item-nome-${item.id}" value="${item.nome}" placeholder="Ex: Balcao cozinha Vista A"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
                <div class="input-group" style="margin:0;"><label>Material principal</label>
                  <input id="item-mat-${item.id}" value="${item.material}" placeholder="Ex: MDF Palha Duratex"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div class="input-group" style="margin:0;"><label>Descricao</label>
                  <input id="item-desc-${item.id}" value="${item.descricao}" placeholder="Ex: 2 gavetas; 2 portas de giro..."
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
                <div class="input-group" style="margin:0;"><label>Dimensoes (L x A x P cm)</label>
                  <input id="item-dim-${item.id}" value="${item.dimensoes}" placeholder="Ex: 116 x 93 x 60"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
              </div>
              <div class="input-group" style="margin-bottom:12px;"><label>Observacoes</label>
                <input id="item-obs-${item.id}" value="${item.obs||''}" placeholder="Ex: Puxador a definir"
                  oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
              </div>

              <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Componentes / materiais</div>
              <div style="display:grid;grid-template-columns:2fr 70px 80px 110px 36px;gap:6px;font-size:11px;color:var(--text-3);padding-bottom:4px;border-bottom:1px solid var(--border);margin-bottom:4px;">
                <span>Descricao</span><span>Qtd</span><span>Unid</span><span>R$/un</span><span></span>
              </div>
              ${item.componentes.map((c, idx) => `
                <div style="display:grid;grid-template-columns:2fr 70px 80px 110px 36px;gap:6px;margin-bottom:4px;align-items:center;">
                  <input id="comp-desc-${item.id}-${idx}" value="${c.desc}" placeholder="Ex: Corredicca oculta"
                    style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}');atualizarTotalItem('${amb.id}','${item.id}');sugerirMaterial(this,'${amb.id}','${item.id}',${idx})" />
                  <input type="number" step="0.01" id="comp-qtd-${item.id}-${idx}" value="${c.qtd}"
                    style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}');atualizarTotalItem('${amb.id}','${item.id}')" />
                  <select id="comp-unid-${item.id}-${idx}"
                    style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 4px;color:var(--text);font-size:13px;"
                    onchange="sincronizarCamposItem('${amb.id}','${item.id}')">
                    ${ORC_UNIDADES.map(u => `<option value="${u}" ${(c.unid||'un')===u?'selected':''}>${u}</option>`).join('')}
                  </select>
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
  const horas      = parseFloat(document.getElementById('pc-horas')?.value) || 0;
  const valorHora  = parseFloat(document.getElementById('pc-valor_hora')?.value) || 0;
  const km         = parseFloat(document.getElementById('pc-km')?.value) || 0;
  const custoKm    = parseFloat(document.getElementById('pc-custo_km')?.value) || 0;
  const margem     = (parseFloat(document.getElementById('pc-margem')?.value) || 0) / 100;
  const imposto    = document.getElementById('pc-imposto')?.value === 'sim';
  const aliquota   = imposto ? (CONFIG.DEFAULTS?.ALIQUOTA_SIMPLES || 0.06) : 0;

  const maoObra  = horas * valorHora;
  const entrega  = km * custoKm;
  const subtotal = custoItens + maoObra + entrega;
  const comMargem = subtotal * (1 + margem);
  const final    = comMargem * (1 + aliquota);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatMoeda(val); };
  set('pr-custo-itens', custoItens);
  set('pr-mao-obra', maoObra);
  set('pr-entrega', entrega);
  set('pr-subtotal', subtotal);
  set('pr-margem', comMargem - subtotal);
  set('pr-final', final);
  set('pc-total-mao', maoObra);
  set('pc-total-km', entrega);

  const ml = document.getElementById('pr-margem-label');
  if (ml) ml.textContent = 'Margem ' + (margem * 100).toFixed(0) + '%';
  const ir = document.getElementById('pr-imp-row');
  if (ir) ir.style.display = imposto ? '' : 'none';
  if (imposto) set('pr-imposto', final - comMargem);

  window._precifResult = { custoItens, maoObra, entrega, subtotal, final };

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
    ${!viavel?`<div style="font-size:12px;margin-top:4px;">Minimo recomendado: ${formatMoeda(custo*1.15)}</div>`:''}
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
    data:     document.getElementById('oc-data')?.value || hoje(),
    validade: document.getElementById('oc-validade')?.value || '',
    status:   document.getElementById('oc-status')?.value || 'Rascunho',
    descricao,
    forma_pagamento: document.getElementById('oc-forma_pagamento')?.value || '',
    prazo_entrega:   document.getElementById('oc-prazo_entrega')?.value || '',
    garantia:        document.getElementById('oc-garantia')?.value || '',
    observacoes:     document.getElementById('oc-observacoes')?.value || '',
    horas_mao_obra:  document.getElementById('pc-horas')?.value || '0',
    valor_hora:      document.getElementById('pc-valor_hora')?.value || '0',
    km_entrega:      document.getElementById('pc-km')?.value || '0',
    custo_km:        document.getElementById('pc-custo_km')?.value || '1.00',
    margem_pct:      document.getElementById('pc-margem')?.value || '30',
    considerar_imposto: document.getElementById('pc-imposto')?.value || 'nao',
    custo_total_itens: calcCustoTotal().toFixed(2),
    valor_final: valorFinal,
    ambientes_json: JSON.stringify(window._orcAmbientes),
  };

  mostrarToast('Salvando...', '');
  const id = window._orcAtual?.id;
  if (id) {
    obj.id = id; obj.atualizado_em = hoje();
    await Sheets.atualizar(CONFIG.SHEETS.ORCAMENTOS, id, obj);
    window._orcAtual = { ...window._orcAtual, ...obj };
    mostrarToast('Orcamento atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.numero = gerarNumero('ORC', window.DB.orcamentos || []);
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

// ─── EXPORTAR PDF ─────────────────────────────────────────────────────────
function exportarOrcamento(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  const html = `
    <div style="display:flex;gap:12px;justify-content:center;padding:20px;">
      <button class="btn btn-primary" onclick="gerarPDFOrcamento('${id}')">Exportar PDF</button>
      <button class="btn btn-secondary" onclick="mostrarToast('Word em breve','')">Exportar Word (.docx)</button>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Fechar</button></div>`;
  abrirModal('Exportar — ' + o.numero, html);
}

function gerarPDFOrcamento(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  let ambientes = [];
  try { ambientes = JSON.parse(o.ambientes_json || '[]'); } catch(e) {}
  const cfg = window.DB.config || {};
  const empresa = {
    nome:       cfg.empresa_nome      || 'Moveis e Esquadrias Werner',
    cnpj:       cfg.empresa_cnpj      || '',
    telefone:   cfg.empresa_telefone  || '',
    email:      cfg.empresa_email     || '',
    logradouro: cfg.empresa_logradouro|| '',
    numero:     cfg.empresa_numero    || '',
    bairro:     cfg.empresa_bairro    || '',
    cidade:     cfg.empresa_cidade    || '',
    estado:     cfg.empresa_estado    || 'SC',
  };
  const endEmpresa = [empresa.logradouro, empresa.numero].filter(Boolean).join(', ');
  const cidadeEmpresa = [empresa.cidade, empresa.estado].filter(Boolean).join(' — ');

  const cliente = (window.DB.clientes || []).find(c => c.id === o.cliente_id) || {};
  const cidadeCliente = [cliente.cidade, cliente.estado].filter(Boolean).join(' — ');

  const ambHtml = ambientes.map(amb => {
    const totalAmb = (amb.itens || []).reduce((s, item) =>
      s + (item.componentes||[]).reduce((ss, c) => ss + (c.qtd||0)*(c.preco||0), 0), 0);
    return `
      <tr style="background:#2a2a2a;">
        <td colspan="5" style="padding:10px 16px;font-family:'Playfair Display',serif;font-size:13px;font-weight:600;color:#C9A84C;letter-spacing:1px;text-transform:uppercase;">${amb.nome}</td>
      </tr>
      ${(amb.itens||[]).map(item => {
        const totalItem = (item.componentes||[]).reduce((s,c) => s+(c.qtd||0)*(c.preco||0), 0);
        return `<tr style="border-bottom:1px solid #2a2a2a;">
          <td style="padding:10px 16px;font-size:13px;color:#1C1C1C;vertical-align:top;">
            <div style="font-weight:500;">${item.nome||'—'}</div>
            ${item.descricao?`<div style="font-size:11px;color:#7A7060;margin-top:3px;">${item.descricao}</div>`:''}
            ${item.obs?`<div style="font-size:11px;color:#9A8E7A;font-style:italic;margin-top:2px;">${item.obs}</div>`:''}
          </td>
          <td style="padding:10px 16px;font-size:12px;color:#5A5040;vertical-align:top;">${item.material||'—'}</td>
          <td style="padding:10px 16px;font-size:12px;color:#5A5040;vertical-align:top;">${item.dimensoes||'—'}</td>
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1C1C1C;text-align:right;vertical-align:top;">${formatMoeda(totalItem)}</td>
        </tr>`;
      }).join('')}
      <tr style="background:#F0EBE0;">
        <td colspan="3" style="padding:8px 16px;font-size:12px;font-weight:600;color:#7A7060;text-transform:uppercase;letter-spacing:.05em;">Subtotal — ${amb.nome}</td>
        <td style="padding:8px 16px;font-size:14px;font-weight:700;color:#C9A84C;text-align:right;">${formatMoeda(totalAmb)}</td>
      </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Orcamento ${o.numero}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Inter',sans-serif;background:#F5F0E8;color:#1C1C1C;}
      @media print{body{background:#F5F0E8;} .no-print{display:none;} @page{margin:0;size:A4;}}
    </style>
  </head><body>
    <div class="no-print" style="background:#333;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#C9A84C;font-family:'Playfair Display',serif;font-size:16px;">Orcamento ${o.numero}</span>
      <button onclick="window.print()" style="background:#C9A84C;color:#1C1C1C;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:600;">Imprimir / Salvar PDF</button>
    </div>
    <div style="max-width:794px;margin:0 auto;background:#F5F0E8;min-height:1123px;">

      <!-- CABECALHO -->
      <div style="background:#1C1C1C;padding:22px 50px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:8px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#B8974A;margin-bottom:3px;">Moveis e Esquadrias</div>
          <div style="font-family:'Playfair Display',serif;font-size:20px;color:#F5F0E8;">Moveis e Esquadrias <span style="color:#C9A84C;">Werner</span></div>
          <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:10px;color:#5A5040;margin-top:4px;">tradicao · precisao · excelencia</div>
        </div>
        <div style="width:1px;height:36px;background:#333;"></div>
        <div style="text-align:right;">
          <div style="font-size:10.5px;color:#B8974A;font-weight:500;">${empresa.email}</div>
          <div style="font-size:10px;color:#7A7060;">${empresa.telefone}</div>
          <div style="font-size:10px;color:#7A7060;">${endEmpresa}${endEmpresa&&cidadeEmpresa?' / ':''} ${cidadeEmpresa}</div>
          ${empresa.cnpj?`<div style="font-size:9.5px;color:#5A5040;margin-top:4px;">CNPJ ${empresa.cnpj}</div>`:''}
        </div>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,#C9A84C,#E8D5A0,#C9A84C);"></div>

      <!-- CORPO -->
      <div style="padding:40px 50px;">

        <!-- TITULO -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #D4C9B0;">
          <div>
            <div style="font-size:11px;font-weight:400;color:#9A8E7A;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Proposta Comercial</div>
            <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:600;">Werner</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'Playfair Display',serif;font-size:16px;color:#C9A84C;font-weight:600;margin-bottom:4px;">${o.numero}</div>
            <div style="font-size:11px;color:#7A7060;">Data: <strong style="color:#1C1C1C;">${formatData(o.data)}</strong></div>
            ${o.validade?`<div style="font-size:11px;color:#7A7060;">Validade: <strong style="color:#1C1C1C;">${formatData(o.validade)}</strong></div>`:''}
          </div>
        </div>

        <!-- CLIENTE -->
        <div style="margin-bottom:20px;">
          <div style="font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Cliente</div>
          <div style="background:#EDE8DC;border-left:3px solid #C9A84C;padding:14px 20px;display:grid;grid-template-columns:1fr 1fr;gap:8px 30px;">
            <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">Nome</div><div style="font-size:13px;">${o.cliente_nome||'—'}</div></div>
            <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">CPF / CNPJ</div><div style="font-size:13px;">${cliente.cpf_cnpj||'—'}</div></div>
            <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">Telefone</div><div style="font-size:13px;">${cliente.telefone||'—'}</div></div>
            <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">Cidade</div><div style="font-size:13px;">${cidadeCliente||'—'}</div></div>
          </div>
        </div>

        <!-- DESCRICAO -->
        ${o.descricao?`<div style="margin-bottom:20px;"><div style="font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Projeto</div>
          <div style="background:#EDE8DC;border-left:3px solid #C9A84C;padding:12px 20px;font-family:'Playfair Display',serif;font-size:14px;">${o.descricao}</div></div>`:''}

        <!-- TABELA ITENS -->
        <div style="margin-bottom:20px;">
          <div style="font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Itens do projeto</div>
          <table style="width:100%;border-collapse:collapse;background:#fff;">
            <thead>
              <tr style="background:#1C1C1C;">
                <th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:left;">Item</th>
                <th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:left;">Material</th>
                <th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:left;">Dim. (cm)</th>
                <th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:right;">Valor</th>
              </tr>
            </thead>
            <tbody>${ambHtml}</tbody>
          </table>
        </div>

        <!-- VALOR TOTAL -->
        <div style="background:#1C1C1C;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div style="font-size:10px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#7A7060;">Valor total da proposta</div>
          <div style="text-align:right;">
            <div style="font-family:'Playfair Display',serif;font-size:28px;color:#C9A84C;font-weight:600;">${formatMoeda(o.valor_final)}</div>
            ${o.forma_pagamento?`<div style="font-size:11px;color:#7A7060;margin-top:4px;">${o.forma_pagamento}</div>`:''}
          </div>
        </div>

        <!-- CONDICOES -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
          <div style="padding:12px 16px;background:#EDE8DC;border-top:2px solid #C9A84C;">
            <div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A8E7A;margin-bottom:5px;">Forma de pagamento</div>
            <div style="font-size:12px;color:#1C1C1C;font-weight:500;">${o.forma_pagamento||'—'}</div>
          </div>
          <div style="padding:12px 16px;background:#EDE8DC;border-top:2px solid #D4C9B0;">
            <div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A8E7A;margin-bottom:5px;">Prazo de entrega</div>
            <div style="font-size:12px;color:#1C1C1C;font-weight:500;">${o.prazo_entrega||'—'}</div>
          </div>
          <div style="padding:12px 16px;background:#EDE8DC;border-top:2px solid #D4C9B0;">
            <div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A8E7A;margin-bottom:5px;">Garantia</div>
            <div style="font-size:12px;color:#1C1C1C;font-weight:500;">${o.garantia||'180 dias — CDC art. 50'}</div>
          </div>
        </div>

        ${o.observacoes?`<div style="font-size:12px;color:#7A7060;font-style:italic;margin-bottom:20px;">${o.observacoes}</div>`:''}
      </div>

      <!-- RODAPE -->
      <div style="background:#1C1C1C;padding:16px 50px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:10px;color:#5A5040;font-style:italic;">Garantia de 180 dias · Qualidade e tradicao Werner</div>
        <div style="font-family:'Playfair Display',serif;font-size:13px;color:#C9A84C;">Werner</div>
      </div>
    </div>
  </body></html>`);
  win.document.close();
  fecharModal();
}

// ─── LISTA DE COMPRAS ─────────────────────────────────────────────────────
function verListaCompras(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  let ambientes = [];
  try { ambientes = JSON.parse(o.ambientes_json || '[]'); } catch(e) {}

  // Agrupa por ambiente e também consolida total geral
  const totalGeral = {};
  const ambsHtml = ambientes.map(amb => {
    const grupo = {};
    (amb.itens || []).forEach(item => {
      (item.componentes || []).forEach(c => {
        if (!c.desc) return;
        const key = c.desc.toLowerCase().trim() + '|' + (c.unid || 'un');
        if (!grupo[key]) grupo[key] = { desc: c.desc, unid: c.unid || 'un', qtd: 0 };
        grupo[key].qtd += c.qtd || 0;
        if (!totalGeral[key]) totalGeral[key] = { desc: c.desc, unid: c.unid || 'un', qtd: 0 };
        totalGeral[key].qtd += c.qtd || 0;
      });
    });
    const itens = Object.values(grupo).sort((a,b) => a.desc.localeCompare(b.desc));
    if (!itens.length) return '';
    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">${amb.nome}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${itens.map(i => `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 0;">${i.desc}</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;">${i.qtd % 1 === 0 ? i.qtd : i.qtd.toFixed(2)} ${i.unid}</td>
          </tr>`).join('')}
        </table>
      </div>`;
  }).join('');

  const totalItens = Object.values(totalGeral).sort((a,b) => a.desc.localeCompare(b.desc));
  const totalHtml = `
    <div style="margin-top:8px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;padding-top:12px;border-top:2px solid var(--accent);">Total Geral</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${totalItens.map(i => `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px 0;">${i.desc}</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${i.qtd % 1 === 0 ? i.qtd : i.qtd.toFixed(2)} ${i.unid}</td>
        </tr>`).join('')}
      </table>
    </div>`;

  const html = `
    <div style="max-height:60vh;overflow-y:auto;padding:4px 0;">
      ${ambsHtml || '<p style="color:var(--text-3)">Nenhum componente cadastrado nos itens.</p>'}
      ${totalItens.length ? totalHtml : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn btn-primary" onclick="imprimirListaCompras('${id}')">Imprimir</button>
    </div>`;
  abrirModal('Lista de compras — ' + o.numero, html, 'modal-lg');
}

function imprimirListaCompras(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  let ambientes = [];
  try { ambientes = JSON.parse(o.ambientes_json || '[]'); } catch(e) {}

  const totalGeral = {};
  const ambsHtml = ambientes.map(amb => {
    const grupo = {};
    (amb.itens || []).forEach(item => {
      (item.componentes || []).forEach(c => {
        if (!c.desc) return;
        const key = c.desc.toLowerCase().trim() + '|' + (c.unid || 'un');
        if (!grupo[key]) grupo[key] = { desc: c.desc, unid: c.unid || 'un', qtd: 0 };
        grupo[key].qtd += c.qtd || 0;
        if (!totalGeral[key]) totalGeral[key] = { desc: c.desc, unid: c.unid || 'un', qtd: 0 };
        totalGeral[key].qtd += c.qtd || 0;
      });
    });
    const itens = Object.values(grupo).sort((a,b) => a.desc.localeCompare(b.desc));
    if (!itens.length) return '';
    return `<div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9A84C;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #C9A84C;">${amb.nome}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f0f0f0;">
          <th style="padding:6px 8px;text-align:left;font-weight:500;">Material</th>
          <th style="padding:6px 8px;text-align:right;font-weight:500;">Quantidade</th>
          <th style="padding:6px 8px;text-align:center;font-weight:500;">Comprado</th>
        </tr></thead>
        <tbody>${itens.map((i,n) => `<tr style="background:${n%2===0?'#fff':'#f9f9f9'};">
          <td style="padding:6px 8px;">${i.desc}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600;">${i.qtd%1===0?i.qtd:i.qtd.toFixed(2)} ${i.unid}</td>
          <td style="padding:6px 8px;text-align:center;"><input type="checkbox" /></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');

  const totalItens = Object.values(totalGeral).sort((a,b) => a.desc.localeCompare(b.desc));

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Lista de Compras — ${o.numero}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:30px;color:#1C1C1C;}
    @media print{.no-print{display:none;} @page{margin:20px;}}</style>
  </head><body>
    <div class="no-print" style="margin-bottom:20px;">
      <button onclick="window.print()" style="background:#C9A84C;color:#1C1C1C;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:600;">Imprimir</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #1C1C1C;">
      <div>
        <div style="font-size:18px;font-weight:700;">Lista de Compras</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">${o.numero} — ${o.cliente_nome} — ${o.descricao}</div>
      </div>
      <div style="font-size:12px;color:#666;">Data: ${formatData(hoje())}</div>
    </div>
    ${ambsHtml}
    ${totalItens.length ? `
    <div style="margin-top:24px;padding-top:12px;border-top:3px solid #1C1C1C;">
      <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">TOTAL GERAL</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#1C1C1C;color:#C9A84C;">
          <th style="padding:8px;text-align:left;font-weight:500;">Material</th>
          <th style="padding:8px;text-align:right;font-weight:500;">Quantidade</th>
          <th style="padding:8px;text-align:center;font-weight:500;">Comprado</th>
        </tr></thead>
        <tbody>${totalItens.map((i,n) => `<tr style="background:${n%2===0?'#fff':'#f5f5f5'};">
          <td style="padding:6px 8px;">${i.desc}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;">${i.qtd%1===0?i.qtd:i.qtd.toFixed(2)} ${i.unid}</td>
          <td style="padding:6px 8px;text-align:center;"><input type="checkbox" /></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
  </body></html>`);
  win.document.close();
}

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
