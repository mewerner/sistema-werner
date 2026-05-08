// CARTOES DE CREDITO
function renderCartoes() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Cartoes de Credito</h1><p class="page-subtitle">Controle de faturas e lancamentos</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="abrirFormCartao()">+ Novo Cartao</button>
        <button class="btn btn-primary" onclick="abrirFormLancamento()">+ Lancamento</button>
      </div>
    </div>
    <div id="cart-faturas" style="margin-bottom:20px;"></div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarCart('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarCart('Compra',this)">Compras</button>
      <button class="filter-btn" onclick="filtrarCart('Venda',this)">Vendas</button>
      <select id="cart-cartao" onchange="aplicarFiltrosCart()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        <option value="">Todos os cartoes</option>
      </select>
      <select id="cart-mes" onchange="aplicarFiltrosCart()" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:12px;">
        ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>`<option value="${i+1}" ${new Date().getMonth()===i?'selected':''}>${m}/${new Date().getFullYear()}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar lancamento..." oninput="buscarCart(this.value)" />
        <span id="cart-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="cart-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.CARTOES, CONFIG.SHEETS.CARTAO_LANCAMENTOS]);
    popularSelectCartoes();
    renderFaturas();
    aplicarFiltrosCart();
  });
}

function popularSelectCartoes() {
  const sel = document.getElementById('cart-cartao');
  if (!sel) return;
  (window.DB.cartoes || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome + (c.ultimos4 ? ' ****' + c.ultimos4 : '');
    sel.appendChild(opt);
  });
}

function renderFaturas() {
  const cartoes = window.DB.cartoes || [];
  const lancamentos = window.DB.cartao_lancamentos || [];
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  if (!cartoes.length) {
    document.getElementById('cart-faturas').innerHTML = `<div class="card"><p style="color:var(--text-3);font-size:13px;">Nenhum cartao cadastrado. Clique em "+ Novo Cartao" para comecar.</p></div>`;
    return;
  }
  document.getElementById('cart-faturas').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
      ${cartoes.map(c => {
        const lancesMes = lancamentos.filter(l => l.cartao_id === c.id && parseInt(l.mes_fatura) === mesAtual && parseInt(l.ano_fatura) === anoAtual && l.tipo === 'Compra');
        const totalFatura = somarCampo(lancesMes, 'valor_parcela');
        return `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;">${c.nome}</div>
              <div style="font-size:12px;color:var(--text-3)">${c.titular || ''} ${c.ultimos4 ? '****'+c.ultimos4 : ''}</div>
            </div>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="editarCartaoBtn(this)" data-c="${JSON.stringify(c).replace(/"/g,'&quot;')}">✏</button>
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Fatura ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mesAtual-1]}/${anoAtual}</div>
          <div style="font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:var(--accent)">${formatMoeda(totalFatura)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">Fecha dia ${c.dia_fechamento || '—'} · Vence dia ${c.dia_vencimento || '—'}</div>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="lancarFaturaCP('${c.id}','${c.nome}',${totalFatura},${mesAtual},${anoAtual})">Lancar no Contas a Pagar</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function lancarFaturaCP(cartaoId, nomeCartao, total, mes, ano) {
  if (total <= 0) { mostrarToast('Fatura zerada, nada a lancar', 'error'); return; }
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const cartao = (window.DB.cartoes || []).find(c => c.id === cartaoId);
  const diaVenc = cartao?.dia_vencimento || 10;
  const dataVenc = ano + '-' + String(mes === 12 ? 1 : mes + 1).padStart(2,'0') + '-' + String(diaVenc).padStart(2,'0');
  const obj = {
    id: gerarId(), descricao: 'Fatura ' + nomeCartao + ' ' + meses[mes-1] + '/' + ano,
    categoria: 'Cartao de credito', forma_pagamento: 'Cartao',
    valor_total: total.toFixed(2), valor_parcela: total.toFixed(2),
    parcela_num: '1', parcela_total: '1',
    data_emissao: hoje(), data_vencimento: dataVenc,
    status: 'Pendente', criado_em: hoje(),
  };
  await Sheets.adicionar(CONFIG.SHEETS.CONTAS_PAGAR, obj);
  mostrarToast('Fatura lancada no Contas a Pagar', 'success');
}

window._cartFiltro = 'todos';
window._cartBusca = '';

function filtrarCart(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._cartFiltro = tipo;
  aplicarFiltrosCart();
}

function buscarCart(q) { window._cartBusca = q.toLowerCase(); aplicarFiltrosCart(); }

function aplicarFiltrosCart() {
  let lista = window.DB.cartao_lancamentos || [];
  const cartaoId = document.getElementById('cart-cartao')?.value || '';
  const mes = parseInt(document.getElementById('cart-mes')?.value || new Date().getMonth() + 1);
  const ano = new Date().getFullYear();
  lista = lista.filter(l => parseInt(l.mes_fatura) === mes && parseInt(l.ano_fatura) === ano);
  if (cartaoId) lista = lista.filter(l => l.cartao_id === cartaoId);
  if (window._cartFiltro !== 'todos') lista = lista.filter(l => l.tipo === window._cartFiltro);
  if (window._cartBusca) lista = lista.filter(l => (l.descricao + l.estabelecimento + l.categoria).toLowerCase().includes(window._cartBusca));
  lista = lista.sort((a, b) => new Date(b.data) - new Date(a.data));
  renderTabelaCart(lista);
}

function renderTabelaCart(lista) {
  document.getElementById('cart-count').textContent = lista.length + ' lancamentos';
  if (!lista.length) { document.getElementById('cart-table').innerHTML = estadoVazio('Nenhum lancamento neste mes'); return; }
  const cartoes = window.DB.cartoes || [];
  document.getElementById('cart-table').innerHTML = `
    <table><thead><tr>
      <th>Data</th><th>Cartao</th><th>Descricao</th><th>Estabelecimento</th><th>Categoria</th><th>Parcela</th><th>Valor</th><th>Tipo</th><th></th>
    </tr></thead><tbody>
      ${lista.map(l => {
        const cart = cartoes.find(c => c.id === l.cartao_id);
        return `<tr>
          <td style="color:var(--text-3)">${formatData(l.data)}</td>
          <td style="font-size:12px">${cart ? cart.nome : '—'}</td>
          <td>${l.descricao || '—'}</td>
          <td style="font-size:12px;color:var(--text-2)">${l.estabelecimento || '—'}</td>
          <td><span class="badge badge-gray">${l.categoria || '—'}</span></td>
          <td style="font-size:12px;color:var(--text-3)">${l.parcelas > 1 ? l.parcela_atual+'/'+l.parcelas : '—'}</td>
          <td style="font-weight:600;color:${l.tipo==='Venda'?'var(--green)':'var(--accent)'}">${formatMoeda(l.valor_parcela)}</td>
          <td>${l.tipo==='Venda'?'<span class="badge badge-green">Venda</span>':'<span class="badge badge-accent">Compra</span>'}</td>
          <td><div class="td-actions">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="editarLancBtn(this)" data-l="${JSON.stringify(l).replace(/"/g,'&quot;')}">✏</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="excluirLanc('${l.id}')">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
}

function abrirFormCartao(c) {
  const edit = !!c;
  const v = (id) => c ? (c[id] || '') : '';
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Nome do cartao *</label><input id="cc-nome" value="${v('nome')}" placeholder="Ex: Nubank, Inter..." /></div>
      <div class="input-group"><label>Titular</label><input id="cc-titular" value="${v('titular')}" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Ultimos 4 digitos</label><input id="cc-ultimos4" value="${v('ultimos4')}" maxlength="4" /></div>
      <div class="input-group"><label>Dia fechamento</label><input type="number" id="cc-dia_fechamento" value="${v('dia_fechamento')}" min="1" max="31" /></div>
      <div class="input-group"><label>Dia vencimento</label><input type="number" id="cc-dia_vencimento" value="${v('dia_vencimento')}" min="1" max="31" /></div>
    </div>
    <div class="input-group"><label>Limite (R$)</label><input type="number" step="0.01" id="cc-limite" value="${v('limite')}" placeholder="Opcional" /></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCartao('${edit ? c.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Cartao' : 'Novo Cartao', html, 'modal-sm');
}

async function salvarCartao(id) {
  const obj = {
    nome: document.getElementById('cc-nome').value,
    titular: document.getElementById('cc-titular').value,
    ultimos4: document.getElementById('cc-ultimos4').value,
    dia_fechamento: document.getElementById('cc-dia_fechamento').value,
    dia_vencimento: document.getElementById('cc-dia_vencimento').value,
    limite: document.getElementById('cc-limite').value,
    ativo: 'true',
  };
  if (!obj.nome) { mostrarToast('Nome obrigatorio', 'error'); return; }
  if (id) { obj.id = id; await Sheets.atualizar(CONFIG.SHEETS.CARTOES, id, obj); }
  else { obj.id = gerarId(); await Sheets.adicionar(CONFIG.SHEETS.CARTOES, obj); }
  mostrarToast('Cartao salvo', 'success');
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CARTOES]);
  renderFaturas();
}

function abrirFormLancamento(l) {
  const edit = !!l;
  const cartoes = window.DB.cartoes || [];
  const v = (id) => l ? (l[id] || '') : '';
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const cats = ['Materiais','Combustivel','Alimentacao','Servicos','Outros'];
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Tipo *</label>
        <select id="lc-tipo" onchange="toggleTaxaLanc()">
          <option ${v('tipo')==='Compra'||!v('tipo')?'selected':''}>Compra</option>
          <option ${v('tipo')==='Venda'?'selected':''}>Venda</option>
        </select>
      </div>
      <div class="input-group"><label>Cartao *</label>
        <select id="lc-cartao_id">
          <option value="">Selecione...</option>
          ${cartoes.map(c => `<option value="${c.id}" ${v('cartao_id')===c.id?'selected':''}>${c.nome}${c.ultimos4?' ****'+c.ultimos4:''}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Data *</label><input type="date" id="lc-data" value="${v('data') || hoje()}" /></div>
      <div class="input-group"><label>Categoria</label>
        <select id="lc-categoria">${cats.map(x => `<option ${v('categoria')===x?'selected':''}>${x}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Descricao *</label><input id="lc-descricao" value="${v('descricao')}" /></div>
      <div class="input-group"><label>Estabelecimento</label><input id="lc-estabelecimento" value="${v('estabelecimento')}" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Valor total (R$) *</label><input type="number" step="0.01" id="lc-valor_total" value="${v('valor_total')}" oninput="calcParcelaLanc()" /></div>
      <div class="input-group"><label>Parcelas</label><input type="number" id="lc-parcelas" value="${v('parcelas') || '1'}" min="1" oninput="calcParcelaLanc()" /></div>
      <div class="input-group"><label>Parcela atual</label><input type="number" id="lc-parcela_atual" value="${v('parcela_atual') || '1'}" min="1" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Valor da parcela (R$)</label><input type="number" step="0.01" id="lc-valor_parcela" value="${v('valor_parcela')}" /></div>
      <div id="lc-taxa-wrap" class="input-group" style="${v('tipo')==='Venda'?'':'display:none'}"><label>Taxa operadora (%)</label><input type="number" step="0.01" id="lc-taxa_operadora" value="${v('taxa_operadora') || '2'}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Mes da fatura</label>
        <select id="lc-mes_fatura">${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>`<option value="${i+1}" ${(v('mes_fatura')||mesAtual)==i+1?'selected':''}>${m}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Ano</label><input type="number" id="lc-ano_fatura" value="${v('ano_fatura') || anoAtual}" /></div>
    </div>
    <div class="input-group"><label>Observacoes</label><textarea id="lc-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarLancamento('${edit ? l.id : ''}')">${edit ? 'Salvar' : 'Lancar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Lancamento' : 'Novo Lancamento', html, 'modal-lg');
}

function toggleTaxaLanc() {
  const tipo = document.getElementById('lc-tipo')?.value;
  const wrap = document.getElementById('lc-taxa-wrap');
  if (wrap) wrap.style.display = tipo === 'Venda' ? '' : 'none';
}

function calcParcelaLanc() {
  const total = parseFloat(document.getElementById('lc-valor_total')?.value) || 0;
  const parcelas = parseInt(document.getElementById('lc-parcelas')?.value) || 1;
  if (total && parcelas) document.getElementById('lc-valor_parcela').value = (total / parcelas).toFixed(2);
}

async function salvarLancamento(id) {
  const obj = {
    tipo: document.getElementById('lc-tipo').value,
    cartao_id: document.getElementById('lc-cartao_id').value,
    data: document.getElementById('lc-data').value,
    categoria: document.getElementById('lc-categoria').value,
    descricao: document.getElementById('lc-descricao').value,
    estabelecimento: document.getElementById('lc-estabelecimento').value,
    valor_total: document.getElementById('lc-valor_total').value,
    parcelas: document.getElementById('lc-parcelas').value,
    parcela_atual: document.getElementById('lc-parcela_atual').value,
    valor_parcela: document.getElementById('lc-valor_parcela').value,
    taxa_operadora: document.getElementById('lc-taxa_operadora')?.value || '',
    mes_fatura: document.getElementById('lc-mes_fatura').value,
    ano_fatura: document.getElementById('lc-ano_fatura').value,
    observacoes: document.getElementById('lc-observacoes').value,
  };
  if (!obj.cartao_id || !obj.descricao || !obj.valor_parcela) { mostrarToast('Preencha os campos obrigatorios', 'error'); return; }
  mostrarToast('Salvando...', '');

  if (id) {
    obj.id = id;
    await Sheets.atualizar(CONFIG.SHEETS.CARTAO_LANCAMENTOS, id, obj);
    mostrarToast('Lancamento atualizado', 'success');
  } else {
    // Se parcelado, cria um lancamento por parcela
    const totalParcelas = parseInt(obj.parcelas) || 1;
    const valorParcela = parseFloat(obj.valor_parcela) || 0;
    for (let i = 1; i <= totalParcelas; i++) {
      let mes = parseInt(obj.mes_fatura) + (i - 1);
      let ano = parseInt(obj.ano_fatura);
      while (mes > 12) { mes -= 12; ano++; }
      await Sheets.adicionar(CONFIG.SHEETS.CARTAO_LANCAMENTOS, {
        ...obj, id: gerarId(), parcela_atual: String(i),
        mes_fatura: String(mes), ano_fatura: String(ano),
      });
    }
    mostrarToast('Lancamento registrado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CARTAO_LANCAMENTOS]);
  renderFaturas();
  aplicarFiltrosCart();
}

function editarCartaoBtn(btn) { abrirFormCartao(JSON.parse(btn.dataset.c.replace(/&quot;/g,'"'))); }
function editarLancBtn(btn) { abrirFormLancamento(JSON.parse(btn.dataset.l.replace(/&quot;/g,'"'))); }

function excluirLanc(id) {
  confirmar('Excluir este lancamento?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.CARTAO_LANCAMENTOS, id);
    mostrarToast('Excluido', 'success');
    await carregarDados([CONFIG.SHEETS.CARTAO_LANCAMENTOS]);
    renderFaturas();
    aplicarFiltrosCart();
  });
}
