// PRECIFICACAO
function renderPrecificacao() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Precificacao</h1><p class="page-subtitle">Calculadora de preco antes do orcamento</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="verHistoricoPrecif()">Historico</button>
        <button class="btn btn-primary" onclick="resetarPrecif()">Nova Simulacao</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Dados da simulacao</div>
          <div class="input-group"><label>Nome da simulacao</label><input id="pc-nome" placeholder="Ex: Cozinha cliente X" /></div>
          <div class="input-group" style="margin-top:12px;"><label>Desperdicio de material (%)</label>
            <input type="number" step="0.1" id="pc-desperdicio" value="12" oninput="calcPrecif()" />
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Materiais</div>
          <div id="pc-mat-lista"></div>
          <button class="btn btn-secondary btn-sm" onclick="addMatPrecif()" style="margin-top:8px;">+ Material</button>
          <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px;">
            <span style="color:var(--text-2)">Subtotal materiais (com desperdicio):</span>
            <span id="pc-sub-mat" style="font-weight:600;color:var(--accent)">R$ 0,00</span>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Mao de obra</div>
          <div class="form-row cols-2">
            <div class="input-group"><label>Horas estimadas</label><input type="number" step="0.5" id="pc-horas" value="0" oninput="calcPrecif()" /></div>
            <div class="input-group"><label>Valor hora (R$)</label><input type="number" step="0.01" id="pc-valor_hora" value="0" oninput="calcPrecif()" /></div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Custos fixos rateados</div>
          <div class="form-row cols-2">
            <div class="input-group"><label>Custo fixo total/mes (R$)</label><input type="number" step="0.01" id="pc-cf_mes" value="0" oninput="calcPrecif()" /></div>
            <div class="input-group"><label>Horas produtivas/mes</label><input type="number" id="pc-horas_mes" value="160" oninput="calcPrecif()" /></div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Entrega e instalacao</div>
          <div class="form-row cols-2">
            <div class="input-group"><label>Distancia (km)</label><input type="number" id="pc-km" value="0" oninput="calcPrecif()" /></div>
            <div class="input-group"><label>Custo por km (R$)</label><input type="number" step="0.01" id="pc-custo_km" value="0.80" oninput="calcPrecif()" /></div>
          </div>
          <div class="form-row cols-2" style="margin-top:8px;">
            <div class="input-group"><label>Horas instalacao</label><input type="number" step="0.5" id="pc-horas_inst" value="0" oninput="calcPrecif()" /></div>
            <div class="input-group"><label>Valor hora instalacao (R$)</label><input type="number" step="0.01" id="pc-valor_hora_inst" value="0" oninput="calcPrecif()" /></div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Margem e imposto</div>
          <div class="form-row cols-2">
            <div class="input-group"><label>Margem de lucro (%)</label><input type="number" step="0.1" id="pc-margem" value="30" oninput="calcPrecif()" /></div>
            <div class="input-group"><label>Considerar imposto?</label>
              <select id="pc-imposto" onchange="calcPrecif()">
                <option value="nao">Nao</option>
                <option value="sim">Sim (Simples ~6%)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="card" style="position:sticky;top:20px;">
          <div class="card-title">Resultado</div>
          <table style="width:100%;font-size:13px;margin-bottom:16px;">
            <tr><td style="padding:6px 0;color:var(--text-2)">Materiais + desperdicio</td><td id="r-mat" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Mao de obra</td><td id="r-mao" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Custos fixos rateados</td><td id="r-cf" style="text-align:right">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)">Entrega + instalacao</td><td id="r-ent" style="text-align:right">R$ 0,00</td></tr>
            <tr style="border-top:1px solid var(--border)"><td style="padding:8px 0;color:var(--text-2)">Subtotal custo</td><td id="r-sub" style="text-align:right;font-weight:600">R$ 0,00</td></tr>
            <tr><td style="padding:6px 0;color:var(--text-2)" id="r-margem-label">Margem 30%</td><td id="r-margem" style="text-align:right;color:var(--accent)">R$ 0,00</td></tr>
            <tr id="r-imp-row" style="display:none"><td style="padding:6px 0;color:var(--text-2)">Imposto ~6%</td><td id="r-imp" style="text-align:right;color:var(--yellow)">R$ 0,00</td></tr>
            <tr style="border-top:2px solid var(--accent)"><td style="padding:12px 0;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;">PRECO SUGERIDO</td><td id="r-final" style="text-align:right;font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent)">R$ 0,00</td></tr>
          </table>
          <hr class="divider"/>
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">Simulador de margem inversa — preco do cliente</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="number" step="0.01" id="pc-preco_cliente" placeholder="Preco que o cliente quer pagar (R$)" oninput="calcMargensInversa()"
                style="flex:1;background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
            </div>
            <div id="r-inversa" style="margin-top:8px;font-size:13px;"></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-secondary" onclick="salvarSimulacao()">Salvar simulacao</button>
            <button class="btn btn-primary" onclick="abrirOrcamentoFromPrecif()">Abrir como orcamento</button>
          </div>
        </div>
      </div>
    </div>`;
  window._precifMats = [];
  addMatPrecif();
  calcPrecif();
}

function addMatPrecif() {
  const idx = window._precifMats.length;
  window._precifMats.push({});
  const lista = document.getElementById('pc-mat-lista');
  if (!lista) return;
  const div = document.createElement('div');
  div.id = 'pc-mat-' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center;';
  div.innerHTML = `
    <input placeholder="Descricao" id="pm-desc-${idx}" oninput="calcPrecif()"
      style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
    <input type="number" step="0.01" placeholder="Qtd" id="pm-qtd-${idx}" oninput="calcPrecif()"
      style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
    <input type="number" step="0.01" placeholder="R$/un" id="pm-preco-${idx}" oninput="calcPrecif()"
      style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:8px;color:var(--text);font-size:13px;" />
    <button onclick="remMatPrecif(${idx})"
      style="background:var(--red-bg);border:1px solid rgba(224,92,92,0.2);border-radius:var(--radius);padding:8px;color:var(--red);cursor:pointer;">✕</button>`;
  lista.appendChild(div);
}

function remMatPrecif(idx) {
  const el = document.getElementById('pc-mat-' + idx);
  if (el) el.remove();
  calcPrecif();
}

function calcPrecif() {
  const desperdicio = (parseFloat(document.getElementById('pc-desperdicio')?.value) || 0) / 100;
  let totalMat = 0;
  document.querySelectorAll('[id^="pm-qtd-"]').forEach(el => {
    const i = el.id.replace('pm-qtd-','');
    const qtd = parseFloat(el.value) || 0;
    const preco = parseFloat(document.getElementById('pm-preco-'+i)?.value) || 0;
    totalMat += qtd * preco;
  });
  const matComDesp = totalMat * (1 + desperdicio);
  const horas = parseFloat(document.getElementById('pc-horas')?.value) || 0;
  const valorHora = parseFloat(document.getElementById('pc-valor_hora')?.value) || 0;
  const maoObra = horas * valorHora;
  const cfMes = parseFloat(document.getElementById('pc-cf_mes')?.value) || 0;
  const horasMes = parseFloat(document.getElementById('pc-horas_mes')?.value) || 160;
  const cfHora = horasMes > 0 ? cfMes / horasMes : 0;
  const cfRateado = cfHora * horas;
  const km = parseFloat(document.getElementById('pc-km')?.value) || 0;
  const custoKm = parseFloat(document.getElementById('pc-custo_km')?.value) || 0;
  const horasInst = parseFloat(document.getElementById('pc-horas_inst')?.value) || 0;
  const valorHoraInst = parseFloat(document.getElementById('pc-valor_hora_inst')?.value) || 0;
  const entrega = km * custoKm + horasInst * valorHoraInst;
  const subtotal = matComDesp + maoObra + cfRateado + entrega;
  const margem = (parseFloat(document.getElementById('pc-margem')?.value) || 0) / 100;
  const comMargem = subtotal * (1 + margem);
  const imposto = document.getElementById('pc-imposto')?.value === 'sim';
  const aliquota = imposto ? 0.06 : 0;
  const final = comMargem * (1 + aliquota);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatMoeda(val); };
  set('r-mat', matComDesp);
  set('r-mao', maoObra);
  set('r-cf', cfRateado);
  set('r-ent', entrega);
  set('r-sub', subtotal);
  set('r-margem', comMargem - subtotal);
  set('r-final', final);
  const subMatEl = document.getElementById('pc-sub-mat');
  if (subMatEl) subMatEl.textContent = formatMoeda(matComDesp);
  const margLabel = document.getElementById('r-margem-label');
  if (margLabel) margLabel.textContent = 'Margem ' + (margem*100).toFixed(0) + '%';
  const impRow = document.getElementById('r-imp-row');
  if (impRow) impRow.style.display = imposto ? '' : 'none';
  if (imposto) set('r-imp', final - comMargem);
  window._precifResult = { matComDesp, maoObra, cfRateado, entrega, subtotal, final };
}

function calcMargensInversa() {
  const precoCliente = parseFloat(document.getElementById('pc-preco_cliente')?.value) || 0;
  const res = window._precifResult || {};
  const custo = res.subtotal || 0;
  const el = document.getElementById('r-inversa');
  if (!el) return;
  if (!precoCliente || !custo) { el.innerHTML = ''; return; }
  const margem = ((precoCliente - custo) / precoCliente * 100);
  const viavel = margem >= 10;
  el.innerHTML = `<div style="padding:10px;background:${viavel?'var(--green-bg)':'var(--red-bg)'};border-radius:var(--radius);">
    <div style="color:${viavel?'var(--green)':'var(--red)'};font-weight:600;">${viavel ? 'Viavel' : 'Inviavel'}</div>
    <div style="font-size:12px;margin-top:4px;">Margem resultante: ${margem.toFixed(1)}%</div>
    <div style="font-size:12px;">Lucro: ${formatMoeda(precoCliente - custo)}</div>
    ${!viavel ? '<div style="font-size:12px;margin-top:4px;">Preco minimo recomendado: ' + formatMoeda(custo * 1.15) + '</div>' : ''}
  </div>`;
}

async function salvarSimulacao() {
  const nome = document.getElementById('pc-nome')?.value || 'Simulacao ' + hoje();
  const res = window._precifResult || {};
  await Sheets.adicionar(CONFIG.SHEETS.PRECIFICACAO, {
    id: gerarId(), nome, data: hoje(),
    preco_final: res.final || 0,
    observacoes: JSON.stringify(res),
  });
  mostrarToast('Simulacao salva', 'success');
}

function abrirOrcamentoFromPrecif() {
  const res = window._precifResult || {};
  navegarPara('orcamentos');
  setTimeout(() => {
    abrirFormOrcamento(null);
    setTimeout(() => {
      const el = document.getElementById('oc-total_materiais_custo');
      if (el) el.value = (res.matComDesp || 0).toFixed(2);
      const el2 = document.getElementById('oc-total_materiais_venda');
      if (el2) el2.value = (res.matComDesp || 0).toFixed(2);
      const el3 = document.getElementById('oc-mao_obra');
      if (el3) el3.value = (res.maoObra || 0).toFixed(2);
      const el4 = document.getElementById('oc-custos_indiretos');
      if (el4) el4.value = ((res.cfRateado || 0) + (res.entrega || 0)).toFixed(2);
      calcOrcTotal();
    }, 300);
  }, 300);
}

async function verHistoricoPrecif() {
  await carregarDados([CONFIG.SHEETS.PRECIFICACAO]);
  const lista = (window.DB.precificacao || []).sort((a,b) => new Date(b.data) - new Date(a.data));
  const html = `
    ${lista.length === 0 ? '<p style="color:var(--text-3)">Nenhuma simulacao salva.</p>' : `
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Nome</th>
        <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Data</th>
        <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border)">Preco final</th>
        <th style="padding:8px;border-bottom:1px solid var(--border)"></th>
      </tr></thead>
      <tbody>
        ${lista.map(s => `<tr>
          <td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border)">${s.nome}</td>
          <td style="padding:8px;font-size:12px;color:var(--text-3);border-bottom:1px solid var(--border)">${formatData(s.data)}</td>
          <td style="padding:8px;font-size:13px;text-align:right;font-weight:600;color:var(--accent);border-bottom:1px solid var(--border)">${formatMoeda(s.preco_final)}</td>
          <td style="padding:8px;border-bottom:1px solid var(--border)"><button class="btn btn-danger btn-sm btn-icon" onclick="excluirSimulacao('${s.id}')">🗑</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`}
    <div class="modal-footer"><button class="btn btn-secondary" onclick="fecharModal()">Fechar</button></div>`;
  abrirModal('Historico de Simulacoes', html, 'modal-lg');
}

async function excluirSimulacao(id) {
  await Sheets.excluir(CONFIG.SHEETS.PRECIFICACAO, id);
  mostrarToast('Excluido', 'success');
  fecharModal();
}

function resetarPrecif() { renderPrecificacao(); }
