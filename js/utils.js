// =============================================
// UTILS — Funções utilitárias
// =============================================

// Formatação de moeda
function formatMoeda(val) {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formatação de data
function formatData(val) {
  if (!val) return '—';
  const d = new Date(val + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

// Data atual no formato YYYY-MM-DD
function hoje() {
  return new Date().toISOString().split('T')[0];
}

// Gera ID único
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Gera número sequencial com prefixo (ex: ORC-001)
function gerarNumero(prefixo, lista) {
  const max = lista.reduce((acc, item) => {
    const num = parseInt((item.numero || '0').replace(/\D/g, '')) || 0;
    return Math.max(acc, num);
  }, 0);
  return `${prefixo}-${String(max + 1).padStart(3, '0')}`;
}

// Toast notification
function mostrarToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${tipo}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// Modal global
function abrirModal(titulo, html, largura = '') {
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-body').innerHTML = html;
  const box = document.querySelector('.modal-box');
  box.className = `modal-box ${largura}`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// Confirmar ação destrutiva
function confirmar(msg, callback) {
  const html = `
    <p style="color:var(--text-2);margin-bottom:24px;">${msg}</p>
    <div class="modal-footer" style="padding:0;">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="fecharModal();(${callback})()">Confirmar</button>
    </div>`;
  abrirModal('Confirmar ação', html, 'modal-sm');
}

// Diferença em dias entre duas datas
function diasAte(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const alvo = new Date(dataStr + 'T00:00:00');
  return Math.round((alvo - hoje) / (1000 * 60 * 60 * 24));
}

// Badge de status padrão
function badgeStatus(status) {
  const map = {
    'Aprovado': 'badge-green', 'Concluído': 'badge-green', 'Pago': 'badge-green', 'Compensado': 'badge-green', 'Recebido': 'badge-green',
    'Pendente': 'badge-yellow', 'Em andamento': 'badge-blue', 'Enviado': 'badge-blue', 'Aguardando': 'badge-yellow',
    'Atrasado': 'badge-red', 'Vencido': 'badge-red', 'Devolvido': 'badge-red', 'Cancelado': 'badge-red', 'Recusado': 'badge-red',
    'Rascunho': 'badge-gray', 'Pausado': 'badge-gray', 'Parcialmente pago': 'badge-accent', 'Parcialmente recebido': 'badge-accent',
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status}</span>`;
}

// Formata número de telefone
function formatTel(val) {
  if (!val) return '—';
  const n = val.replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return val;
}

// Calcula urgência de vencimento
function urgencia(dataVenc) {
  const dias = diasAte(dataVenc);
  if (dias === null) return '';
  if (dias < 0) return '<span class="badge badge-red">Atrasado</span>';
  if (dias === 0) return '<span class="badge badge-red">Hoje</span>';
  if (dias <= 7) return `<span class="badge badge-yellow">${dias}d</span>`;
  if (dias <= 30) return `<span class="badge badge-blue">${dias}d</span>`;
  return `<span class="badge badge-gray">${dias}d</span>`;
}

// Debounce para busca
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Mostra loading em um container
function mostrarLoading(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div> Carregando...</div>`;
}

// Estado vazio
function estadoVazio(msg = 'Nenhum registro encontrado') {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

// Soma array de objetos por campo
function somarCampo(arr, campo) {
  return arr.reduce((acc, item) => acc + (parseFloat(item[campo]) || 0), 0);
}

// Filtra por período
function filtrarPorPeriodo(arr, campData, dias) {
  if (!dias) return arr;
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return arr.filter(item => {
    const d = new Date(item[campData]);
    return d >= limite;
  });
}
