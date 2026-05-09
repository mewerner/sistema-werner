// MASCARAS E CEP - funcoes utilitarias compartilhadas

function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) {
    v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    v = v.replace(/(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4');
  }
  input.value = v;
}

function mascaraCPF(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  input.value = v;
}

function mascaraCNPJ(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 14);
  v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
  input.value = v;
}

function mascaraCEP(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  v = v.replace(/(\d{5})(\d{0,3})/, '$1-$2');
  input.value = v;
  if (v.replace(/\D/g,'').length === 8) buscarCEP(input);
}

function mascaraCPFouCNPJ(input) {
  const nums = input.value.replace(/\D/g, '');
  if (nums.length <= 11) mascaraCPF(input);
  else mascaraCNPJ(input);
}

async function buscarCEP(input) {
  const cep = input.value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) { mostrarToast('CEP nao encontrado', 'error'); return; }
    // Tenta preencher campos pelo id padrao
    const prefix = input.id.split('-cep')[0] + '-';
    const set = (sufixo, val) => {
      const el = document.getElementById(prefix + sufixo);
      if (el && !el.value) el.value = val;
      else if (el) el.value = val;
    };
    set('logradouro', data.logradouro || '');
    set('bairro', data.bairro || '');
    set('cidade', data.localidade || '');
    set('estado', data.uf || '');
    mostrarToast('Endereco preenchido automaticamente', 'success');
  } catch(e) {
    mostrarToast('Erro ao buscar CEP', 'error');
  }
}
