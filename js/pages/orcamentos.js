// =============================================
// ORÇAMENTOS v4 — Reescrito
// =============================================

window._orcFiltro    = 'todos';
window._orcBusca     = '';
window._orcAtual     = null;
window._orcAmbientes = [];
window._valorFinalCalculado = 0;

const ORC_UNIDADES = ['un','pç','m²','m³','ml','kg','cx','vb'];
const ORC_STATUS   = ['Rascunho','Enviado','Aprovado','Recusado'];

const ORC_FORMAS_PAGAMENTO = [
  { id: 'avista',    label: 'À vista',                  texto: 'À vista — PIX ou Transferência bancária' },
  { id: 'parcelado', label: '50% entrada + 50% parcelado', texto: '50% na aprovação + 50% restante em até 3x sem juros' },
  { id: 'viacredi',  label: 'Financiamento Viacredi',   texto: 'Financiamento Viacredi em até 48x' },
  { id: 'cartao',    label: 'Cartão de crédito',        texto: 'Em até 12x no Cartão de Crédito' },
];

// Parseia o campo forma_pagamento (JSON novo ou texto legado)
function parsePagamentos(val) {
  if (!val) return ORC_FORMAS_PAGAMENTO.map(f => ({ ...f, ativo: false }));
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch(e) {}
  // Legado: texto livre → opções desmarcadas (usuário marca ao editar)
  return ORC_FORMAS_PAGAMENTO.map(f => ({ ...f, ativo: false }));
}

// ─── LISTA ────────────────────────────────────────────────────────────────
function renderOrcamentos() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Orçamentos</h1><p class="page-subtitle">Propostas comerciais</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="novoOrcamento()">+ Novo Orçamento</button>
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
        <input class="table-search" placeholder="Buscar orçamento..." oninput="buscarOrc(this.value)" />
        <span id="orc-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="orc-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS, CONFIG.SHEETS.CLIENTES]);
    renderOrcMetricas();
    aplicarFiltrosOrc();
  });
}

function renderOrcMetricas() {
  const lista     = window.DB.orcamentos || [];
  const aprovados = lista.filter(o => o.status === 'Aprovado');
  const enviados  = lista.filter(o => o.status === 'Enviado');
  const totalAprov = somarCampo(aprovados, 'valor_final');
  const base = enviados.length + aprovados.length;
  const taxa = base > 0 ? (aprovados.length / base * 100).toFixed(0) : 0;
  document.getElementById('orc-metricas').innerHTML = `
    <div class="metric-card"><div class="metric-label">Total</div><div class="metric-value">${lista.length}</div></div>
    <div class="metric-card green"><div class="metric-label">Aprovados</div><div class="metric-value green">${aprovados.length}</div><div class="metric-sub">${formatMoeda(totalAprov)}</div></div>
    <div class="metric-card yellow"><div class="metric-label">Aguardando</div><div class="metric-value yellow">${enviados.length}</div></div>
    <div class="metric-card accent"><div class="metric-label">Taxa de conversão</div><div class="metric-value accent">${taxa}%</div></div>`;
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
  lista = lista.sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
  renderTabelaOrc(lista);
}

function renderTabelaOrc(lista) {
  document.getElementById('orc-count').textContent = lista.length + ' orçamentos';
  if (!lista.length) { document.getElementById('orc-table').innerHTML = estadoVazio('Nenhum orçamento encontrado'); return; }
  document.getElementById('orc-table').innerHTML = `
    <table><thead><tr>
      <th>Nº</th><th>Data</th><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th>
    </tr></thead><tbody>
      ${lista.map(o => `<tr>
        <td style="color:var(--text-3);font-size:12px;">${o.numero || '—'}</td>
        <td style="font-size:12px;">${formatData(o.data)}</td>
        <td><strong>${o.cliente_nome || '—'}</strong></td>
        <td style="font-size:12px;color:var(--text-2);">${o.descricao || '—'}</td>
        <td style="font-weight:600;color:var(--accent);">${formatMoeda(o.valor_final)}</td>
        <td>
          <select onchange="mudarStatusOrc('${o.id}',this.value)"
            style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:4px 8px;color:var(--text);font-size:12px;cursor:pointer;">
            ${ORC_STATUS.map(s => `<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm" onclick="abrirEditorOrc('${o.id}')">Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="gerarPDFOrcamento('${o.id}')">PDF</button>
          ${o.status === 'Aprovado' ? `<button class="btn btn-secondary btn-sm" onclick="verListaCompras('${o.id}')">Compras</button>` : ''}
          ${o.status === 'Aprovado' ? `<button class="btn btn-success btn-sm" onclick="converterEmProjeto('${o.id}')">Projeto</button>` : ''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirOrc('${o.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

async function mudarStatusOrc(id, novoStatus) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  o.status = novoStatus;
  await Sheets.atualizar(CONFIG.SHEETS.ORCAMENTOS, id, { ...o, status: novoStatus, atualizado_em: hoje() });
  mostrarToast('Status: ' + novoStatus, 'success');
  renderOrcMetricas();
}

// ─── EDITOR ───────────────────────────────────────────────────────────────
async function novoOrcamento() {
  window._orcAtual     = null;
  window._orcAmbientes = [];
  await carregarDados([CONFIG.SHEETS.CLIENTES, CONFIG.SHEETS.ORCAMENTOS]);
  renderEditorOrc();
}

async function abrirEditorOrc(id) {
  await carregarDados([CONFIG.SHEETS.ORCAMENTOS, CONFIG.SHEETS.CLIENTES]);
  window._orcAtual = (window.DB.orcamentos || []).find(o => o.id === id) || null;
  try {
    window._orcAmbientes = window._orcAtual?.ambientes_json
      ? JSON.parse(window._orcAtual.ambientes_json) : [];
  } catch(e) { window._orcAmbientes = []; }
  renderEditorOrc();
}

function renderEditorOrc(abaAtiva) {
  abaAtiva = abaAtiva || 'dados';
  const o = window._orcAtual;
  const clientes = window.DB.clientes || [];
  const v = (k) => o ? (o[k] || '') : '';
  const container = document.getElementById('page-container');

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-secondary btn-sm" onclick="renderOrcamentos()">← Voltar</button>
        <div>
          <h1 class="page-title">${o ? 'Orçamento ' + o.numero : 'Novo Orçamento'}</h1>
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
      <button class="orc-tab ${abaAtiva==='precificacao'?'active':''}" onclick="trocarAbaOrc('precificacao',this)">Precificação</button>
    </div>

    <!-- ABA DADOS -->
    <div id="orc-aba-dados" style="display:${abaAtiva==='dados'?'block':'none'}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <!-- Card Cliente -->
        <div class="card">
          <div class="card-title">Cliente</div>
          <div class="input-group">
            <label>Cliente *</label>
            <select id="oc-cliente_id">
              <option value="">Selecione...</option>
              ${clientes.map(c => `<option value="${c.id}" data-nome="${c.nome}" ${v('cliente_id')===c.id?'selected':''}>${c.nome}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label>Data</label>
            <input type="date" id="oc-data" value="${v('data') || hoje()}" />
          </div>
        </div>
        <!-- Card Projeto -->
        <div class="card">
          <div class="card-title">Projeto</div>
          <div class="input-group">
            <label>Descrição *</label>
            <input id="oc-descricao" value="${v('descricao')}" placeholder="Ex: Cozinha planejada residencial" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="input-group">
              <label>Prazo de entrega</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" min="1" id="oc-prazo_entrega" value="${v('prazo_entrega')}" placeholder="0" style="flex:1;" />
                <span style="font-size:12px;color:var(--text-3);white-space:nowrap;">dias úteis</span>
              </div>
            </div>
            <div class="input-group">
              <label>Garantia</label>
              <input id="oc-garantia" value="${v('garantia') || '180 dias conforme CDC art. 50'}" />
            </div>
          </div>
          <div class="input-group">
            <label>Observações</label>
            <textarea id="oc-observacoes" rows="3">${v('observacoes')}</textarea>
          </div>
        </div>
      </div>

      <!-- Card Condições Comerciais (full width) -->
      <div class="card">
        <div class="card-title" style="margin-bottom:14px;">Condições de pagamento</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${(() => {
            const pgtos = parsePagamentos(v('forma_pagamento'));
            return pgtos.map(p => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:var(--bg-2);border-radius:var(--radius);border:1px solid ${p.ativo ? 'var(--accent)' : 'var(--border)'};">
                <input type="checkbox" id="pgto-ativo-${p.id}" ${p.ativo ? 'checked' : ''}
                  style="margin-top:3px;flex-shrink:0;cursor:pointer;accent-color:var(--accent);"
                  onchange="
                    const txt=document.getElementById('pgto-txt-${p.id}');
                    txt.disabled=!this.checked;
                    this.closest('div').style.borderColor=this.checked?'var(--accent)':'var(--border)';
                  " />
                <div style="flex:1;min-width:0;">
                  <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;">${p.label}</div>
                  <input id="pgto-txt-${p.id}" value="${p.texto.replace(/"/g, '&quot;')}"
                    ${p.ativo ? '' : 'disabled'}
                    placeholder="${p.texto}"
                    style="width:100%;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:12px;opacity:${p.ativo ? '1' : '0.45'};"
                    onfocus="this.style.opacity='1'"
                    onblur="if(!document.getElementById('pgto-ativo-${p.id}').checked)this.style.opacity='0.45'" />
                </div>
              </div>`).join('');
          })()}
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-3);">Marque as opções que serão apresentadas ao cliente no PDF. O texto de cada opção pode ser editado livremente.</div>
      </div>
    </div>

    <!-- ABA AMBIENTES -->
    <div id="orc-aba-ambientes" style="display:${abaAtiva==='ambientes'?'block':'none'}">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
        <button class="btn btn-secondary" onclick="adicionarAmbiente()">+ Ambiente</button>
      </div>
      <div id="orc-ambientes-lista"></div>
      <div id="orc-ambientes-vazio" style="display:none;text-align:center;padding:40px;color:var(--text-3);">
        Nenhum ambiente. Clique em "+ Ambiente" para começar.
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
        <div style="font-size:14px;color:var(--text-2);">Custo total dos itens: <strong id="orc-custo-total" style="color:var(--accent);font-size:16px;">R$ 0,00</strong></div>
      </div>
    </div>

    <!-- ABA PRECIFICAÇÃO -->
    <div id="orc-aba-precificacao" style="display:${abaAtiva==='precificacao'?'block':'none'}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <!-- Mão de obra -->
          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              Mão de obra
              <span id="pc-mao-badge" style="font-size:11px;padding:2px 10px;border-radius:999px;background:var(--bg-3);color:var(--text-3);">Geral</span>
            </div>
            <div id="pc-mao-por-item-aviso" style="display:none;padding:8px 12px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:var(--radius);font-size:12px;color:var(--accent);margin-bottom:12px;">
              Mão de obra definida por item. Campos globais desabilitados.
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="input-group"><label>Horas estimadas</label>
                <input type="number" step="0.5" id="pc-horas" value="${v('horas_mao_obra') || '0'}" oninput="calcPrecificacao()" />
              </div>
              <div class="input-group"><label>Valor por hora (R$)</label>
                <input type="number" step="0.01" id="pc-valor_hora" value="${v('valor_hora') || '0'}" oninput="calcPrecificacao()" />
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-3);text-align:right;margin-top:-4px;margin-bottom:14px;">
              Total: <strong id="pc-total-mao" style="color:var(--accent)">R$ 0,00</strong>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-2);border-radius:var(--radius);margin-bottom:8px;">
              <span style="font-size:13px;">Exibir como linha separada no PDF</span>
              <input type="checkbox" id="pc-mao-exibir" ${v('mao_obra_exibir')==='sim'?'checked':''}
                style="cursor:pointer;accent-color:var(--accent);"
                onchange="toggleMaoObraRotulo(this.checked);calcPrecificacao()" />
            </div>
            <div id="pc-mao-rotulo-wrap" style="display:${v('mao_obra_exibir')==='sim'?'block':'none'}">
              <div class="input-group"><label>Rótulo no PDF</label>
                <select id="pc-mao-rotulo" onchange="document.getElementById('pc-mao-rotulo-custom-wrap').style.display=this.value==='outro'?'block':'none'">
                  ${['Fabricação','Fabricação e instalação','Instalação','Montagem','Mão de obra'].map(r =>
                    `<option value="${r}" ${v('mao_obra_rotulo')===r?'selected':''}>${r}</option>`
                  ).join('')}
                  <option value="outro" ${(v('mao_obra_rotulo') && !['Fabricação','Fabricação e instalação','Instalação','Montagem','Mão de obra'].includes(v('mao_obra_rotulo')))?'selected':''}>Outro (digitar)</option>
                </select>
              </div>
              <div id="pc-mao-rotulo-custom-wrap" style="display:${(v('mao_obra_rotulo') && !['Fabricação','Fabricação e instalação','Instalação','Montagem','Mão de obra'].includes(v('mao_obra_rotulo')))?'block':'none'}">
                <div class="input-group"><label>Texto personalizado</label>
                  <input id="pc-mao-rotulo-custom" value="${(v('mao_obra_rotulo') && !['Fabricação','Fabricação e instalação','Instalação','Montagem','Mão de obra'].includes(v('mao_obra_rotulo')))?v('mao_obra_rotulo'):''}" placeholder="Digite o rótulo..." />
                </div>
              </div>
            </div>
          </div>

          <!-- Combustível -->
          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:12px;">Combustível / Deslocamento</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="input-group"><label>Distância (km)</label>
                <input type="number" step="0.1" id="pc-km"
                  value="${v('km_entrega') || '0'}"
                  oninput="calcPrecificacao()" />
              </div>
              <div class="input-group"><label>Custo por km (R$)</label>
                <input type="number" step="0.01" id="pc-custo-km"
                  value="${v('custo_km') || '0'}"
                  oninput="calcPrecificacao()" />
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-3);text-align:right;margin-top:-4px;margin-bottom:14px;">
              Total: <strong id="pc-total-comb" style="color:var(--accent)">R$ 0,00</strong>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-2);border-radius:var(--radius);">
              <span style="font-size:13px;">Exibir como "Deslocamento" no PDF</span>
              <input type="checkbox" id="pc-comb-exibir" ${v('combustivel_exibir')==='sim'?'checked':''}
                style="cursor:pointer;accent-color:var(--accent);" onchange="calcPrecificacao()" />
            </div>
          </div>

          <!-- Margem e imposto -->
          <div class="card">
            <div class="card-title" style="margin-bottom:12px;">Margem e impostos</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="input-group"><label>Margem de lucro (%)</label>
                <input type="number" step="0.1" id="pc-margem" value="${v('margem_pct') || '30'}" oninput="calcPrecificacao()" />
              </div>
              <div class="input-group"><label>Alíquota imposto (%)</label>
                <input type="number" step="0.01" id="pc-aliquota"
                  value="${v('aliquota_pct') !== '' ? v('aliquota_pct') : (v('considerar_imposto')==='sim' ? ((parseFloat(window._sysConfig?.aliquota||CONFIG.DEFAULTS.ALIQUOTA_SIMPLES)*100).toFixed(2)) : ((parseFloat(window._sysConfig?.aliquota||CONFIG.DEFAULTS.ALIQUOTA_SIMPLES)*100).toFixed(2)))}"
                  oninput="calcPrecificacao()" />
              </div>
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:8px;">Use 0 para não incluir imposto. Margem e imposto sempre diluídos proporcionalmente entre os itens.</div>
          </div>
        </div>

        <!-- Resultado -->
        <div class="card">
          <div class="card-title">Resultado</div>
          <table style="width:100%;font-size:13px;margin-bottom:8px;">
            <tr><td style="padding:6px 0;color:var(--text-2)">Custo dos materiais</td><td id="pr-custo-itens" style="text-align:right">R$ 0,00</td></tr>
            <tr id="pr-mao-item-row" style="display:none"><td style="padding:6px 0;color:var(--text-2)">Mão de obra (por item)</td><td id="pr-mao-item" style="text-align:right">R$ 0,00</td></tr>
            <tr id="pr-mao-row"><td style="padding:6px 0;color:var(--text-2)">Mão de obra</td><td id="pr-mao-obra" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Combustível</td><td id="pr-entrega" style="text-align:right">R$ 0,00</td></tr>
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:8px 0;color:var(--text-2)">Subtotal custo</td>
              <td id="pr-subtotal" style="text-align:right;font-weight:600">R$ 0,00</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:var(--text-2)" id="pr-margem-label">Margem 30%</td>
              <td id="pr-margem" style="text-align:right;color:var(--accent)">R$ 0,00</td>
            </tr>
            <tr id="pr-imp-row" style="display:none">
              <td style="padding:6px 0;color:var(--text-2)" id="pr-imp-label">Imposto 6%</td>
              <td id="pr-imposto" style="text-align:right;color:var(--yellow)">R$ 0,00</td>
            </tr>
            <tr style="border-top:2px solid var(--accent)">
              <td style="padding:12px 0;font-size:15px;font-weight:700;">PREÇO FINAL</td>
              <td id="pr-final" style="text-align:right;font-size:22px;font-weight:800;color:var(--accent)">R$ 0,00</td>
            </tr>
          </table>
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
  calcPrecificacao();
}

function adicionarItem(ambId) {
  const amb = window._orcAmbientes.find(a => a.id === ambId);
  if (!amb) return;
  amb.itens.push({
    id: gerarId(), nome: '', descricao: '', material: '',
    dim_l: '', dim_a: '', dim_p: '', obs: '', aberto: true,
    horas_mao_obra: '', valor_hora: '',
    mostrar_componentes: false,
    componentes: [{ desc: '', qtd: 1, unid: 'un', preco: 0 }]
  });
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
  const item = window._orcAmbientes.find(a => a.id === ambId)?.itens.find(i => i.id === itemId);
  if (!item) return;
  item.componentes.push({ desc: '', qtd: 1, unid: 'un', preco: 0 });
  renderAmbientes();
}

function removerComponente(ambId, itemId, idx) {
  sincronizarCamposItem(ambId, itemId);
  const item = window._orcAmbientes.find(a => a.id === ambId)?.itens.find(i => i.id === itemId);
  if (!item || item.componentes.length <= 1) return;
  item.componentes.splice(idx, 1);
  renderAmbientes();
  calcPrecificacao();
}

function toggleItem(ambId, itemId) {
  sincronizarCamposItem(ambId, itemId);
  const item = window._orcAmbientes.find(a => a.id === ambId)?.itens.find(i => i.id === itemId);
  if (!item) return;
  item.aberto = !item.aberto;
  renderAmbientes();
}

function sincronizarCamposItem(ambId, itemId) {
  const item = window._orcAmbientes.find(a => a.id === ambId)?.itens.find(i => i.id === itemId);
  if (!item) return;
  // Só sincroniza se o item estiver aberto (inputs existem no DOM)
  const nomeEl = document.getElementById('item-nome-' + itemId);
  if (!nomeEl) return;
  item.nome      = nomeEl.value || '';
  item.descricao = document.getElementById('item-desc-' + itemId)?.value || '';
  item.material  = document.getElementById('item-mat-'  + itemId)?.value || '';
  item.dim_l     = document.getElementById('item-diml-' + itemId)?.value || '';
  item.dim_a     = document.getElementById('item-dima-' + itemId)?.value || '';
  item.dim_p     = document.getElementById('item-dimp-' + itemId)?.value || '';
  item.obs                 = document.getElementById('item-obs-'         + itemId)?.value || '';
  item.horas_mao_obra      = document.getElementById('item-horas-'       + itemId)?.value || '';
  item.valor_hora          = document.getElementById('item-valorhora-'   + itemId)?.value || '';
  item.mostrar_componentes = document.getElementById('item-comp-visivel-'+ itemId)?.checked || false;
  item.componentes.forEach((c, idx) => {
    const descEl = document.getElementById('comp-desc-' + itemId + '-' + idx);
    if (!descEl) return;
    c.desc  = descEl.value || '';
    c.qtd   = parseFloat(document.getElementById('comp-qtd-'   + itemId + '-' + idx)?.value) || 0;
    c.unid  = document.getElementById('comp-unid-'  + itemId + '-' + idx)?.value || 'un';
    c.preco = parseFloat(document.getElementById('comp-preco-' + itemId + '-' + idx)?.value) || 0;
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

function temMaoObraPorItem() {
  return (window._orcAmbientes || []).some(amb =>
    (amb.itens || []).some(item => parseFloat(item.horas_mao_obra) > 0 && parseFloat(item.valor_hora) > 0)
  );
}
function calcMaoObraItens() {
  return (window._orcAmbientes || []).reduce((s, amb) =>
    s + (amb.itens || []).reduce((ss, item) =>
      ss + (parseFloat(item.horas_mao_obra) || 0) * (parseFloat(item.valor_hora) || 0), 0), 0);
}
function toggleMaoObraRotulo(checked) {
  const wrap = document.getElementById('pc-mao-rotulo-wrap');
  if (wrap) wrap.style.display = checked ? 'block' : 'none';
}

// Calcula preço final rateado por item (para o PDF)
function calcRateioItens(o, ambientes) {
  const margem   = (parseFloat(o.margem_pct) || 0) / 100;
  const aliqPct  = (o.aliquota_pct !== undefined && o.aliquota_pct !== '')
    ? parseFloat(o.aliquota_pct)
    : (o.considerar_imposto === 'sim' ? (parseFloat(CONFIG.DEFAULTS.ALIQUOTA_SIMPLES) * 100) : 0);
  const aliquota = aliqPct / 100;

  const maoObraExibir     = o.mao_obra_exibir === 'sim';
  const combustivelExibir = o.combustivel_exibir === 'sim';
  const combustivelTotal  = (parseFloat(o.km_entrega || 0) * parseFloat(o.custo_km || 0)) ||
    (parseFloat(o.custo_combustivel) || 0);

  const hasPorItem = ambientes.some(amb =>
    (amb.itens || []).some(item => parseFloat(item.horas_mao_obra) > 0)
  );
  const maoObraGlobal = (parseFloat(o.horas_mao_obra) || 0) * (parseFloat(o.valor_hora) || 0);

  // O que entra no rateio (diluído nos itens)
  const dilutedLabor = maoObraExibir ? 0 : (hasPorItem ? 0 : maoObraGlobal);
  const dilutedFuel  = combustivelExibir ? 0 : combustivelTotal;
  const totalDiluted = dilutedLabor + dilutedFuel;

  // O que aparece como linha separada (já com margem e imposto)
  const shownLaborRaw = maoObraExibir
    ? (hasPorItem
        ? ambientes.reduce((s, amb) => s + (amb.itens||[]).reduce((ss, i) =>
            ss + (parseFloat(i.horas_mao_obra)||0)*(parseFloat(i.valor_hora)||0), 0), 0)
        : maoObraGlobal)
    : 0;
  const shownFuelRaw  = combustivelExibir ? combustivelTotal : 0;

  // Base por item
  const entries = [];
  let totalBase = 0;
  ambientes.forEach(amb => {
    (amb.itens || []).forEach(item => {
      const mat   = (item.componentes||[]).reduce((s, c) => s + (c.qtd||0)*(c.preco||0), 0);
      const labor = hasPorItem ? (parseFloat(item.horas_mao_obra)||0)*(parseFloat(item.valor_hora)||0) : 0;
      const base  = mat + labor;
      entries.push({ itemId: item.id, base });
      totalBase += base;
    });
  });

  const n = entries.length || 1;
  entries.forEach(e => {
    const ratio    = totalBase > 0 ? e.base / totalBase : 1 / n;
    e.finalPrice   = (e.base + ratio * totalDiluted) * (1 + margem) * (1 + aliquota);
  });

  const priceMap = {};
  entries.forEach(e => { priceMap[e.itemId] = e.finalPrice; });

  return {
    priceMap,
    shownLabor:      shownLaborRaw  * (1 + margem) * (1 + aliquota),
    shownFuel:       shownFuelRaw   * (1 + margem) * (1 + aliquota),
    maoObraExibir,
    combustivelExibir,
    maoObraRotulo:   o.mao_obra_rotulo || 'Mão de obra',
  };
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
      ${!amb.itens.length
        ? `<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px;">Nenhum item. Clique em "+ Item".</div>`
        : amb.itens.map(item => {
            const totalItem = calcTotalItem(item);
            const dimStr = [item.dim_l, item.dim_a, item.dim_p].filter(Boolean).join(' × ');
            return `
            <div style="border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer;background:var(--bg-2);border-radius:${item.aberto ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)'};"
                onclick="sincronizarCamposItem('${amb.id}','${item.id}');toggleItem('${amb.id}','${item.id}')">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-size:12px;color:var(--text-3)">${item.aberto ? '▼' : '▶'}</span>
                  <span style="font-size:14px;font-weight:500;">${item.nome || 'Novo item'}</span>
                  ${item.material ? `<span style="font-size:11px;color:var(--text-3);background:var(--bg-3);padding:2px 8px;border-radius:999px;">${item.material}</span>` : ''}
                  ${dimStr ? `<span style="font-size:11px;color:var(--text-3);">${dimStr} cm</span>` : ''}
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
                    <input id="item-nome-${item.id}" value="${item.nome || ''}" placeholder="Ex: Balcão cozinha Vista A"
                      oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                  </div>
                  <div class="input-group" style="margin:0;"><label>Material principal</label>
                    <input id="item-mat-${item.id}" value="${item.material || ''}" placeholder="Ex: MDF Palha Duratex"
                      oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                  <div class="input-group" style="margin:0;"><label>Descrição</label>
                    <input id="item-desc-${item.id}" value="${item.descricao || ''}" placeholder="Ex: 2 gavetas, 2 portas de giro"
                      oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                  </div>
                  <div class="input-group" style="margin:0;">
                    <label>Dimensões (cm) — L / A / P</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                      <div>
                        <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;text-align:center;">Largura</div>
                        <input type="number" id="item-diml-${item.id}" value="${item.dim_l || ''}" placeholder="0"
                          style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;text-align:center;"
                          oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                      </div>
                      <div>
                        <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;text-align:center;">Altura</div>
                        <input type="number" id="item-dima-${item.id}" value="${item.dim_a || ''}" placeholder="0"
                          style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;text-align:center;"
                          oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                      </div>
                      <div>
                        <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;text-align:center;">Profundidade</div>
                        <input type="number" id="item-dimp-${item.id}" value="${item.dim_p || ''}" placeholder="0"
                          style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;text-align:center;"
                          oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                      </div>
                    </div>
                  </div>
                </div>
                <div class="input-group" style="margin-bottom:12px;"><label style="color:var(--accent);">Observações</label>
                  <input id="item-obs-${item.id}" value="${item.obs || ''}" placeholder="Ex: Puxador a definir"
                    style="border-color:var(--accent);background:rgba(201,168,76,0.06);"
                    oninput="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
                  <div class="input-group" style="margin:0;">
                    <label style="color:var(--text-3);font-size:11px;">Horas mão de obra (opcional)</label>
                    <input type="number" step="0.5" id="item-horas-${item.id}" value="${item.horas_mao_obra || ''}" placeholder="0"
                      data-item-labor="1"
                      style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;"
                      oninput="sincronizarCamposItem('${amb.id}','${item.id}');calcPrecificacao()" />
                  </div>
                  <div class="input-group" style="margin:0;">
                    <label style="color:var(--text-3);font-size:11px;">Valor por hora R$ (opcional)</label>
                    <input type="number" step="0.01" id="item-valorhora-${item.id}" value="${item.valor_hora || ''}" placeholder="0"
                      data-item-labor="1"
                      style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;width:100%;"
                      oninput="sincronizarCamposItem('${amb.id}','${item.id}');calcPrecificacao()" />
                  </div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-2);border-radius:var(--radius);margin-bottom:10px;">
                  <span style="font-size:12px;color:var(--text-2);">Exibir componentes no PDF do cliente</span>
                  <input type="checkbox" id="item-comp-visivel-${item.id}" ${item.mostrar_componentes ? 'checked' : ''}
                    style="cursor:pointer;accent-color:var(--accent);"
                    onchange="sincronizarCamposItem('${amb.id}','${item.id}')" />
                </div>
                <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Componentes / materiais</div>
                <div style="display:grid;grid-template-columns:2fr 70px 80px 110px 36px;gap:6px;font-size:11px;color:var(--text-3);padding-bottom:4px;border-bottom:1px solid var(--border);margin-bottom:4px;">
                  <span>Descrição</span><span>Qtd</span><span>Unid</span><span>R$/un</span><span></span>
                </div>
                ${item.componentes.map((c, idx) => `
                  <div style="display:grid;grid-template-columns:2fr 70px 80px 110px 36px;gap:6px;margin-bottom:4px;align-items:center;">
                    <input id="comp-desc-${item.id}-${idx}" value="${c.desc || ''}" placeholder="Ex: Corrediça oculta"
                      style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 8px;color:var(--text);font-size:13px;"
                      oninput="sincronizarCamposItem('${amb.id}','${item.id}');atualizarTotalItem('${amb.id}','${item.id}')" />
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
  const item = window._orcAmbientes.find(a => a.id === ambId)?.itens.find(i => i.id === itemId);
  if (!item) return;
  const el = document.getElementById('total-item-' + itemId);
  if (el) el.textContent = formatMoeda(calcTotalItem(item));
  atualizarCustoTotal();
  calcPrecificacao();
}

function atualizarCustoTotal() {
  const el = document.getElementById('orc-custo-total');
  if (el) el.textContent = formatMoeda(calcCustoTotal());
}

// ─── PRECIFICAÇÃO ─────────────────────────────────────────────────────────
function calcPrecificacao() {
  const porItem      = temMaoObraPorItem();
  const maoObraItens = calcMaoObraItens();
  const custoMat     = calcCustoTotal();

  const horasEl     = document.getElementById('pc-horas');
  const valorHoraEl = document.getElementById('pc-valor_hora');
  const aviso       = document.getElementById('pc-mao-por-item-aviso');
  const badge       = document.getElementById('pc-mao-badge');

  // Bloquear global se por-item está ativo
  if (horasEl)     horasEl.disabled     = porItem;
  if (valorHoraEl) valorHoraEl.disabled = porItem;
  if (aviso)       aviso.style.display  = porItem ? 'block' : 'none';
  if (badge) {
    badge.textContent      = porItem ? 'Por item' : 'Geral';
    badge.style.color      = porItem ? 'var(--accent)' : 'var(--text-3)';
    badge.style.background = porItem ? 'rgba(201,168,76,.12)' : 'var(--bg-3)';
  }

  // Bloquear por-item se global está preenchido
  const maoGeralVal = (parseFloat(horasEl?.value)||0) * (parseFloat(valorHoraEl?.value)||0);
  const itemBloqueado = !porItem && maoGeralVal > 0;
  document.querySelectorAll('[data-item-labor]').forEach(el => {
    el.disabled     = itemBloqueado;
    el.style.opacity = itemBloqueado ? '0.4' : '1';
  });

  const horas      = parseFloat(horasEl?.value) || 0;
  const valorHora  = parseFloat(valorHoraEl?.value) || 0;
  const maoObra    = porItem ? maoObraItens : (horas * valorHora);
  const km         = parseFloat(document.getElementById('pc-km')?.value) || 0;
  const custoKm    = parseFloat(document.getElementById('pc-custo-km')?.value) || 0;
  const combustivel = km * custoKm;
  const totalCombEl = document.getElementById('pc-total-comb');
  if (totalCombEl) totalCombEl.textContent = formatMoeda(combustivel);
  const margem     = (parseFloat(document.getElementById('pc-margem')?.value) || 0) / 100;
  const aliquota   = (parseFloat(document.getElementById('pc-aliquota')?.value) || 0) / 100;

  const subtotal  = custoMat + maoObra + combustivel;
  const comMargem = subtotal * (1 + margem);
  const final     = comMargem * (1 + aliquota);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatMoeda(val); };
  set('pr-custo-itens', custoMat);
  set('pr-subtotal', subtotal);
  set('pr-margem', comMargem - subtotal);
  set('pr-final', final);
  set('pc-total-mao', maoObra);
  set('pr-entrega', combustivel);

  const maoItemRow = document.getElementById('pr-mao-item-row');
  const maoRow     = document.getElementById('pr-mao-row');
  if (porItem) {
    if (maoItemRow) { maoItemRow.style.display = ''; set('pr-mao-item', maoObraItens); }
    if (maoRow)     maoRow.style.display = 'none';
  } else {
    if (maoItemRow) maoItemRow.style.display = 'none';
    if (maoRow)     { maoRow.style.display = ''; set('pr-mao-obra', maoObra); }
  }

  const ml = document.getElementById('pr-margem-label');
  if (ml) ml.textContent = 'Margem ' + (margem * 100).toFixed(0) + '%';
  const ir = document.getElementById('pr-imp-row');
  if (ir) ir.style.display = aliquota > 0 ? '' : 'none';
  if (aliquota > 0) {
    set('pr-imposto', final - comMargem);
    const il = document.getElementById('pr-imp-label');
    if (il) il.textContent = 'Imposto ' + (aliquota * 100).toFixed(2) + '%';
  }

  window._valorFinalCalculado = final;
  atualizarCustoTotal();
}

// ─── SALVAR ───────────────────────────────────────────────────────────────
async function salvarOrcamentoEditor(fecharDepois) {
  // Sincroniza todos os itens abertos antes de salvar
  (window._orcAmbientes || []).forEach(amb =>
    amb.itens.forEach(item => sincronizarCamposItem(amb.id, item.id)));

  const sel = document.getElementById('oc-cliente_id');
  const opt = sel?.options[sel?.selectedIndex];
  const clienteId   = sel?.value || '';
  const clienteNome = opt?.dataset?.nome || '';
  const descricao   = document.getElementById('oc-descricao')?.value || '';

  if (!clienteId) { mostrarToast('Selecione um cliente', 'error'); return; }
  if (!descricao) { mostrarToast('Informe a descrição do projeto', 'error'); return; }

  calcPrecificacao();
  const valorFinal = (window._valorFinalCalculado || 0).toFixed(2);

  const obj = {
    cliente_id:         clienteId,
    cliente_nome:       clienteNome,
    data:               document.getElementById('oc-data')?.value || hoje(),
    descricao,
    forma_pagamento:    JSON.stringify(ORC_FORMAS_PAGAMENTO.map(f => ({
                          id:    f.id,
                          label: f.label,
                          ativo: document.getElementById('pgto-ativo-' + f.id)?.checked || false,
                          texto: document.getElementById('pgto-txt-'  + f.id)?.value  || f.texto,
                        }))),
    prazo_entrega:      document.getElementById('oc-prazo_entrega')?.value || '',
    garantia:           document.getElementById('oc-garantia')?.value || '',
    observacoes:        document.getElementById('oc-observacoes')?.value || '',
    horas_mao_obra:     document.getElementById('pc-horas')?.value || '0',
    valor_hora:         document.getElementById('pc-valor_hora')?.value || '0',
    km_entrega:         document.getElementById('pc-km')?.value || '0',
    custo_km:           document.getElementById('pc-custo-km')?.value || '0',
    custo_combustivel:  ((parseFloat(document.getElementById('pc-km')?.value)||0) * (parseFloat(document.getElementById('pc-custo-km')?.value)||0)).toFixed(2),
    mao_obra_exibir:    document.getElementById('pc-mao-exibir')?.checked ? 'sim' : 'nao',
    mao_obra_rotulo:    (() => {
                          const sel = document.getElementById('pc-mao-rotulo')?.value;
                          return sel === 'outro'
                            ? (document.getElementById('pc-mao-rotulo-custom')?.value || 'Mão de obra')
                            : (sel || 'Mão de obra');
                        })(),
    combustivel_exibir: document.getElementById('pc-comb-exibir')?.checked ? 'sim' : 'nao',
    aliquota_pct:       document.getElementById('pc-aliquota')?.value || '0',
    margem_pct:         document.getElementById('pc-margem')?.value || '30',
    custo_total_itens:  calcCustoTotal().toFixed(2),
    valor_final:        valorFinal,
    ambientes_json:     JSON.stringify(window._orcAmbientes),
    status:             window._orcAtual?.status || 'Rascunho',
  };

  mostrarToast('Salvando...', '');
  const id = window._orcAtual?.id;
  if (id) {
    obj.id = id; obj.atualizado_em = hoje();
    await Sheets.atualizar(CONFIG.SHEETS.ORCAMENTOS, id, obj);
    window._orcAtual = { ...window._orcAtual, ...obj };
    mostrarToast('Orçamento atualizado ✓', 'success');
  } else {
    obj.id = gerarId();
    obj.numero = gerarNumero('ORC', window.DB.orcamentos || []);
    obj.criado_em = hoje(); obj.atualizado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.ORCAMENTOS, obj);
    window._orcAtual = obj;
    if (window.DB.orcamentos) window.DB.orcamentos.push(obj);
    mostrarToast('Orçamento criado ✓', 'success');
    const title = document.querySelector('.page-title');
    if (title) title.textContent = 'Orçamento ' + obj.numero;
    const sub = document.querySelector('.page-subtitle');
    if (sub) sub.textContent = clienteNome;
  }

  if (fecharDepois) {
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS]);
    renderOrcamentos();
  }
}

// ─── EXPORTAR PDF ─────────────────────────────────────────────────────────
async function gerarPDFOrcamento(id) {
  if (!window._sysConfig) await carregarConfiguracoes();
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  let ambientes = [];
  try { ambientes = JSON.parse(o.ambientes_json || '[]'); } catch(e) {}

  const cfg = window._sysConfig || {};
  const empresa = {
    nome:       cfg.empresa_nome       || 'Móveis e Esquadrias Werner',
    cnpj:       cfg.empresa_cnpj       || '',
    telefone:   cfg.empresa_telefone   || '',
    email:      cfg.empresa_email      || '',
    logradouro: cfg.empresa_logradouro || '',
    numero:     cfg.empresa_numero     || '',
    bairro:     cfg.empresa_bairro     || '',
    cep:        cfg.empresa_cep        || '',
    cidade:     cfg.empresa_cidade     || '',
    estado:     cfg.empresa_estado     || 'SC',
  };
  const cliente = (window.DB.clientes || []).find(c => c.id === o.cliente_id) || {};
  const cidadeCliente = [cliente.cidade, cliente.estado].filter(Boolean).join(' - ');

  const rateio   = calcRateioItens(o, ambientes);
  const ambHtml  = ambientes.map(amb => {
    const totalAmb = (amb.itens||[]).reduce((s, item) => s + (rateio.priceMap[item.id] || 0), 0);
    return '<tr style="background:#2a2a2a;"><td colspan="4" style="padding:10px 16px;font-family:\'DM Serif Display\',serif;font-size:13px;font-weight:600;color:#C9A84C;letter-spacing:1px;text-transform:uppercase;">' + amb.nome + '</td></tr>' +
      (amb.itens||[]).map(item => {
        const finalItem = rateio.priceMap[item.id] || 0;
        const dim = [item.dim_l, item.dim_a, item.dim_p].filter(Boolean).join(' × ');
        const compVisiveis = item.mostrar_componentes
          ? (item.componentes||[]).filter(c => c.desc && c.desc.trim())
          : [];
        return '<tr style="border-bottom:1px solid #2a2a2a;">' +
          '<td style="padding:10px 16px;font-size:13px;vertical-align:top;"><div style="font-weight:500;">' + (item.nome||'-') + '</div>' +
          (item.descricao ? '<div style="font-size:11px;color:#7A7060;margin-top:3px;">' + item.descricao + '</div>' : '') +
          (item.obs ? '<div style="font-size:11px;color:#C9A84C;font-style:italic;margin-top:3px;padding:3px 8px;background:rgba(201,168,76,0.08);border-left:2px solid #C9A84C;">' + item.obs + '</div>' : '') +
          (compVisiveis.length ? '<div style="margin-top:7px;padding-left:10px;border-left:2px solid #D4C9B0;">' +
            compVisiveis.map(c => '<div style="font-size:10.5px;color:#7A7060;padding:1px 0;">' +
              (c.qtd > 0 ? '<span style="font-weight:500;color:#5A5040;">' + (c.qtd % 1 === 0 ? c.qtd : parseFloat(c.qtd).toFixed(2)) + ' ' + (c.unid||'un') + '</span> — ' : '') +
              c.desc + '</div>').join('') + '</div>' : '') +
          '</td><td style="padding:10px 16px;font-size:12px;color:#5A5040;vertical-align:top;">' + (item.material||'-') + '</td>' +
          '<td style="padding:10px 16px;font-size:12px;color:#5A5040;vertical-align:top;">' + (dim||'-') + '</td>' +
          '<td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;vertical-align:top;">' + formatMoeda(finalItem) + '</td></tr>';
      }).join('') +
      '<tr style="background:#F0EBE0;"><td colspan="3" style="padding:8px 16px;font-size:12px;font-weight:600;color:#7A7060;text-transform:uppercase;">Subtotal - ' + amb.nome + '</td>' +
      '<td style="padding:8px 16px;font-size:14px;font-weight:700;color:#C9A84C;text-align:right;">' + formatMoeda(totalAmb) + '</td></tr>';
  }).join('') +
  // Linhas separadas para mão de obra e combustível (quando exibir=sim)
  (rateio.shownLabor > 0 ? '<tr style="border-bottom:1px solid #2a2a2a;"><td style="padding:10px 16px;font-size:13px;font-style:italic;color:#9A8E7A;" colspan="3">' + rateio.maoObraRotulo + '</td><td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;">' + formatMoeda(rateio.shownLabor) + '</td></tr>' : '') +
  (rateio.shownFuel  > 0 ? '<tr style="border-bottom:1px solid #2a2a2a;"><td style="padding:10px 16px;font-size:13px;font-style:italic;color:#9A8E7A;" colspan="3">Deslocamento</td><td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right;">' + formatMoeda(rateio.shownFuel) + '</td></tr>' : '');

  const prazoStr = o.prazo_entrega ? o.prazo_entrega + ' dias úteis' : '-';
  const pgAtivos = parsePagamentos(o.forma_pagamento).filter(p => p.ativo);
  const pgHtml = pgAtivos.length
    ? pgAtivos.map(p => '<div style="display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid #E0D8C8;">' +
        '<span style="color:#C9A84C;font-size:14px;flex-shrink:0;">—</span>' +
        '<span style="font-size:12px;font-weight:500;">' + p.texto + '</span></div>').join('')
    : '<div style="font-size:12px;color:#9A8E7A;">—</div>';

  const win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orçamento ' + o.numero + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">' +
    '<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Inter,sans-serif;background:#F5F0E8;color:#1C1C1C;}@media print{.no-print{display:none;}@page{margin:0;size:A4;}}</style>' +
    '</head><body>' +
    '<div class="no-print" style="background:#333;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;">' +
    '<span style="color:#C9A84C;font-family:\'DM Serif Display\',serif;font-size:16px;">Orçamento ' + o.numero + '</span>' +
    '<button onclick="window.print()" style="background:#C9A84C;color:#1C1C1C;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:600;">Imprimir / Salvar PDF</button></div>' +
    '<div style="max-width:794px;margin:0 auto;background:#F5F0E8;min-height:1123px;">' +
    '<div style="background:#1C1C1C;padding:22px 50px;display:flex;justify-content:space-between;align-items:center;">' +
    '<div><div style="font-family:\'DM Serif Display\',serif;font-size:20px;color:#F5F0E8;">Móveis e Esquadrias <span style="color:#C9A84C;">Werner</span></div>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-style:italic;font-size:10px;color:#5A5040;margin-top:4px;">tradição · precisão · excelência</div></div>' +
    '<div style="text-align:right;">' +
    (empresa.email ? '<div style="font-size:10.5px;color:#B8974A;font-weight:500;">' + empresa.email + '</div>' : '') +
    (empresa.telefone ? '<div style="font-size:10px;color:#7A7060;margin-top:2px;">' + empresa.telefone + '</div>' : '') +
    (() => {
      const rua = [empresa.logradouro, empresa.numero].filter(Boolean).join(', ');
      const cidade = [empresa.cidade, empresa.estado].filter(Boolean).join(' - ');
      const linhas = [rua, empresa.bairro, [cidade, empresa.cep ? 'CEP ' + empresa.cep : ''].filter(Boolean).join(' · ')].filter(Boolean);
      return linhas.map(l => '<div style="font-size:10px;color:#7A7060;margin-top:1px;">' + l + '</div>').join('');
    })() +
    (empresa.cnpj ? '<div style="font-size:9.5px;color:#5A5040;margin-top:4px;">CNPJ ' + empresa.cnpj + '</div>' : '') +
    '</div></div>' +
    '<div style="height:2px;background:linear-gradient(90deg,#C9A84C,#E8D5A0,#C9A84C);"></div>' +
    '<div style="padding:20px 50px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #D4C9B0;">' +
    '<div><div style="font-size:11px;color:#9A8E7A;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Proposta Comercial</div>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-size:22px;font-weight:600;">Werner</div></div>' +
    '<div style="text-align:right;"><div style="font-family:\'DM Serif Display\',serif;font-size:16px;color:#C9A84C;font-weight:600;margin-bottom:4px;">' + o.numero + '</div>' +
    '<div style="font-size:11px;color:#7A7060;">Data: <strong style="color:#1C1C1C;">' + formatData(o.data) + '</strong></div></div></div>' +
    '<div style="margin-bottom:20px;"><div style="font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Cliente</div>' +
    '<div style="background:#EDE8DC;border-left:3px solid #C9A84C;padding:14px 20px;display:grid;grid-template-columns:1fr 1fr;gap:8px 30px;">' +
    '<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">Nome</div><div style="font-size:13px;">' + (o.cliente_nome||'-') + '</div></div>' +
    '<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">CPF / CNPJ</div><div style="font-size:13px;">' + (cliente.cpf_cnpj||'-') + '</div></div>' +
    '<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">Telefone</div><div style="font-size:13px;">' + (cliente.telefone||'-') + '</div></div>' +
    '<div><div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#9A8E7A;">Cidade</div><div style="font-size:13px;">' + (cidadeCliente||'-') + '</div></div>' +
    '</div></div>' +
    (o.descricao ? '<div style="margin-bottom:20px;"><div style="font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Projeto</div>' +
    '<div style="background:#EDE8DC;border-left:3px solid #C9A84C;padding:12px 20px;font-family:\'DM Serif Display\',serif;font-size:14px;">' + o.descricao + '</div></div>' : '') +
    '<div style="margin-bottom:20px;"><div style="font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">Itens do projeto</div>' +
    '<table style="width:100%;border-collapse:collapse;background:#fff;">' +
    '<thead><tr style="background:#1C1C1C;">' +
    '<th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:left;">Item</th>' +
    '<th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:left;">Material</th>' +
    '<th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:left;">Dim. (cm)</th>' +
    '<th style="padding:10px 16px;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B8974A;text-align:right;">Valor</th>' +
    '</tr></thead><tbody>' + ambHtml + '</tbody></table></div>' +
    '<div style="background:#1C1C1C;padding:12px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
    '<div style="font-size:10px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:#7A7060;">Valor total da proposta</div>' +
    '<div style="font-family:\'DM Serif Display\',serif;font-size:28px;color:#C9A84C;font-weight:600;">' + formatMoeda(o.valor_final) + '</div></div>' +
    '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:20px;">' +
    '<div style="padding:14px 16px;background:#EDE8DC;border-top:2px solid #C9A84C;"><div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A8E7A;margin-bottom:8px;">Condições de pagamento</div>' + pgHtml + '</div>' +
    '<div style="padding:14px 16px;background:#EDE8DC;border-top:2px solid #D4C9B0;"><div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A8E7A;margin-bottom:5px;">Prazo de entrega</div><div style="font-size:12px;font-weight:500;">' + prazoStr + '</div></div>' +
    '<div style="padding:14px 16px;background:#EDE8DC;border-top:2px solid #D4C9B0;"><div style="font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9A8E7A;margin-bottom:5px;">Garantia</div><div style="font-size:12px;font-weight:500;">' + (o.garantia||'180 dias - CDC art. 50') + '</div></div>' +
    '</div>' +
    (o.observacoes ? '<div style="font-size:12px;color:#7A7060;font-style:italic;margin-bottom:20px;">' + o.observacoes + '</div>' : '') +
    '</div>' +
    '<div style="background:#1C1C1C;padding:16px 50px;display:flex;justify-content:space-between;align-items:center;">' +
    '<div style="font-size:10.5px;color:#D4C9B0;font-weight:500;">' + empresa.nome + '</div>' +
    (empresa.cnpj ? '<div style="font-size:9.5px;color:#5A5040;">CNPJ ' + empresa.cnpj + '</div>' : '') +
    '</div></div></body></html>');
  win.document.close();
}

// ─── LISTA DE COMPRAS ─────────────────────────────────────────────────────
function verListaCompras(id) {
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
    const itens = Object.values(grupo).sort((a, b) => a.desc.localeCompare(b.desc));
    if (!itens.length) return '';
    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">${amb.nome}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${itens.map(i => `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 0;">${i.desc}</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;">${i.qtd%1===0?i.qtd:i.qtd.toFixed(2)} ${i.unid}</td>
          </tr>`).join('')}
        </table>
      </div>`;
  }).join('');

  const totalItens = Object.values(totalGeral).sort((a, b) => a.desc.localeCompare(b.desc));
  const totalHtml = totalItens.length ? `
    <div style="margin-top:8px;padding-top:12px;border-top:2px solid var(--accent);">
      <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">Total Geral</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${totalItens.map(i => `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:6px 0;">${i.desc}</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${i.qtd%1===0?i.qtd:i.qtd.toFixed(2)} ${i.unid}</td>
        </tr>`).join('')}
      </table>
    </div>` : '';

  abrirModal('Lista de compras — ' + o.numero, `
    <div style="max-height:60vh;overflow-y:auto;padding:4px 0;">
      ${ambsHtml || '<p style="color:var(--text-3)">Nenhum componente cadastrado.</p>'}
      ${totalHtml}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn btn-primary" onclick="imprimirListaCompras('${id}')">Imprimir</button>
    </div>`, 'modal-lg');
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
    const itens = Object.values(grupo).sort((a, b) => a.desc.localeCompare(b.desc));
    if (!itens.length) return '';
    return `<div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9A84C;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #C9A84C;">${amb.nome}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f0f0f0;">
          <th style="padding:6px 8px;text-align:left;font-weight:500;">Material</th>
          <th style="padding:6px 8px;text-align:right;font-weight:500;">Quantidade</th>
          <th style="padding:6px 8px;text-align:center;font-weight:500;">✓</th>
        </tr></thead>
        <tbody>${itens.map((i, n) => `<tr style="background:${n%2===0?'#fff':'#f9f9f9'};">
          <td style="padding:6px 8px;">${i.desc}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600;">${i.qtd%1===0?i.qtd:i.qtd.toFixed(2)} ${i.unid}</td>
          <td style="padding:6px 8px;text-align:center;"><input type="checkbox" /></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');

  const totalItens = Object.values(totalGeral).sort((a, b) => a.desc.localeCompare(b.desc));
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Lista de Compras — ${o.numero}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:30px;color:#1C1C1C;}
    @media print{.no-print{display:none;}@page{margin:20px;}}</style>
  </head><body>
    <div class="no-print" style="margin-bottom:20px;">
      <button onclick="window.print()" style="background:#C9A84C;color:#1C1C1C;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:600;">Imprimir</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #1C1C1C;">
      <div><div style="font-size:18px;font-weight:700;">Lista de Compras</div>
      <div style="font-size:13px;color:#666;margin-top:4px;">${o.numero} — ${o.cliente_nome} — ${o.descricao}</div></div>
      <div style="font-size:12px;color:#666;">Data: ${formatData(hoje())}</div>
    </div>
    ${ambsHtml}
    ${totalItens.length ? `<div style="margin-top:24px;padding-top:16px;border-top:2px solid #1C1C1C;">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;">TOTAL GERAL</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f0f0f0;">
          <th style="padding:6px 8px;text-align:left;font-weight:500;">Material</th>
          <th style="padding:6px 8px;text-align:right;font-weight:500;">Total</th>
          <th style="padding:6px 8px;text-align:center;font-weight:500;">✓</th>
        </tr></thead>
        <tbody>${totalItens.map((i, n) => `<tr style="background:${n%2===0?'#fff':'#f9f9f9'};">
          <td style="padding:6px 8px;">${i.desc}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600;">${i.qtd%1===0?i.qtd:i.qtd.toFixed(2)} ${i.unid}</td>
          <td style="padding:6px 8px;text-align:center;"><input type="checkbox" /></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
  </body></html>`);
  win.document.close();
  fecharModal();
}

// ─── CONVERTER EM PROJETO ─────────────────────────────────────────────────
async function converterEmProjeto(id) {
  const o = (window.DB.orcamentos || []).find(x => x.id === id);
  if (!o) return;
  confirmar(`Converter "${o.descricao}" em projeto?`, async () => {
    await carregarDados([CONFIG.SHEETS.PROJETOS]);
    const proj = {
      id:           gerarId(),
      numero:       gerarNumero('PROJ', window.DB.projetos || []),
      orcamento_id: o.id,
      cliente_id:   o.cliente_id,
      cliente_nome: o.cliente_nome,
      nome:         o.descricao,
      descricao:    o.descricao,
      data_inicio:  hoje(),
      prazo_entrega: o.prazo_entrega || '',
      valor_total:  o.valor_final,
      valor_recebido: '0',
      saldo_receber: o.valor_final,
      custo_previsto: o.custo_total_itens || '0',
      status:       'Em andamento',
      observacoes:  o.observacoes || '',
      criado_em:    hoje(),
      atualizado_em: hoje(),
    };
    await Sheets.adicionar(CONFIG.SHEETS.PROJETOS, proj);
    mostrarToast('Projeto ' + proj.numero + ' criado ✓', 'success');
  });
}

// ─── EXCLUIR ──────────────────────────────────────────────────────────────
function excluirOrc(id) {
  confirmar('Excluir este orçamento?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.ORCAMENTOS, id);
    mostrarToast('Orçamento excluído', 'success');
    await carregarDados([CONFIG.SHEETS.ORCAMENTOS]);
    renderOrcMetricas();
    aplicarFiltrosOrc();
  });
}
