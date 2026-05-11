// =============================================
// DASHBOARD
// =============================================

let dashFiltro = '30'; // dias padrão
let dashModo = 'realizado'; // realizado | previsao
let dashMes = new Date().getMonth() + 1;
let dashAno = new Date().getFullYear();
let dashTipoFiltro = 'periodo'; // periodo | mes

function renderDashboard() {
  const container = document.getElementById('page-container');
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Visão geral — Móveis e Esquadrias Werner</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="inicializarSistema()">⚙ Inicializar Sistema</button>
        <button class="btn btn-secondary btn-sm" onclick="exportarDashboard()">⬇ Exportar</button>
      </div>
    </div>

    <!-- FILTROS -->
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="display:flex;gap:4px;">
          <button class="filter-btn ${dashTipoFiltro==='periodo'?'active':''}" onclick="setTipoFiltro('periodo')">Por período</button>
          <button class="filter-btn ${dashTipoFiltro==='mes'?'active':''}" onclick="setTipoFiltro('mes')">Por mês</button>
        </div>
        <div id="filtros-periodo" style="display:flex;gap:4px;flex-wrap:wrap;${dashTipoFiltro!=='periodo'?'display:none!important':''}">
          ${['3','7','30','90','180','365','0'].map(d => `
            <button class="filter-btn ${dashFiltro===d?'active':''}" onclick="setFiltroDias('${d}')">
              ${d==='0'?'Total':d==='180'?'6m':d==='365'?'1a':d+'d'}
            </button>`).join('')}
        </div>
        <div id="filtros-mes" style="${dashTipoFiltro!=='mes'?'display:none':'display:flex;gap:8px;align-items:center;'}">
          <select onchange="setFiltroMes(this.value,document.getElementById('sel-ano').value)" style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:13px;">
            ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i)=>
              `<option value="${i+1}" ${dashMes==i+1?'selected':''}>${m}</option>`).join('')}
          </select>
          <input id="sel-ano" type="number" value="${dashAno}" min="2020" max="2030"
            style="background:var(--bg-3);border:1px solid var(--border-2);border-radius:var(--radius);padding:6px 10px;color:var(--text);font-size:13px;width:80px;"
            onchange="setFiltroMes(document.querySelector('#filtros-mes select').value,this.value)" />
          <div style="display:flex;gap:4px;">
            <button class="filter-btn ${dashModo==='realizado'?'active':''}" onclick="setModo('realizado')">Realizado</button>
            <button class="filter-btn ${dashModo==='previsao'?'active':''}" onclick="setModo('previsao')">Previsão</button>
          </div>
        </div>
      </div>
    </div>

    <!-- SALDO -->
    <div id="dash-saldo" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- ENTRADAS/SAÍDAS/LUCRO -->
    <div id="dash-financeiro" class="grid-4" style="margin-bottom:16px;"></div>

    <!-- CUSTOS FIXOS -->
    <div id="dash-custos" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- CONTAS A RECEBER/PAGAR -->
    <div id="dash-contas" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- CHEQUES -->
    <div id="dash-cheques" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- CARTÃO + COMBUSTÍVEL -->
    <div id="dash-outros" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- PROJETOS + ORÇAMENTOS -->
    <div id="dash-projetos" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- ALERTAS -->
    <div id="dash-alertas" class="grid-2" style="margin-bottom:16px;"></div>

    <!-- RELATÓRIO DE DESPESAS -->
    <div id="dash-despesas" style="margin-bottom:16px;"></div>

    <!-- COMPARATIVO MENSAL -->
    <div id="dash-comparativo" style="margin-bottom:16px;"></div>
  `;

  solicitarAutorizacao(carregarDashboard);
}

async function carregarDashboard() {
  mostrarToast('Atualizando dashboard...', '');
  await carregarDados([
    CONFIG.SHEETS.FLUXO_CAIXA,
    CONFIG.SHEETS.CONTAS_RECEBER,
    CONFIG.SHEETS.CONTAS_PAGAR,
    CONFIG.SHEETS.CHEQUES,
    CONFIG.SHEETS.CARTAO_LANCAMENTOS,
    CONFIG.SHEETS.CARTOES,
    CONFIG.SHEETS.COMBUSTIVEL,
    CONFIG.SHEETS.PROJETOS,
    CONFIG.SHEETS.ORCAMENTOS,
    CONFIG.SHEETS.CUSTOS_FIXOS,
  ]);
  renderDashboardBlocos();
}

window.carregar_dashboard = carregarDashboard;

function getFluxoFiltrado() {
  const fluxo = window.DB.fluxo_caixa || [];
  if (dashTipoFiltro === 'mes') {
    return fluxo.filter(f => {
      const d = new Date(f.data + 'T00:00:00');
      const modoOk = dashModo === 'previsao' ? true : d <= new Date();
      return d.getMonth()+1 === parseInt(dashMes) && d.getFullYear() === parseInt(dashAno) && modoOk;
    });
  }
  if (dashFiltro === '0') return fluxo;
  const limite = new Date(); limite.setDate(limite.getDate() - parseInt(dashFiltro));
  return fluxo.filter(f => new Date(f.data + 'T00:00:00') >= limite);
}

function renderDashboardBlocos() {
  // Verifica se esta na pagina do dashboard
  if (!document.getElementById('dash-saldo')) return;
  const fluxo = getFluxoFiltrado();
  const entradas = fluxo.filter(f => f.tipo === 'Entrada');
  const saidas = fluxo.filter(f => f.tipo === 'Saída');
  const totalEntradas = somarCampo(entradas, 'valor');
  const totalSaidas = somarCampo(saidas, 'valor');
  const lucro = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? (lucro / totalEntradas * 100) : 0;

  // Saldo
  const banco = somarCampo(fluxo.filter(f=>f.conta==='Banco'), 'valor') * (1) -
                somarCampo(fluxo.filter(f=>f.conta==='Banco'&&f.tipo==='Saída'), 'valor') * 2;
  const caixa = somarCampo(fluxo.filter(f=>f.conta==='Caixa'&&f.tipo==='Entrada'), 'valor') -
                somarCampo(fluxo.filter(f=>f.conta==='Caixa'&&f.tipo==='Saída'), 'valor');

  // Calcula saldo real por conta
  const todas = window.DB.fluxo_caixa || [];
  const contas = typeof getSysConfig === 'function' ? getSysConfig('contas') : ['Viacredi','Caixa'];
  const saldos = contas.map(conta => {
    const val = somarCampo(todas.filter(f=>f.conta===conta&&f.tipo==='Entrada'),'valor') -
                somarCampo(todas.filter(f=>f.conta===conta&&(f.tipo==='Saída'||f.tipo==='Saida')),'valor');
    return { conta, val };
  });
  const saldoTotal = saldos.reduce((acc,s) => acc + s.val, 0);

  document.getElementById('dash-saldo').innerHTML =
    saldos.map(s => `
    <div class="metric-card ${s.val>=0?'green':'red'}">
      <div class="metric-label">Saldo ${s.conta}</div>
      <div class="metric-value ${s.val>=0?'green':'red'}">${formatMoeda(s.val)}</div>
      <div class="metric-sub">Saldo atual</div>
    </div>`).join('') +
    (saldos.length > 1 ? `
    <div class="metric-card">
      <div class="metric-label">Saldo Total</div>
      <div class="metric-value ${saldoTotal>=0?'green':'red'}">${formatMoeda(saldoTotal)}</div>
      <div class="metric-sub">Todas as contas</div>
    </div>` : '');

  // Financeiro
  document.getElementById('dash-financeiro').innerHTML = `
    <div class="metric-card green">
      <div class="metric-label">Entradas</div>
      <div class="metric-value green">${formatMoeda(totalEntradas)}</div>
      <div class="metric-sub">${entradas.length} lançamentos</div>
    </div>
    <div class="metric-card red">
      <div class="metric-label">Saídas</div>
      <div class="metric-value red">${formatMoeda(totalSaidas)}</div>
      <div class="metric-sub">${saidas.length} lançamentos</div>
    </div>
    <div class="metric-card ${lucro>=0?'green':'red'}">
      <div class="metric-label">Lucro Líquido</div>
      <div class="metric-value ${lucro>=0?'green':'red'}">${formatMoeda(lucro)}</div>
      <div class="metric-sub">Entradas − Saídas</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Margem</div>
      <div class="metric-value accent">${margem.toFixed(1)}%</div>
      <div class="metric-sub">Lucro / Faturamento</div>
    </div>`;

  // Contas a receber/pagar
  const receber = (window.DB.contas_receber || []).filter(c => c.status !== 'Recebido' && c.status !== 'Pago');
  const pagar = (window.DB.contas_pagar || []).filter(c => c.status !== 'Pago' && c.status !== 'Recebido');

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em7 = new Date(); em7.setDate(em7.getDate()+7);
  const em30 = new Date(); em30.setDate(em30.getDate()+30);

  function agruparUrgencia(lista, campoVenc, campoVal) {
    const vHoje = somarCampo(lista.filter(i => { const d=new Date(i[campoVenc]+'T00:00:00'); return d<=hoje&&d>=hoje; }), campoVal);
    const v7 = somarCampo(lista.filter(i => { const d=new Date(i[campoVenc]+'T00:00:00'); return d>hoje&&d<=em7; }), campoVal);
    const v30 = somarCampo(lista.filter(i => { const d=new Date(i[campoVenc]+'T00:00:00'); return d>em7&&d<=em30; }), campoVal);
    const vAt = somarCampo(lista.filter(i => new Date(i[campoVenc]+'T00:00:00')<hoje), campoVal);
    const vTot = somarCampo(lista, campoVal);
    return { vHoje, v7, v30, vAt, vTot };
  }

  const rec = agruparUrgencia(receber, 'data_vencimento', 'valor_parcela');
  const pag = agruparUrgencia(pagar, 'data_vencimento', 'valor_parcela');

  document.getElementById('dash-contas').innerHTML = `
    <div class="card">
      <div class="card-title" style="color:var(--green);">A Receber</div>
      <table class="urgency-table">
        <tr><td class="label">Vence hoje</td><td class="val green">${formatMoeda(rec.vHoje)}</td></tr>
        <tr><td class="label">Vence em 7 dias</td><td class="val">${formatMoeda(rec.v7)}</td></tr>
        <tr><td class="label">Vence em 30 dias</td><td class="val">${formatMoeda(rec.v30)}</td></tr>
        <tr><td class="label" style="color:var(--red)">Atrasado</td><td class="val red">${formatMoeda(rec.vAt)}</td></tr>
        <tr><td class="label"><strong>Total em aberto</strong></td><td class="val accent"><strong>${formatMoeda(rec.vTot)}</strong></td></tr>
      </table>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--red);">A Pagar</div>
      <table class="urgency-table">
        <tr><td class="label">Vence hoje</td><td class="val red">${formatMoeda(pag.vHoje)}</td></tr>
        <tr><td class="label">Vence em 7 dias</td><td class="val">${formatMoeda(pag.v7)}</td></tr>
        <tr><td class="label">Vence em 30 dias</td><td class="val">${formatMoeda(pag.v30)}</td></tr>
        <tr><td class="label" style="color:var(--red)">Atrasado</td><td class="val red">${formatMoeda(pag.vAt)}</td></tr>
        <tr><td class="label"><strong>Total em aberto</strong></td><td class="val accent"><strong>${formatMoeda(pag.vTot)}</strong></td></tr>
      </table>
    </div>`;

  // Cheques
  const cheques = window.DB.cheques || [];
  const chRec = cheques.filter(c=>c.tipo==='Recebido'&&c.status==='Aguardando');
  const chEm = cheques.filter(c=>c.tipo==='Emitido'&&c.status==='Aguardando');
  const chR = agruparUrgencia(chRec,'data_bom_para','valor');
  const chE = agruparUrgencia(chEm,'data_bom_para','valor');

  document.getElementById('dash-cheques').innerHTML = `
    <div class="card">
      <div class="card-title">Cheques a Receber</div>
      <table class="urgency-table">
        <tr><td class="label">Bom para hoje</td><td class="val green">${formatMoeda(chR.vHoje)} (${chRec.filter(c=>diasAte(c.data_bom_para)===0).length}un)</td></tr>
        <tr><td class="label">Bom em 7 dias</td><td class="val">${formatMoeda(chR.v7)} (${chRec.filter(c=>{const d=diasAte(c.data_bom_para);return d>0&&d<=7;}).length}un)</td></tr>
        <tr><td class="label">Bom em 30 dias</td><td class="val">${formatMoeda(chR.v30)} (${chRec.filter(c=>{const d=diasAte(c.data_bom_para);return d>7&&d<=30;}).length}un)</td></tr>
        <tr><td class="label" style="color:var(--red)">Atrasado/Devolvido</td><td class="val red">${formatMoeda(chR.vAt)}</td></tr>
        <tr><td class="label"><strong>Total</strong></td><td class="val accent"><strong>${formatMoeda(chR.vTot)} (${chRec.length}un)</strong></td></tr>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Cheques Emitidos</div>
      <table class="urgency-table">
        <tr><td class="label">Bom para hoje</td><td class="val red">${formatMoeda(chE.vHoje)} (${chEm.filter(c=>diasAte(c.data_bom_para)===0).length}un)</td></tr>
        <tr><td class="label">Bom em 7 dias</td><td class="val">${formatMoeda(chE.v7)} (${chEm.filter(c=>{const d=diasAte(c.data_bom_para);return d>0&&d<=7;}).length}un)</td></tr>
        <tr><td class="label">Bom em 30 dias</td><td class="val">${formatMoeda(chE.v30)} (${chEm.filter(c=>{const d=diasAte(c.data_bom_para);return d>7&&d<=30;}).length}un)</td></tr>
        <tr><td class="label" style="color:var(--red)">Atrasado/Devolvido</td><td class="val red">${formatMoeda(chE.vAt)}</td></tr>
        <tr><td class="label"><strong>Total</strong></td><td class="val accent"><strong>${formatMoeda(chE.vTot)} (${chEm.length}un)</strong></td></tr>
      </table>
    </div>`;

  // Combustível + Cartão
  const mesAtual = new Date().getMonth()+1;
  const anoAtual = new Date().getFullYear();
  const combFiltrado = getFluxoFiltrado().filter(f=>f.categoria==='Combustível');
  const totalComb = somarCampo(combFiltrado,'valor');

  const lançamentos = window.DB.cartao_lancamentos || [];
  const cartoes = window.DB.cartoes || [];
  const lancesMes = lançamentos.filter(l=>parseInt(l.mes_fatura)===mesAtual&&parseInt(l.ano_fatura)===anoAtual);
  const totalCartaoMes = somarCampo(lancesMes.filter(l=>l.tipo==='Compra'),'valor_parcela');

  document.getElementById('dash-outros').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Combustível</div>
      <div class="metric-value accent">${formatMoeda(totalComb)}</div>
      <div class="metric-sub">Gasto no período</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Cartão de Crédito</div>
      <div class="metric-value accent">${formatMoeda(totalCartaoMes)}</div>
      <div class="metric-sub">Fatura de ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mesAtual-1]}/${anoAtual}</div>
    </div>`;

  // Projetos
  const projetos = window.DB.projetos || [];
  const orcamentos = window.DB.orcamentos || [];

  let projFiltrados;
  if (dashTipoFiltro === 'mes') {
    projFiltrados = projetos.filter(p => {
      if (p.status === 'Cancelado') return false;
      const inicio = new Date(p.data_inicio+'T00:00:00');
      const fim = p.data_entrega_real ? new Date(p.data_entrega_real+'T00:00:00') : new Date();
      const mesD = new Date(dashAno, dashMes-1, 1);
      const mesF = new Date(dashAno, dashMes, 0);
      return inicio <= mesF && fim >= mesD;
    });
  } else {
    projFiltrados = projetos.filter(p => p.status !== 'Cancelado');
  }

  const pAndamento = projFiltrados.filter(p=>p.status==='Em andamento').length;
  const pAtrasados = projFiltrados.filter(p=>p.status==='Atrasado').length;
  const pConcluidos = projFiltrados.filter(p=>p.status==='Concluído').length;

  const orcFiltrados = orcamentos.filter(o => {
    if (dashTipoFiltro === 'mes') {
      const d = new Date(o.data+'T00:00:00');
      return d.getMonth()+1===parseInt(dashMes)&&d.getFullYear()===parseInt(dashAno);
    }
    return true;
  });
  const oEnviados = orcFiltrados.filter(o=>o.status==='Enviado').length;
  const oAprovados = orcFiltrados.filter(o=>o.status==='Aprovado').length;
  const oRecusados = orcFiltrados.filter(o=>o.status==='Recusado').length;
  const taxaConv = oEnviados+oAprovados > 0 ? (oAprovados/(oEnviados+oAprovados)*100).toFixed(0) : 0;

  document.getElementById('dash-projetos').innerHTML = `
    <div class="card">
      <div class="card-title">Projetos</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:var(--blue)">${pAndamento}</div>
          <div style="font-size:11px;color:var(--text-3)">Em andamento</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:var(--red)">${pAtrasados}</div>
          <div style="font-size:11px;color:var(--text-3)">Atrasados</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:var(--green)">${pConcluidos}</div>
          <div style="font-size:11px;color:var(--text-3)">Concluídos</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Orçamentos</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:var(--blue)">${oEnviados}</div>
          <div style="font-size:11px;color:var(--text-3)">Enviados</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:var(--green)">${oAprovados}</div>
          <div style="font-size:11px;color:var(--text-3)">Aprovados</div>
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:700;color:var(--accent)">${taxaConv}%</div>
          <div style="font-size:11px;color:var(--text-3)">Conversão</div>
        </div>
      </div>
    </div>`;

  // Alertas
  const vencHoje = [...receber, ...pagar].filter(c => diasAte(c.data_vencimento) === 0);
  const proxVenc = [...receber, ...pagar]
    .filter(c => { const d=diasAte(c.data_vencimento); return d!==null&&d>0&&d<=30; })
    .sort((a,b)=>new Date(a.data_vencimento)-new Date(b.data_vencimento))
    .slice(0, 5);
  const inadimplentes = receber.filter(c => diasAte(c.data_vencimento) < 0);
  const totalInadimp = somarCampo(inadimplentes, 'valor_parcela');

  document.getElementById('dash-alertas').innerHTML = `
    <div class="card">
      <div class="card-title" style="color:var(--red)">⚠ Vencimentos Hoje</div>
      ${vencHoje.length === 0
        ? '<p style="color:var(--text-3);font-size:13px;margin-top:8px;">Nenhum vencimento hoje</p>'
        : vencHoje.slice(0,5).map(c=>`
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <span>${c.cliente_nome||c.fornecedor_nome||'—'} <span style="color:var(--text-3)">${c.descricao||''}</span></span>
            <span style="color:${c.cliente_nome?'var(--green)':'var(--red)'}">${formatMoeda(c.valor_parcela)}</span>
          </div>`).join('')
      }
    </div>
    <div class="card">
      <div class="card-title">📅 Próximos Vencimentos</div>
      ${proxVenc.length === 0
        ? '<p style="color:var(--text-3);font-size:13px;margin-top:8px;">Nenhum vencimento próximo</p>'
        : proxVenc.map(c=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <div>
              <div>${c.cliente_nome||c.fornecedor_nome||'—'}</div>
              <div style="color:var(--text-3);font-size:11px;">${formatData(c.data_vencimento)}</div>
            </div>
            <div style="text-align:right;">
              <div>${formatMoeda(c.valor_parcela)}</div>
              ${urgencia(c.data_vencimento)}
            </div>
          </div>`).join('')
      }
      ${inadimplentes.length > 0 ? `
        <div style="margin-top:12px;padding:10px;background:var(--red-bg);border-radius:var(--radius);">
          <div style="color:var(--red);font-size:12px;font-weight:600;">🔴 Inadimplência</div>
          <div style="font-size:13px;margin-top:4px;">${formatMoeda(totalInadimp)} — ${inadimplentes.length} cliente(s)</div>
        </div>` : ''}
    </div>`;

  // Relatório de despesas
  const cats = ['Materiais','Custos fixos','Cartão de crédito','Combustível','Fornecedores','Pessoal','Outros'];
  const despesas = saidas.reduce((acc, s) => {
    const cat = cats.includes(s.categoria) ? s.categoria : 'Outros';
    acc[cat] = (acc[cat]||0) + parseFloat(s.valor||0);
    return acc;
  }, {});
  const totalDesp = Object.values(despesas).reduce((a,b)=>a+b,0);

  document.getElementById('dash-despesas').innerHTML = `
    <div class="card">
      <div class="card-title">📊 Relatório de Despesas</div>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead><tr>
          <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Categoria</th>
          <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Valor</th>
          <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">%</th>
        </tr></thead>
        <tbody>
          ${cats.map(cat => {
            const val = despesas[cat]||0;
            const pct = totalDesp > 0 ? (val/totalDesp*100).toFixed(1) : '0.0';
            return val > 0 ? `<tr>
              <td style="padding:8px;font-size:13px;border-bottom:1px solid var(--border)">${cat}</td>
              <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${formatMoeda(val)}</td>
              <td style="padding:8px;font-size:13px;text-align:right;color:var(--text-3);border-bottom:1px solid var(--border)">${pct}%</td>
            </tr>` : '';
          }).join('')}
          <tr style="font-weight:600;">
            <td style="padding:8px;font-size:13px;font-family:'Syne',sans-serif">Total</td>
            <td style="padding:8px;font-size:13px;text-align:right;color:var(--accent);font-family:'Syne',sans-serif">${formatMoeda(totalDesp)}</td>
            <td style="padding:8px;font-size:13px;text-align:right;color:var(--text-3)">100%</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  // Comparativo mensal
  renderComparativoMensal();
}

function renderComparativoMensal() {
  const fluxo = window.DB.fluxo_caixa || [];
  const projetos = window.DB.projetos || [];
  const meses = [];
  const anoAtual = new Date().getFullYear();

  for (let m = 1; m <= 12; m++) {
    const fl = fluxo.filter(f => {
      const d = new Date(f.data+'T00:00:00');
      return d.getMonth()+1 === m && d.getFullYear() === anoAtual;
    });
    const ent = somarCampo(fl.filter(f=>f.tipo==='Entrada'),'valor');
    const sai = somarCampo(fl.filter(f=>f.tipo==='Saída'),'valor');
    const lucro = ent - sai;
    const margem = ent > 0 ? (lucro/ent*100).toFixed(1) : '0.0';
    const mats = somarCampo(fl.filter(f=>f.categoria==='Materiais'),'valor');
    const nProj = projetos.filter(p => {
      const ini = new Date(p.data_inicio+'T00:00:00');
      const fim = p.data_entrega_real ? new Date(p.data_entrega_real+'T00:00:00') : new Date();
      const mesD = new Date(anoAtual, m-1, 1);
      const mesF = new Date(anoAtual, m, 0);
      return ini <= mesF && fim >= mesD && p.status !== 'Cancelado';
    }).length;
    meses.push({ m, ent, sai, lucro, margem, mats, nProj });
  }

  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  document.getElementById('dash-comparativo').innerHTML = `
    <div class="card">
      <div class="card-title">📈 Comparativo Mensal ${anoAtual}</div>
      <div style="overflow-x:auto;margin-top:12px;">
        <table style="width:100%;border-collapse:collapse;min-width:700px;">
          <thead><tr>
            <th style="text-align:left;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Mês</th>
            <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Faturamento</th>
            <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Custo</th>
            <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Lucro</th>
            <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Margem%</th>
            <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Projetos</th>
            <th style="text-align:right;padding:8px;font-size:11px;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border)">Mat.</th>
          </tr></thead>
          <tbody>
            ${meses.map(mes => `
              <tr style="${mes.m===new Date().getMonth()+1?'background:rgba(200,169,110,0.05)':''}">
                <td style="padding:8px;font-size:13px;font-weight:${mes.m===new Date().getMonth()+1?'600':'400'};border-bottom:1px solid var(--border)">${nomes[mes.m-1]}</td>
                <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${mes.ent>0?formatMoeda(mes.ent):'—'}</td>
                <td style="padding:8px;font-size:13px;text-align:right;color:var(--red);border-bottom:1px solid var(--border)">${mes.sai>0?formatMoeda(mes.sai):'—'}</td>
                <td style="padding:8px;font-size:13px;text-align:right;color:${mes.lucro>0?'var(--green)':mes.lucro<0?'var(--red)':'var(--text-3)'};border-bottom:1px solid var(--border)">${mes.ent>0?formatMoeda(mes.lucro):'—'}</td>
                <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${mes.ent>0?mes.margem+'%':'—'}</td>
                <td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid var(--border)">${mes.nProj>0?mes.nProj:'—'}</td>
                <td style="padding:8px;font-size:13px;text-align:right;color:var(--text-2);border-bottom:1px solid var(--border)">${mes.mats>0?formatMoeda(mes.mats):'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// Funções de controle de filtro
function setFiltroDias(dias) {
  dashFiltro = dias;
  dashTipoFiltro = 'periodo';
  renderDashboard();
  setTimeout(carregarDashboard, 100);
}

function setTipoFiltro(tipo) {
  dashTipoFiltro = tipo;
  renderDashboard();
  setTimeout(carregarDashboard, 100);
}

function setFiltroMes(mes, ano) {
  dashMes = parseInt(mes);
  dashAno = parseInt(ano);
  dashTipoFiltro = 'mes';
  renderDashboardBlocos();
}

function setModo(modo) {
  dashModo = modo;
  renderDashboardBlocos();
}

function exportarDashboard() {
  mostrarToast('Exportação em desenvolvimento', '');
}
