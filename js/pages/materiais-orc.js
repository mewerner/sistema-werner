// MATERIAIS — cadastro de materiais para orçamentos

function renderMateriaisOrc() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-secondary btn-sm" onclick="navegarPara('orcamentos')">← Voltar</button>
        <div><h1 class="page-title">Materiais</h1><p class="page-subtitle">Cadastro de materiais para orcamentos</p></div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="abrirFormMaterial()">+ Novo Material</button>
      </div>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <input class="table-search" placeholder="Buscar material..." oninput="buscarMaterial(this.value)" />
        <span id="mat-count" style="font-size:12px;color:var(--text-3)"></span>
      </div>
      <div id="mat-table"></div>
    </div>`;
  solicitarAutorizacao(async () => {
    await carregarDados([CONFIG.SHEETS.MATERIAIS]);
    window._matCache = null;
    renderTabelaMateriais(window.DB.materiais || []);
  });
}

function buscarMaterial(q) {
  const lista = (window.DB.materiais || []).filter(m =>
    (m.nome + m.unidade).toLowerCase().includes(q.toLowerCase()));
  renderTabelaMateriais(lista);
}

function renderTabelaMateriais(lista) {
  lista = lista.sort((a, b) => a.nome?.localeCompare(b.nome));
  document.getElementById('mat-count').textContent = lista.length + ' materiais';
  if (!lista.length) {
    document.getElementById('mat-table').innerHTML = estadoVazio('Nenhum material cadastrado');
    return;
  }
  document.getElementById('mat-table').innerHTML = `
    <table><thead><tr>
      <th>Nome</th><th>Unidade</th><th>Preco de referencia (R$)</th><th></th>
    </tr></thead><tbody>
      ${lista.map(m => `<tr>
        <td><strong>${m.nome}</strong></td>
        <td><span style="background:var(--bg-3);padding:2px 8px;border-radius:999px;font-size:12px;">${m.unidade || 'un'}</span></td>
        <td style="color:var(--accent);font-weight:600;">${formatMoeda(m.preco_ref || 0)}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarMaterial('${m.id}')">✏</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="excluirMaterial('${m.id}')">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
}

function abrirFormMaterial(m) {
  const edit = !!m;
  const v = (id) => m ? (m[id] || '') : '';
  const html = `
    <div class="input-group"><label>Nome *</label>
      <input id="mat-nome" value="${v('nome')}" placeholder="Ex: Corredicca oculta" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
      <div class="input-group"><label>Unidade</label>
        <select id="mat-unidade">
          ${['un','pç','m²','m³','ml','kg','cx','vb'].map(u =>
            `<option value="${u}" ${v('unidade')===u?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Preco de referencia (R$)</label>
        <input type="number" step="0.01" id="mat-preco_ref" value="${v('preco_ref') || '0'}" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarMaterial('${edit ? m.id : ''}')">${edit ? 'Salvar' : 'Cadastrar'}</button>
    </div>`;
  abrirModal(edit ? 'Editar Material' : 'Novo Material', html);
}

function editarMaterial(id) {
  const m = (window.DB.materiais || []).find(x => x.id === id);
  if (m) abrirFormMaterial(m);
}

async function salvarMaterial(id) {
  const nome = document.getElementById('mat-nome')?.value?.trim();
  if (!nome) { mostrarToast('Informe o nome do material', 'error'); return; }
  const obj = {
    nome,
    unidade:   document.getElementById('mat-unidade')?.value || 'un',
    preco_ref: document.getElementById('mat-preco_ref')?.value || '0',
  };
  mostrarToast('Salvando...', '');
  if (id) {
    obj.id = id;
    await Sheets.atualizar(CONFIG.SHEETS.MATERIAIS, id, obj);
    mostrarToast('Material atualizado', 'success');
  } else {
    obj.id = gerarId();
    await Sheets.adicionar(CONFIG.SHEETS.MATERIAIS, obj);
    mostrarToast('Material cadastrado', 'success');
  }
  fecharModal();
  window._matCache = null;
  await carregarDados([CONFIG.SHEETS.MATERIAIS]);
  renderTabelaMateriais(window.DB.materiais || []);
}

async function excluirMaterial(id) {
  confirmar('Excluir este material?', async () => {
    await Sheets.excluir(CONFIG.SHEETS.MATERIAIS, id);
    mostrarToast('Material excluido', 'success');
    window._matCache = null;
    await carregarDados([CONFIG.SHEETS.MATERIAIS]);
    renderTabelaMateriais(window.DB.materiais || []);
  });
}
