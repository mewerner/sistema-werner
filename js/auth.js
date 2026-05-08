// =============================================
// AUTH — Login senha + Google OAuth
// =============================================

let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let googleAuthorized = false;

// --- LOGIN COM SENHA ---

function fazerLogin() {
  const senha = document.getElementById('senha-input').value;
  const erro = document.getElementById('login-error');
  if (senha === CONFIG.SENHA) {
    erro.classList.remove('visible');
    sessionStorage.setItem('werner_auth', 'true');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    iniciarApp();
  } else {
    erro.classList.add('visible');
    document.getElementById('senha-input').value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Enter no campo de senha
  const input = document.getElementById('senha-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fazerLogin();
    });
  }
  // Se já autenticado na sessão
  if (sessionStorage.getItem('werner_auth') === 'true') {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    iniciarApp();
  }
});

function fazerLogout() {
  sessionStorage.removeItem('werner_auth');
  googleAuthorized = false;
  location.reload();
}

// --- GOOGLE OAUTH ---

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: '',
    discoveryDocs: [
      'https://sheets.googleapis.com/$discovery/rest?version=v4',
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
  });
  gapiInited = true;
  maybeAuthorize();
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: (resp) => {
      if (resp.error) { console.error(resp); return; }
      googleAuthorized = true;
      mostrarToast('Google conectado ✓', 'success');
      if (window._pendingSync) { window._pendingSync(); window._pendingSync = null; }
    },
  });
  gisInited = true;
  maybeAuthorize();
}

function maybeAuthorize() {
  if (!gapiInited || !gisInited) return;
  // Tenta silencioso primeiro
  tokenClient.requestAccessToken({ prompt: 'none' });
}

function solicitarAutorizacao(callback) {
  if (googleAuthorized) { callback(); return; }
  window._pendingSync = callback;
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function sincronizarDados() {
  solicitarAutorizacao(() => {
    mostrarToast('Sincronizando...', '');
    // Recarrega dados da página atual
    if (window.paginaAtual && window[`carregar_${window.paginaAtual}`]) {
      window[`carregar_${window.paginaAtual}`]();
    }
  });
}
