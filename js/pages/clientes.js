// =============================================
// CLIENTES
// =============================================

function renderClientes() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Clientes</h1><p class="page-subtitle">Cadastro de clientes e arquitetos</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormCliente()">+ Novo Cliente</button>
      </div>
    </div>
    <div class="filter-bar">
      <button class="filter-btn active" onclick="filtrarClientes('todos',this)">Todos</button>
      <button class="filter-btn" onclick="filtrarClientes('PF',this)">Pessoa Física</button>
      <button class="filter-btn" onclick="filtrarClientes('PJ',this)">Pessoa Jurídica</button>
      <button class="filter-btn" onclick="filtrarClientes('Arquiteto',this)">Arquitetos</button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar cliente..." oninput="buscarClientes(this.value)" />
        <span id="clientes-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="clientes-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.CLIENTES]);
    renderTabelaClientes(window.DB.clientes || []);
  });
}

function renderTabelaClientes(lista) {
  document.getElementById('clientes-count').textContent = `${lista.length} registros`;
  if (!lista.length) { document.getElementById('clientes-table').innerHTML = estadoVazio('Nenhum cliente cadastrado'); return; }
  document.getElementById('clientes-table').innerHTML = `
    <table><thead><tr>
      <th>Nº</th><th>Nome/Razão Social</th><th>Tipo</th><th>Telefone</th><th>Cidade</th><th>Origem</th><th></th>
    </tr></thead><tbody>
      ${lista.map(c=>`<tr>
        <td style="color:var(--text-3)">${c.numero}</td>
        <td><strong>${c.nome}</strong>${c.contato?`<br><span style="font-size:11px;color:var(--text-3)">${c.contato}</span>`:''}</td>
        <td>${badgeStatus(c.tipo==='PF'?'Aprovado':c.tipo==='PJ'?'Em andamento':'Enviado').replace(/Aprovado|Em andamento|Enviado/,c.tipo)}</td>
        <td>${formatTel(c.telefone)}</td>
        <td>${c.cidade||'—'}</td>
        <td style="font-size:12px;color:var(--text-2)">${c.origem||'—'}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick='verCliente(${JSON.stringify(c)})'>👁</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick='editarCliente(${JSON.stringify(c)})'>✏</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

window._clientesFiltro = 'todos';
window._clientesBusca = '';

function filtrarClientes(tipo, btn) {
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  window._clientesFiltro = tipo;
  aplicarFiltrosClientes();
}

function buscarClientes(q) {
  window._clientesBusca = q.toLowerCase();
  aplicarFiltrosClientes();
}

function aplicarFiltrosClientes() {
  let lista = window.DB.clientes || [];
  if (window._clientesFiltro !== 'todos') lista = lista.filter(c=>c.tipo===window._clientesFiltro);
  if (window._clientesBusca) lista = lista.filter(c=>(c.nome+c.cpf_cnpj+c.cidade+c.telefone).toLowerCase().includes(window._clientesBusca));
  renderTabelaClientes(lista);
}

function abrirFormCliente(cliente = null) {
  const edit = !!cliente;
  const html = `
    <div class="form-row cols-2">
      <div class="input-group"><label>Tipo *</label>
        <select id="c-tipo" onchange="toggleCamposCliente()">
          <option ${cliente?.tipo==='PF'?'selected':''}>PF</option>
          <option ${cliente?.tipo==='PJ'?'selected':''}>PJ</option>
          <option ${cliente?.tipo==='Arquiteto'?'selected':''}>Arquiteto</option>
        </select>
      </div>
      <div class="input-group"><label>Nome / Razão Social *</label><input id="c-nome" value="${cliente?.nome||''}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>CPF / CNPJ</label><input id="c-cpf_cnpj" value="${cliente?.cpf_cnpj||''}" /></div>
      <div id="c-ie-wrap" class="input-group"><label>Inscrição Estadual</label><input id="c-ie" value="${cliente?.ie||''}" /></div>
    </div>
    <div id="c-contato-wrap" class="form-row cols-2">
      <div class="input-group"><label>Nome do Contato</label><input id="c-contato" value="${cliente?.contato||''}" /></div>
      <div class="input-group"><label>Escritório</label><input id="c-escritorio" value="${cliente?.escritorio||''}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>Telefone</label><input id="c-telefone" value="${cliente?.telefone||''}" /></div>
      <div class="input-group"><label>E-mail</label><input id="c-email" value="${cliente?.email||''}" /></div>
    </div>
    <div id="c-emailnf-wrap" class="input-group"><label>E-mail para NF</label><input id="c-email_nf" value="${cliente?.email_nf||''}" /></div>
    <hr class="divider" />
    <div class="form-row cols-3">
      <div class="input-group" style="grid-column:span 2"><label>Logradouro</label><input id="c-logradouro" value="${cliente?.logradouro||''}" /></div>
      <div class="input-group"><label>Número</label><input id="c-numero_end" value="${cliente?.numero_end||''}" /></div>
    </div>
    <div class="form-row cols-3">
      <div class="input-group"><label>Bairro</label><input id="c-bairro" value="${cliente?.bairro||''}" /></div>
      <div class="input-group"><label>Cidade</label><input id="c-cidade" value="${cliente?.cidade||''}" /></div>
      <div class="input-group"><label>Estado</label><input id="c-estado" value="${cliente?.estado||'SC'}" /></div>
    </div>
    <div class="form-row cols-2">
      <div class="input-group"><label>CEP</label><input id="c-cep" value="${cliente?.cep||''}" /></div>
      <div class="input-group"><label>Complemento</label><input id="c-complemento" value="${cliente?.complemento||''}" /></div>
    </div>
    <hr class="divider" />
    <div class="form-row cols-2">
      <div class="input-group"><label>Origem</label>
        <select id="c-origem">
          <option ${!cliente?.origem||cliente?.origem==='Nenhuma'?'selected':''}>Nenhuma</option>
          <option ${cliente?.origem==='Indicado por arquiteto'?'selected':''}>Indicado por arquiteto</option>
          <option ${cliente?.origem==='Indicado por cliente'?'selected':''}>Indicado por cliente</option>
          <option ${cliente?.origem==='Redes sociais'?'selected':''}>Redes sociais</option>
          <option ${cliente?.origem==='Outro'?'selected':''}>Outro</option>
        </select>
      </div>
      <div class="input-group"><label>Indicado por</label><input id="c-indicado_por_nome" value="${cliente?.indicado_por_nome||''}" placeholder="Nome do indicador" /></div>
    </div>
    <div class="input-group"><label>Observações</label><textarea id="c-observacoes" rows="3">${cliente?.observacoes||''}</textarea></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarCliente(${edit?`'${cliente.id}'`:'null'})">
        ${edit?'Salvar alterações':'Cadastrar cliente'}
      </button>
    </div>`;
  abrirModal(edit?`Editar — ${cliente.nome}`:'Novo Cliente', html, 'modal-lg');
  toggleCamposCliente();
}

function toggleCamposCliente() {
  const tipo = document.getElementById('c-tipo')?.value;
  const isPJ = tipo === 'PJ';
  const isArq = tipo === 'Arquiteto';
  const ieWrap = document.getElementById('c-ie-wrap');
  const emailNfWrap = document.getElementById('c-emailnf-wrap');
  const contatoWrap = document.getElementById('c-contato-wrap');
  if (ieWrap) ieWrap.style.display = isPJ ? '' : 'none';
  if (emailNfWrap) emailNfWrap.style.display = isPJ ? '' : 'none';
  if (contatoWrap) contatoWrap.style.display = (isPJ||isArq) ? '' : 'none';
}

async function salvarCliente(id) {
  const obj = {
    tipo: document.getElementById('c-tipo').value,
    nome: document.getElementById('c-nome').value,
    cpf_cnpj: document.getElementById('c-cpf_cnpj').value,
    ie: document.getElementById('c-ie')?.value||'',
    contato: document.getElementById('c-contato')?.value||'',
    telefone: document.getElementById('c-telefone').value,
    email: document.getElementById('c-email').value,
    email_nf: document.getElementById('c-email_nf')?.value||'',
    logradouro: document.getElementById('c-logradouro').value,
    numero_end: document.getElementById('c-numero_end').value,
    complemento: document.getElementById('c-complemento').value,
    bairro: document.getElementById('c-bairro').value,
    cidade: document.getElementById('c-cidade').value,
    estado: document.getElementById('c-estado').value,
    cep: document.getElementById('c-cep').value,
    origem: document.getElementById('c-origem').value,
    indicado_por_nome: document.getElementById('c-indicado_por_nome').value,
    observacoes: document.getElementById('c-observacoes').value,
  };
  if (!obj.nome) { mostrarToast('Nome obrigatório', 'error'); return; }
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    await Sheets.atualizar(CONFIG.SHEETS.CLIENTES, id, obj);
    mostrarToast('Cliente atualizado ✓', 'success');
  } else {
    obj.id = gerarId();
    obj.numero = gerarNumero('CLI', window.DB.clientes||[]);
    obj.criado_em = hoje();
    await Sheets.adicionar(CONFIG.SHEETS.CLIENTES, obj);
    // Cria pasta no Drive
    try { await Drive.criarPastaCliente(obj.numero, obj.nome, obj.cidade||''); } catch(e) {}
    mostrarToast('Cliente cadastrado ✓', 'success');
  }
  fecharModal();
  await carregarDados([CONFIG.SHEETS.CLIENTES]);
  aplicarFiltrosClientes();
}

function verCliente(c) {
  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
      <div><span style="color:var(--text-3)">Tipo</span><br><strong>${c.tipo}</strong></div>
      <div><span style="color:var(--text-3)">Nº</span><br><strong>${c.numero}</strong></div>
      <div><span style="color:var(--text-3)">CPF/CNPJ</span><br>${c.cpf_cnpj||'—'}</div>
      <div><span style="color:var(--text-3)">Telefone</span><br>${formatTel(c.telefone)}</div>
      <div><span style="color:var(--text-3)">E-mail</span><br>${c.email||'—'}</div>
      <div><span style="color:var(--text-3)">Cidade</span><br>${c.cidade||'—'} — ${c.estado||''}</div>
      <div style="grid-column:span 2"><span style="color:var(--text-3)">Endereço</span><br>${[c.logradouro,c.numero_end,c.bairro,c.cep].filter(Boolean).join(', ')||'—'}</div>
      <div><span style="color:var(--text-3)">Origem</span><br>${c.origem||'—'}</div>
      <div><span style="color:var(--text-3)">Indicado por</span><br>${c.indicado_por_nome||'—'}</div>
      ${c.observacoes?`<div style="grid-column:span 2"><span style="color:var(--text-3)">Observações</span><br>${c.observacoes}</div>`:''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn btn-primary" onclick="fecharModal();editarCliente(${JSON.stringify(c).replace(/"/g,'&quot;')})">Editar</button>
    </div>`;
  abrirModal(c.nome, html);
}

function editarCliente(c) { abrirFormCliente(c); }
