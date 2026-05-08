// CONFIGURACOES
function renderConfiguracoes() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Configuracoes</h1><p class="page-subtitle">Configuracoes gerais do sistema</p></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Dados da empresa</div>
          <div class="input-group"><label>Nome da empresa</label><input id="cfg-empresa" value="Moveis e Esquadrias Werner" /></div>
          <div class="input-group" style="margin-top:12px;"><label>CNPJ</label><input id="cfg-cnpj" placeholder="00.000.000/0000-00" /></div>
          <div class="input-group" style="margin-top:12px;"><label>Telefone</label><input id="cfg-telefone" /></div>
          <div class="input-group" style="margin-top:12px;"><label>E-mail</label><input id="cfg-email" /></div>
          <div class="input-group" style="margin-top:12px;"><label>Cidade / Estado</label><input id="cfg-cidade" /></div>
          <button class="btn btn-primary btn-sm" onclick="salvarConfigEmpresa()" style="margin-top:16px;">Salvar dados</button>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Fiscal</div>
          <div class="input-group"><label>Regime tributario</label>
            <select id="cfg-regime">
              <option>Simples Nacional</option>
              <option>Lucro Presumido</option>
              <option>MEI</option>
            </select>
          </div>
          <div class="input-group" style="margin-top:12px;"><label>Aliquota efetiva do Simples (%)</label>
            <input type="number" step="0.01" id="cfg-aliquota" value="6" placeholder="Confirmar com contador" />
          </div>
          <div style="font-size:12px;color:var(--text-3);margin-top:8px;">Confirme a aliquota com seu contador antes de usar.</div>
          <button class="btn btn-primary btn-sm" onclick="salvarConfigFiscal()" style="margin-top:16px;">Salvar</button>
        </div>
        <div class="card">
          <div class="card-title">Senha de acesso</div>
          <div class="input-group"><label>Nova senha</label><input type="password" id="cfg-senha-nova" placeholder="Digite a nova senha" /></div>
          <div class="input-group" style="margin-top:12px;"><label>Confirmar nova senha</label><input type="password" id="cfg-senha-conf" placeholder="Confirme a nova senha" /></div>
          <div style="font-size:12px;color:var(--yellow);margin-top:8px;">A nova senha so vale apos atualizar o arquivo config.js no GitHub.</div>
          <button class="btn btn-primary btn-sm" onclick="gerarNovaSenha()" style="margin-top:16px;">Gerar instrucoes</button>
        </div>
      </div>
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Informacoes do sistema</div>
          <table style="width:100%;font-size:13px;">
            <tr><td style="padding:8px 0;color:var(--text-2)">Versao</td><td style="text-align:right">1.0</td></tr>
            <tr><td style="padding:8px 0;color:var(--text-2);border-top:1px solid var(--border)">GitHub</td><td style="text-align:right"><a href="https://github.com/mewerner/sistema-werner" target="_blank" style="color:var(--accent)">mewerner/sistema-werner</a></td></tr>
            <tr><td style="padding:8px 0;color:var(--text-2);border-top:1px solid var(--border)">Planilha</td><td style="text-align:right"><a href="https://docs.google.com/spreadsheets/d/13QfEoGi7G9nSRyFWgTaNKjQOj3lHXpSftcTxst_qe0Q" target="_blank" style="color:var(--accent)">Abrir Sheets</a></td></tr>
            <tr><td style="padding:8px 0;color:var(--text-2);border-top:1px solid var(--border)">Drive</td><td style="text-align:right"><a href="https://drive.google.com/drive/folders/1pNbepYdSDG8vmspO63lxL3hIqMgLIWBX" target="_blank" style="color:var(--accent)">Abrir Drive</a></td></tr>
          </table>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Categorias do fluxo de caixa</div>
          <div id="cfg-cats-lista" style="margin-bottom:12px;"></div>
          <div style="display:flex;gap:8px;">
            <input id="cfg-nova-cat" placeholder="Nova categoria..." style="flex:1;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
            <button class="btn btn-primary btn-sm" onclick="adicionarCategoria()">Adicionar</button>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Segmentos de estoque / fornecedores</div>
          <div id="cfg-segs-lista" style="margin-bottom:12px;"></div>
          <div style="display:flex;gap:8px;">
            <input id="cfg-novo-seg" placeholder="Novo segmento..." style="flex:1;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
            <button class="btn btn-primary btn-sm" onclick="adicionarSegmento()">Adicionar</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Exportar dados</div>
          <p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">Os dados ficam no Google Sheets e podem ser exportados diretamente de la.</p>
          <a href="https://docs.google.com/spreadsheets/d/13QfEoGi7G9nSRyFWgTaNKjQOj3lHXpSftcTxst_qe0Q" target="_blank" class="btn btn-secondary">Abrir planilha para exportar</a>
        </div>
      </div>
    </div>`;

  window._cats = ['Materiais','Custos fixos','Projeto','Combustivel','Cartao de credito','Fornecedores','Pessoal','Impostos','Cheque','Outros'];
  window._segs = ['MDF / Chapas','Madeiras','Ferragens Gerais','Ferragens Funcionais','Fechaduras e Seguranca','Vidros e Espelhos','Acabamentos','Fixacao e Montagem','Outros'];
  renderCats();
  renderSegs();
}

function renderCats() {
  const el = document.getElementById('cfg-cats-lista');
  if (!el) return;
  el.innerHTML = window._cats.map((c, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span>${c}</span>
      <button onclick="removerCat(${i})" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;">✕</button>
    </div>`).join('');
}

function renderSegs() {
  const el = document.getElementById('cfg-segs-lista');
  if (!el) return;
  el.innerHTML = window._segs.map((s, i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span>${s}</span>
      <button onclick="removerSeg(${i})" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:16px;">✕</button>
    </div>`).join('');
}

function adicionarCategoria() {
  const val = document.getElementById('cfg-nova-cat')?.value?.trim();
  if (!val) return;
  window._cats.push(val);
  document.getElementById('cfg-nova-cat').value = '';
  renderCats();
  mostrarToast('Categoria adicionada', 'success');
}

function removerCat(i) { window._cats.splice(i, 1); renderCats(); }

function adicionarSegmento() {
  const val = document.getElementById('cfg-novo-seg')?.value?.trim();
  if (!val) return;
  window._segs.push(val);
  document.getElementById('cfg-novo-seg').value = '';
  renderSegs();
  mostrarToast('Segmento adicionado', 'success');
}

function removerSeg(i) { window._segs.splice(i, 1); renderSegs(); }

function salvarConfigEmpresa() { mostrarToast('Dados salvos localmente', 'success'); }
function salvarConfigFiscal() {
  const aliquota = parseFloat(document.getElementById('cfg-aliquota')?.value) || 6;
  if (CONFIG.DEFAULTS) CONFIG.DEFAULTS.ALIQUOTA_SIMPLES = aliquota / 100;
  mostrarToast('Aliquota atualizada para ' + aliquota + '%', 'success');
}

function gerarNovaSenha() {
  const nova = document.getElementById('cfg-senha-nova')?.value;
  const conf = document.getElementById('cfg-senha-conf')?.value;
  if (!nova) { mostrarToast('Digite a nova senha', 'error'); return; }
  if (nova !== conf) { mostrarToast('Senhas nao conferem', 'error'); return; }
  abrirModal('Instrucoes para alterar senha', `
    <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">Para alterar a senha, edite o arquivo <code style="background:var(--bg-3);padding:2px 6px;border-radius:4px;">js/config.js</code> no seu computador:</p>
    <div style="background:var(--bg-3);border-radius:var(--radius);padding:12px;font-family:monospace;font-size:13px;margin-bottom:16px;">
      SENHA: '<strong>${nova}</strong>'
    </div>
    <p style="color:var(--text-2);font-size:13px;">Depois faca o push para o GitHub normalmente.</p>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Entendi</button></div>`, 'modal-sm');
}
