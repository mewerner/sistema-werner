// FORNECEDORES
function renderFornecedores() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Fornecedores</h1><p class="page-subtitle">Cadastro de fornecedores</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="abrirFormFornecedor()">+ Novo Fornecedor</button></div>
    </div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarFornecedores('todos',this)">Todos</button>
      ${['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Segurança','Vidros e Espelhos','Acabamentos','Fixação e Montagem','Outros'].map(s=>
        `<button class="filter-btn" onclick="filtrarFornecedores('${s}',this)">${s}</button>`).join('')}
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar fornecedor..." oninput="buscarFornecedor(this.value)" />
        <span id="forn-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="forn-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.FORNECEDORES]);
    renderTabelaFornecedores(window.DB.fornecedores || []);
  });
}

window._fornFiltro = 'todos';
window._fornBusca = '';

function filtrarFornecedores(seg, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._fornFiltro = seg;
  aplicarFiltrosFornecedor();
}

function buscarFornecedor(q) { window._fornBusca = q.toLowerCase(); aplicarFiltrosFornecedor(); }

function aplicarFiltrosFornecedor() {
  let lista = window.DB.fornecedores || [];
  if (window._fornFiltro !== 'todos') lista = lista.filter(f => (f.segmentos||'').includes(window._fornFiltro));
  if (window._fornBusca) lista = lista.filter(f => (f.razao_social+f.cnpj+f.cidade+f.contato).toLowerCase().includes(window._fornBusca));
  renderTabelaFornecedores(lista);
}

function renderTabelaFornecedores(lista) {
  document.getElementById('forn-count').textContent = lista.length + ' registros';
  if (!lista.length) { document.getElementById('forn-table').innerHTML = estadoVazio('Nenhum fornecedor cadastrado'); return; }
  document.getElementById('forn-table').innerHTML = `
    <table><thead><tr>
      <th>No</th><th>Razao Social</th><th>CNPJ</th><th>Contato</th><th>Telefone</th><th>Cidade</th><th>Segmentos</th><th>Prazo</th><th></th>
    </tr></thead><tbody>
      ${lista.map(f => `<tr>
        <td style="color:var(--text-3)">${f.numero||'—'}</td>
        <td><strong>${f.razao_social}</strong></td>
        <td style="font-size:12px;color:var(--text-2)">${f.cnpj||'—'}</td>
        <td style="font-size:12px">${f.contato||'—'}</td>
        <td>${formatTel(f.telefone)}</td>
        <td>${f.cidade||'—'}${f.estado?'/'+f.estado:''}</td>
        <td style="font-size:11px;color:var(--text-2)">${f.segmentos||'—'}</td>
        <td style="font-size:12px">${f.prazo_entrega?f.prazo_entrega+' dias':'—'}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="verFornecedor(this)" data-f='${JSON.stringify(f).replace(/'/g,"&#39;")}'>👁</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarFornecedorBtn(this)" data-f='${JSON.stringify(f).replace(/'/g,"&#39;")}'>✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirFornecedor('${f.id}','${f.razao_social}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

const SEGMENTOS_FORN = ['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Segurança','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'];

async function abrirFormFornecedor(f) {
  // Garante que as configuracoes estao carregadas
  if (!window._sysConfig) await carregarConfiguracoes();
  const edit = !!f;
  const segsAtivos = (f && f.segmentos ? f.segmentos : '').split(',').map(s => s.trim());
  const v = (id) => f ? (f[id]||'') : '';
  const html = `
    <div class="input-group"><label>Razao Social *</label><input id="ff-razao_social" value="${v('razao_social')}" /></div>
    <div class="form-row cols-2" style="margin-top:16px;">
      <div class="input-group"><label>CNPJ</label><input id="ff-cnpj" value="${v('cnpj')}" oninput="mascaraCNPJ(this)" /></div>
      <div class="input-group"><label>Prazo entrega (dias)</label><input type="number" id="ff-prazo_entrega" value="${v('prazo_entrega')}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Contato</label><input id="ff-contato" value="${v('contato')}" /></div>
      <div class="input-group"><label>Telefone</label><input id="ff-telefone" value="${v('telefone')}" oninput="mascaraTelefone(this)" /></div>
    </div>
    <div class="input-group"><label>E-mail</label><input id="ff-email" value="${v('email')}" /></div>
    <hr class="divider"/>
    <div class="form-row cols-3">
      <div class="input-group" style="grid-column:span 2"><label>Logradouro</label><input id="ff-logradouro" value="${v('logradouro')}" /></div>
      <div class="input-group"><label>Numero</label><input id="ff-numero_end" value="${v('numero_end')}" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Bairro</label><input id="ff-bairro" value="${v('bairro')}" /></div>
      <div class="input-group"><label>Cidade</label><input id="ff-cidade" value="${v('cidade')}" /></div>
      <div class="input-group"><label>Estado</label><input id="ff-estado" value="${v('estado')||'SC'}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>CEP</label><input id="ff-cep" value="${v('cep')}" oninput="mascaraCEP(this)" /></div>
      <div class="input-group"><label>Complemento</label><input id="ff-complemento" value="${v('complemento')}" /></div>
    </div>
    <hr class="divider"/>
    <div class="input-group">
      <label>Segmentos</label>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
        ${getSysConfig('segmentos').map(s => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;"><input type="checkbox" class="forn-seg" value="${s}" ${segsAtivos.includes(s)?'checked':''} style="width:auto;"/>${s}</label>`).join('')}
      </div>
    </div>
    <div class="input-group" style="margin-top:16px;"><label>Observacoes</label><textarea id="ff-observacoes" rows="2">${v('observacoes')}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarFornecedor('${edit?f.id:''}')">${edit?'Salvar':'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Fornecedor' : 'Novo Fornecedor', html, 'modal-lg');
}

async function salvarFornecedor(id) {
  const segs = [...document.querySelectorAll('.forn-seg:checked')].map(c => c.value).join(', ');
  const obj = {
    razao_social: document.getElementById('ff-razao_social').value,
    cnpj: document.getElementById('ff-cnpj').value,
    prazo_entrega: document.getElementById('ff-prazo_entrega').value,
    contato: document.getElementById('ff-contato').value,
    telefone: document.getElementById('ff-telefone').value,
    email: document.getElementById('ff-email').value,
    logradouro: document.getElementById('ff-logradouro').value,
    numero_end: document.getElementById('ff-numero_end').value,
    complemento: document.getElementById('ff-complemento').value,
    bairro: document.getElementById('ff-bairro').value,
    cidade: document.getElementById('ff-cidade').value,
    estado: document.getElementById('ff-estado').value,
    cep: document.getElementById('ff-cep').value,
    segmentos: segs,
    observacoes: document.getElementById('ff-observacoes').value,
  };
  if (!obj.razao_social) { mostrarToast('Razao social obrigatoria', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    await Sheets.atualizar(CONFIG.SHEETS.FORNECEDORES, id, obj);
    mostrarToast('Fornecedor atualizado', 'success');
  } else {
    obj.id = gerarId();
    obj.numero = gerarNumero('FOR', window.DB.fornecedores || []);
    obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.FORNECEDORES, obj);
    try { await Drive.criarPastaFornecedor(obj.numero, obj.razao_social); } catch(e) {}
    mostrarToast('Fornecedor cadastrado', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.FORNECEDORES]);
  aplicarFiltrosFornecedor();
}

function verFornecedor(btn) {
  const f = JSON.parse(btn.dataset.f);
  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
      <div><span style="color:var(--text-3)">No</span><br><strong>${f.numero||'—'}</strong></div>
      <div><span style="color:var(--text-3)">CNPJ</span><br>${f.cnpj||'—'}</div>
      <div><span style="color:var(--text-3)">Contato</span><br>${f.contato||'—'}</div>
      <div><span style="color:var(--text-3)">Telefone</span><br>${formatTel(f.telefone)}</div>
      <div><span style="color:var(--text-3)">E-mail</span><br>${f.email||'—'}</div>
      <div><span style="color:var(--text-3)">Prazo entrega</span><br>${f.prazo_entrega?f.prazo_entrega+' dias':'—'}</div>
      <div style="grid-column:span 2"><span style="color:var(--text-3)">Endereco</span><br>${[f.logradouro,f.numero_end,f.bairro,f.cidade,f.estado,f.cep].filter(Boolean).join(', ')||'—'}</div>
      <div style="grid-column:span 2"><span style="color:var(--text-3)">Segmentos</span><br>${f.segmentos||'—'}</div>
      ${f.observacoes?`<div style="grid-column:span 2"><span style="color:var(--text-3)">Obs</span><br>${f.observacoes}</div>`:''}
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Fechar</button></div>`;
  abrirModal(f.razao_social, html);
}

function editarFornecedorBtn(btn) { abrirFormFornecedor(JSON.parse(btn.dataset.f)); }

function excluirFornecedor(id, nome) {
  confirmar('Excluir o fornecedor ' + nome + '?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.FORNECEDORES, id);
    mostrarToast('Fornecedor excluido', 'success');
    await carregarDados([CONFIG.SHEETS.FORNECEDORES]);
    aplicarFiltrosFornecedor();
  });
}
