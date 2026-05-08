// COMPRAS
function renderCompras() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Compras</h1><p class="page-subtitle">Registro de compras e entradas de material</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormCompra()">+ Nova Compra</button>
      </div>
    </div>
    <div id="comp-metricas" class="grid-4" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <select id="comp-periodo" onchange="aplicarFiltrosComp()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="30">Ultimos 30 dias</option>
        <option value="7">Ultimos 7 dias</option>
        <option value="90">Ultimos 90 dias</option>
        <option value="0">Tudo</option>
      </select>
      <select id="comp-fornecedor" onchange="aplicarFiltrosComp()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todos os fornecedores</option>
      </select>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar compra..." oninput="buscarComp(this.value)" />
        <span id="comp-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="comp-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.COMPRAS, CONFIG.SHEETS.COMPRA_ITENS, CONFIG.SHEETS.FORNECEDORES]);
    popularSelectFornComp();
    renderCompMetricas();
    aplicarFiltrosComp();
  });
}

function popularSelectFornComp() {
  const sel = document.getElementById('comp-fornecedor');
  if (!sel) return;
  (window.DB.fornecedores || []).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.razao_social;
    sel.appendChild(opt);
  });
}

function renderCompMetricas() {
  const compras = window.DB.compras || [];
  const itens = window.DB.compra_itens || [];
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const doMes = compras.filter(c => {
    const d = new Date(c.data + 'T00:00:00');
    return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
  });
  const totalMes = somarCampo(doMes, 'total');
  const totalGeral = somarCampo(compras, 'total');
  const nMes = doMes.length;
  // Segmento mais comprado
  const segCount = {};
  itens.forEach(i => { segCount[i.segmento] = (segCount[i.segmento] || 0) + (parseFloat(i.total) || 0); });
  const topSeg = Object.entries(segCount).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('comp-metricas').innerHTML = `
    <div class="metric-card accent"><div class="metric-label">Total no mes</div><div class="metric-value accent">${formatMoeda(totalMes)}</div><div class="metric-sub">${nMes} compras</div></div>
    <div class="metric-card"><div class="metric-label">Total geral</div><div class="metric-value">${formatMoeda(totalGeral)}</div></div>
    <div class="metric-card"><div class="metric-label">Total de compras</div><div class="metric-value">${compras.length}</div></div>
    <div class="metric-card"><div class="metric-label">Top segmento</div><div class="metric-value" style="font-size:14px">${topSeg ? topSeg[0] : '—'}</div><div class="metric-sub">${topSeg ? formatMoeda(topSeg[1]) : ''}</div></div>`;
}

window._compBusca = '';

function buscarComp(q) { window._compBusca = q.toLowerCase(); aplicarFiltrosComp(); }

function aplicarFiltrosComp() {
  let lista = window.DB.compras || [];
  const periodo = parseInt(document.getElementById('comp-periodo')?.value || '30');
  const fornId = document.getElementById('comp-fornecedor')?.value || '';
  if (periodo > 0) {
    const lim = new Date(); lim.setDate(lim.getDate() - periodo);
    lista = lista.filter(c => new Date(c.data + 'T00:00:00') >= lim);
  }
  if (fornId) lista = lista.filter(c => c.fornecedor_id === fornId);
  if (window._compBusca) lista = lista.filter(c => (c.fornecedor_nome + c.numero_nf + c.observacoes).toLowerCase().includes(window._compBusca));
  lista = lista.sort((a, b) => new Date(b.data) - new Date(a.data));
  renderTabelaComp(lista);
}

function renderTabelaComp(lista) {
  document.getElementById('comp-count').textContent = lista.length + ' compras';
  if (!lista.length) { document.getElementById('comp-table').innerHTML = estadoVazio('Nenhuma compra registrada'); return; }
  const itens = window.DB.compra_itens || [];
  document.getElementById('comp-table').innerHTML = `
    <table><thead><tr>
      <th>Data</th><th>Fornecedor</th><th>NF</th><th>Itens</th><th>Total</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c => {
        const itensComp = itens.filter(i => i.compra_id === c.id);
        return `<tr>
          <td style="color:var(--text-3)">${formatData(c.data)}</td>
          <td><strong>${c.fornecedor_nome || '—'}</strong></td>
          <td style="font-size:12px;color:var(--text-2)">${c.numero_nf || '—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${itensComp.length} item(ns)</td>
          <td style="font-weight:600;color:var(--accent)">${formatMoeda(c.total)}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm" onclick="verCompra('${c.id}')">Ver itens</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="excluirCompra('${c.id}')">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
}

// Estado da compra em andamento
window._compraAtual = { itens: [] };

function abrirFormCompra() {
  window._compraAtual = { itens: [] };
  const fornecedores = window.DB.fornecedores || [];
  const segs = ['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Seguranca','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'];
  const units = ['unidade','peca','m','m2','m3','kg','litro','chapa','rolo','caixa'];
  const html = `
    <div class="form-row cols-3">
      <div class="input-group"><label>Data *</label><input type="date" id="nc-data" value="${hoje()}" /></div>
      <div class="input-group"><label>Fornecedor</label>
        <select id="nc-fornecedor_id" onchange="preencherNomeFornComp()">
          <option value="">Selecione...</option>
          ${fornecedores.map(f => `<option value="${f.id}" data-nome="${f.razao_social}">${f.razao_social}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Numero NF</label><input id="nc-numero_nf" placeholder="Opcional" /></div>
    </div>
    <hr class="divider"/>
    <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:600;margin-bottom:12px;">Itens da compra</div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;">
      <span>Descricao</span><span>Segmento</span><span>Qtd</span><span>Unid.</span><span>Preco custo</span><span>Situacao</span><span></span>
    </div>
    <div id="nc-itens-lista"></div>
    <button class="btn btn-secondary btn-sm" onclick="adicionarItemCompra()" style="margin-top:8px;">+ Adicionar item</button>
    <hr class="divider"/>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:13px;color:var(--text-2)">Total da compra:</div>
      <div id="nc-total" style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:var(--accent)">R$ 0,00</div>
    </div>
    <div class="input-group" style="margin-top:16px;"><label>Observacoes</label><textarea id="nc-observacoes" rows="2"></textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="finalizarCompra()">Finalizar e lancar no Contas a Pagar</button>
    </div>`;
  abrirModal('Nova Compra', html, 'modal-lg');
  adicionarItemCompra();
}

function adicionarItemCompra() {
  const segs = ['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Seguranca','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'];
  const units = ['unidade','peca','m','m2','m3','kg','litro','chapa','rolo','caixa'];
  const idx = window._compraAtual.itens.length;
  window._compraAtual.itens.push({});
  const lista = document.getElementById('nc-itens-lista');
  const div = document.createElement('div');
  div.id = 'nc-item-' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;';
  div.innerHTML = `
    <input placeholder="Descricao *" id="ni-desc-${idx}" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
    <select id="ni-seg-${idx}" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:12px;">
      ${segs.map(s => `<option>${s}</option>`).join('')}
    </select>
    <input type="number" step="0.01" placeholder="Qtd" id="ni-qtd-${idx}" oninput="calcTotalComp()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
    <select id="ni-unit-${idx}" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:12px;">
      ${units.map(u => `<option>${u}</option>`).join('')}
    </select>
    <input type="number" step="0.01" placeholder="R$" id="ni-preco-${idx}" oninput="calcTotalComp()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
    <select id="ni-sit-${idx}" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:12px;">
      <option>Normal</option><option>Devolucao</option><option>Perda</option><option>Bonificacao</option>
    </select>
    <button onclick="removerItemCompra(${idx})" style="background:var(--red-bg);border:1px solid rgba(224,92,92,0.2);border-radius:var(--radius);padding:8px;color:var(--red);cursor:pointer;">✕</button>`;
  lista.appendChild(div);
}

function removerItemCompra(idx) {
  const el = document.getElementById('nc-item-' + idx);
  if (el) el.remove();
  calcTotalComp();
}

function calcTotalComp() {
  let total = 0;
  const itens = document.getElementById('nc-itens-lista');
  if (!itens) return;
  itens.querySelectorAll('[id^="ni-qtd-"]').forEach(el => {
    const idx = el.id.replace('ni-qtd-', '');
    const qtd = parseFloat(el.value) || 0;
    const preco = parseFloat(document.getElementById('ni-preco-' + idx)?.value) || 0;
    total += qtd * preco;
  });
  const totalEl = document.getElementById('nc-total');
  if (totalEl) totalEl.textContent = formatMoeda(total);
}

function preencherNomeFornComp() {}

async function finalizarCompra() {
  const fornSel = document.getElementById('nc-fornecedor_id');
  const fornOpt = fornSel.options[fornSel.selectedIndex];
  const data = document.getElementById('nc-data').value;
  if (!data) { mostrarToast('Informe a data', 'error'); return; }

  // Coleta itens
  const itensEl = document.getElementById('nc-itens-lista');
  const itensData = [];
  itensEl.querySelectorAll('[id^="ni-desc-"]').forEach(el => {
    const idx = el.id.replace('ni-desc-', '');
    const desc = el.value;
    if (!desc) return;
    const qtd = parseFloat(document.getElementById('ni-qtd-' + idx)?.value) || 0;
    const preco = parseFloat(document.getElementById('ni-preco-' + idx)?.value) || 0;
    itensData.push({
      descricao: desc,
      segmento: document.getElementById('ni-seg-' + idx)?.value || '',
      quantidade: qtd,
      unidade: document.getElementById('ni-unit-' + idx)?.value || '',
      preco_custo: preco,
      preco_venda: preco,
      total: (qtd * preco).toFixed(2),
      situacao: document.getElementById('ni-sit-' + idx)?.value || 'Normal',
    });
  });

  if (!itensData.length) { mostrarToast('Adicione ao menos um item', 'error'); return; }

  const total = itensData.reduce((acc, i) => acc + parseFloat(i.total), 0);
  const compraId = gerarId();
  const numero = gerarNumero('CMP', window.DB.compras || []);

  // Salva compra
  await Sheets.adicionar(CONFIG.SHEETS.COMPRAS, {
    id: compraId, numero, data,
    fornecedor_id: fornSel.value,
    fornecedor_nome: fornSel.value ? (fornOpt.dataset.nome || '') : '',
    numero_nf: document.getElementById('nc-numero_nf').value,
    total: total.toFixed(2),
    observacoes: document.getElementById('nc-observacoes').value,
    criado_em: hoje(),
  });

  // Salva itens e atualiza estoque
  for (const item of itensData) {
    await Sheets.adicionar(CONFIG.SHEETS.COMPRA_ITENS, { ...item, id: gerarId(), compra_id: compraId });
    if (item.situacao === 'Normal' || item.situacao === 'Bonificacao') {
      // Verifica se item ja existe no estoque
      const estoque = window.DB.estoque || [];
      const existente = estoque.find(e => e.nome.toLowerCase() === item.descricao.toLowerCase());
      if (existente) {
        const novaQtd = (parseFloat(existente.quantidade) || 0) + item.quantidade;
        const novoValor = item.situacao === 'Bonificacao' ? parseFloat(existente.valor_unitario_medio) : item.preco_custo;
        await Sheets.atualizar(CONFIG.SHEETS.ESTOQUE, existente.id, {
          ...existente, quantidade: novaQtd.toFixed(2),
          valor_unitario_medio: novoValor,
          valor_total: (novaQtd * novoValor).toFixed(2),
          atualizado_em: hoje(),
        });
      } else {
        await Sheets.adicionar(CONFIG.SHEETS.ESTOQUE, {
          id: gerarId(), nome: item.descricao, segmento: item.segmento,
          unidade: item.unidade, quantidade: item.quantidade,
          quantidade_minima: '0',
          valor_unitario_medio: item.situacao === 'Bonificacao' ? '0' : item.preco_custo,
          valor_total: item.situacao === 'Bonificacao' ? '0' : (item.quantidade * item.preco_custo).toFixed(2),
          atualizado_em: hoje(),
        });
      }
    }
  }

  mostrarToast('Compra salva! Abrindo Contas a Pagar...', 'success');
  fecharModal();

  // Abre modal de contas a pagar
  setTimeout(() => abrirCPParaCompra(compraId, fornSel.value ? (fornOpt.dataset.nome || '') : '', total), 500);

  await carregarDados([CONFIG.SHEETS.COMPRAS, CONFIG.SHEETS.COMPRA_ITENS, CONFIG.SHEETS.ESTOQUE]);
  renderCompMetricas();
  aplicarFiltrosComp();
}

function abrirCPParaCompra(compraId, fornNome, total) {
  const html = `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Lancar no Contas a Pagar — Total: <strong>${formatMoeda(total)}</strong></p>
    <div class="form-row cols-2">
      <div class="input-group"><label>Numero de parcelas</label><input type="number" id="cpc-parcelas" value="1" min="1" oninput="calcParcelasCPC(${total})" /></div>
      <div class="input-group"><label>Valor por parcela</label><input type="number" step="0.01" id="cpc-valor_parcela" value="${total.toFixed(2)}" readonly style="opacity:0.7" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Primeiro vencimento *</label><input type="date" id="cpc-vencimento" value="${hoje()}" /></div>
      <div class="input-group"><label>Forma de pagamento</label>
        <select id="cpc-forma">${['PIX','Dinheiro','Cheque','Boleto','Financiamento'].map(x=>`<option>${x}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Pular</button>
      <button class="btn btn-primary" onclick="salvarCPCompra('${compraId}','${fornNome}',${total})">Lancar no Contas a Pagar</button>
    </div>`;
  abrirModal('Lancar no Contas a Pagar', html, 'modal-sm');
}

function calcParcelasCPC(total) {
  const parcelas = parseInt(document.getElementById('cpc-parcelas')?.value) || 1;
  const vpEl = document.getElementById('cpc-valor_parcela');
  if (vpEl) vpEl.value = (total / parcelas).toFixed(2);
}

async function salvarCPCompra(compraId, fornNome, total) {
  const parcelas = parseInt(document.getElementById('cpc-parcelas').value) || 1;
  const valorParcela = total / parcelas;
  const primeiroVenc = document.getElementById('cpc-vencimento').value;
  const forma = document.getElementById('cpc-forma').value;
  if (!primeiroVenc) { mostrarToast('Informe o vencimento', 'error'); return; }
  for (let i = 0; i < parcelas; i++) {
    const dataVenc = new Date(primeiroVenc + 'T00:00:00');
    dataVenc.setMonth(dataVenc.getMonth() + i);
    const dataStr = dataVenc.toISOString().split('T')[0];
    await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, {
      id: gerarId(), fornecedor_nome: fornNome,
      descricao: 'Compra — ' + fornNome,
      categoria: 'Materiais', forma_pagamento: forma,
      valor_total: total.toFixed(2), valor_parcela: valorParcela.toFixed(2),
      parcela_num: String(i + 1), parcela_total: String(parcelas),
      data_emissao: hoje(), data_vencimento: dataStr,
      status: 'Pendente', criado_em: hoje(),
    });
  }
  mostrarToast('Lancado no Contas a Pagar', 'success');
  fecharModal();
}

async function verCompra(compraId) {
  const compra = (window.DB.compras || []).find(c => c.id === compraId);
  const itens = (window.DB.compra_itens || []).filter(i => i.compra_id === compraId);
  if (!compra) return;
  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px;">
      <div><span style="color:var(--text-3)">Data</span><br>${formatData(compra.data)}</div>
      <div><span style="color:var(--text-3)">Fornecedor</span><br>${compra.fornecedor_nome || '—'}</div>
      <div><span style="color:var(--text-3)">NF</span><br>${compra.numero_nf || '—'}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Item</th>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Segmento</th>
        <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Qtd</th>
        <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Preco</th>
        <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Total</th>
        <th style="padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Sit.</th>
      </tr></thead>
      <tbody>
        ${itens.map(i => `<tr>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border)">${i.descricao}</td>
          <td style="padding:8px;font-size:12px;border-bottom:1px solid var(--border);color:var(--text-2)">${i.segmento || '—'}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${i.quantidade} ${i.unidade}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${formatMoeda(i.preco_custo)}</td>
          <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border);font-weight:600">${formatMoeda(i.total)}</td>
          <td style="padding:8px;border-bottom:1px solid var(--border)">${i.situacao === 'Normal' ? '' : '<span class="badge badge-yellow">' + i.situacao + '</span>'}</td>
        </tr>`).join('')}
        <tr>
          <td colspan="4" style="padding:8px;font-family:'Syne',sans-serif;font-weight:700;text-align:right">Total</td>
          <td style="padding:8px;font-family:'Syne',sans-serif;font-weight:700;text-align:right;color:var(--accent)">${formatMoeda(compra.total)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Fechar</button></div>`;
  abrirModal('Compra — ' + (compra.fornecedor_nome || compra.numero), html, 'modal-lg');
}

function excluirCompra(id) {
  confirmar('Excluir esta compra? Os itens do estoque nao serao revertidos automaticamente.', async () => {
    await Sheets.excluir(CONFIG.SHEETS.COMPRAS, id);
    mostrarToast('Compra excluida', 'success');
    await carregarDados([CONFIG.SHEETS.COMPRAS, CONFIG.SHEETS.COMPRA_ITENS]);
    renderCompMetricas();
    aplicarFiltrosComp();
  });
}
