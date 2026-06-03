// ===================== SUPABASE CONFIG =====================
// ⚠️  SEGURANÇA:
//   A ANON KEY abaixo é segura para o front-end pois é somente leitura pública.
//   O acesso real aos dados é controlado por Row Level Security (RLS) no Supabase.
//   NUNCA exponha a SERVICE_ROLE_KEY no front-end.
const SUPABASE_URL      = "https://nweligwbglblbncaegir.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZWxpZ3diZ2xibGJuY2FlZ2lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzAzNTgsImV4cCI6MjA5NTYwNjM1OH0.6eKcn40QmcfvHKAxuDH3kB6vHBJUu5LUVzfr27dvbKk";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== ESTADO GLOBAL =====================
let globalEquipamentos = [];
let paginaAtualEquipamento = 0;
const itensPorPagina = 8;
let chartOS = null, chartCrit = null, chartOSG = null;
let modoRecuperacao = false;

// Canvas assinatura
let canvas = document.getElementById('canvas-sandbox');
canvas = document.getElementById('canvas-assinatura');
let ctx = canvas ? canvas.getContext('2d') : null;
let desenhando = false;

// ===================== UTILITÁRIOS =====================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => new Date().toISOString().split('T')[0];

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${status}</span>`;
}

function msgForm(id, texto, cor) {
  const el = $(id);
  if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db';
  el.innerText = texto;
  if (cor === 'green') setTimeout(() => { el.innerText = ''; }, 4000);
}

// ===================== COMPRESSÃO E UPLOAD DE FOTO =====================
const FOTO_CONFIG = {
  maxWidth:    1280,   
  maxHeight:   1280,   
  qualidade:   0.78,   
  maxBytes:    800_000 
};

function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        let { width, height } = img;
        const { maxWidth, maxHeight } = FOTO_CONFIG;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Falha ao compactar a imagem.')); return; }
          resolve(blob);
        }, 'image/jpeg', FOTO_CONFIG.qualidade);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadFoto(file, pasta, msgId) {
  if (!file) return null;
  let blob = file;
  if (file.type.startsWith('image/')) {
    try {
      if (msgId) msgForm(msgId, '🗜️ Comprimindo imagem...', 'blue');
      blob = await comprimirImagem(file);
    } catch (err) {
      console.warn('Compressão falhou:', err.message);
      blob = file; 
    }
  }
  const nomeArq = `${pasta}/foto_${Date.now()}.jpg`;
  const { data, error } = await db.storage
    .from('fotos-pmoc')
    .upload(nomeArq, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) return null;
  const { data: { publicUrl } } = db.storage.from('fotos-pmoc').getPublicUrl(nomeArq);
  return publicUrl;
}

// ===================== SESSÃO & ROTEAMENTO =====================
async function verificarSessaoGlobal() {
  const pag = window.location.pathname.split('/').pop();
  const ehPaginaLogin    = (pag === '' || pag === 'index.html');
  const ehPaginaPublica  = (pag === 'verificar.html');

  if (ehPaginaLogin || ehPaginaPublica) {
    if ($('user-display-email')) $('user-display-email').innerText = '';
    return;
  }

  const { data: { user }, error } = await db.auth.getUser();
  if (!user || error) {
    window.location.href = 'index.html';
    return;
  }

  // Carrega perfil da tabela profiles
  const { data: perfil } = await db
    .from('profiles')
    .select('nome, role, status')
    .eq('id', user.id)
    .maybeSingle(); // ← maybeSingle nunca lança erro se não encontrar

  if (!perfil) {
    // Perfil ausente — cria automaticamente como admin e continua
    await db.from('profiles').insert([{
      id:     user.id,
      email:  user.email,
      nome:   user.user_metadata?.full_name || 'Administrador',
      role:   'admin',
      status: 'ativo',
    }]).select().maybeSingle();
    if ($('user-display-email')) $('user-display-email').innerText = user.email;
  } else {
    const exibir = perfil.nome ? `${perfil.nome}` : user.email;
    if ($('user-display-email')) $('user-display-email').innerText = exibir;
  }
}
verificarSessaoGlobal();

if ($('btn-logout')) {
  $('btn-logout').addEventListener('click', async () => {
    if (confirm('Encerrar sessão?')) { await db.auth.signOut(); window.location.href = 'index.html'; }
  });
}

function toggleModoRecuperacao(ativar) {
  modoRecuperacao = ativar;
  if ($('login-title')) $('login-title').innerText = ativar ? 'Recuperação de Acesso' : 'Acesso ao Sistema';
  if ($('login-desc')) $('login-desc').innerText = ativar ? 'Digite seu e-mail para receber o link de redefinição.' : 'Informe suas credenciais para continuar';
  if ($('login-password-group')) $('login-password-group').style.display = ativar ? 'none' : 'flex';
  if ($('link-recuperar')) $('link-recuperar').style.display = ativar ? 'none' : 'inline';
  if ($('link-voltar')) $('link-voltar').style.display = ativar ? 'inline' : 'none';
  if ($('btn-login')) $('btn-login').querySelector('span').nextSibling.textContent = ativar ? ' Enviar Link' : ' Entrar no Sistema';
}

function inicializarCanvasAssinatura() {
  canvas = document.getElementById('canvas-assinatura');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  ctx.lineWidth = 2; ctx.strokeStyle = '#1a202c'; ctx.lineCap = 'round';
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  canvas.addEventListener('mousedown', (e) => { desenhando = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', (e) => { if (!desenhando) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  window.addEventListener('mouseup', () => desenhando = false);
  canvas.addEventListener('touchstart', (e) => { desenhando = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (!desenhando) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }, { passive: false });
  window.addEventListener('touchend', () => desenhando = false);
}
function limparCanvasAssinatura() { if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height); }

function calcularCriticidadeFluxograma() {
  const el = (id) => $(id);
  if (!el('crit-interrupcao')) return 'Média';
  const i = el('crit-interrupcao').value, s = el('crit-seguranca').value;
  const o = el('crit-operacao').value,  r = el('crit-reserva').value;
  const res = (i === 'sim' || s === 'sim')
    ? (r === 'nao' ? 'Alta (A)' : 'Média (B)')
    : (o === 'sim' ? (r === 'nao' ? 'Média (B)' : 'Baixa (C)') : 'Baixa (C)');
  if ($('label-criticidade-calculada')) $('label-criticidade-calculada').innerText = 'Classe ' + res;
  return res.split(' ')[0];
}

const FREQ_HIERARQUIA = { M: ['M'], T: ['M','T'], S: ['M','T','S'], A: ['M','T','S','A'] };
function toggleItemsPorFrequencia() {
  const freq = $('pmoc-frequencia')?.value || 'M';
  const ativas = FREQ_HIERARQUIA[freq] || ['M'];
  [
    { cls: 'freq-item-t', fq: 'T' },
    { cls: 'freq-item-s', fq: 'S' },
    { cls: 'freq-item-a', fq: 'A' },
  ].forEach(({ cls, fq }) => {
    const mostrar = ativas.includes(fq);
    document.querySelectorAll('.' + cls).forEach(el => {
      el.style.display = mostrar ? '' : 'none';
      if (!mostrar) el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    });
  });
}

// ===================== EQUIPAMENTOS =====================
const EQ_CAMPOS_EXTRAS = {
  AC:   ['eq-potencia','eq-ciclo','eq-tensao','eq-gas','eq-instalacao-ac','eq-validade'],
  BEB:  ['eq-cap-beb','eq-tipo-beb','eq-filtro-beb','eq-validade-filtro-beb','eq-lacre-beb','eq-validade-lacre-beb'],
  CLIM: ['eq-vazao-clim','eq-tipo-clim','eq-painel-clim','eq-validade-painel-clim','eq-tensao-clim','eq-consumo-clim'],
  VEN:  ['eq-potencia-ven','eq-tipo-ven','eq-diametro-ven','eq-tensao-ven'],
  OUT:  [],
};
const EQ_CATEGORIA_LABEL = { AC: '❄️ Ar Condicionado', BEB: '💧 Bebedouro', CLIM: '🌀 Climatizador Evaporativo', VEN: '💨 Ventilador/Exaustor', OUT: '🔧 Outros' };

function toggleCamposEquipamento() {
  const cat = $('eq-categoria')?.value || '';
  document.querySelectorAll('.eq-campo-condicional').forEach(el => el.style.display = 'none');
  Object.values(EQ_CAMPOS_EXTRAS).flat().forEach(id => { if ($(id)) $(id).value = ''; });
  if (!cat) return;
  document.querySelectorAll(`.eq-campo-${cat}`).forEach(el => el.style.display = 'block');
  document.querySelectorAll('.eq-campo-localizacao, .eq-campo-criticidade').forEach(el => el.style.display = 'block');
}

if ($('btn-salvar')) {
  $('btn-salvar').addEventListener('click', async () => {
    const tag = $('eq-tag')?.value.trim(); const cat = $('eq-categoria')?.value;
    if (!tag || !cat)  { msgForm('msg-equipamento', 'TAG e Categoria são obrigatórias.', 'red'); return; }
    msgForm('msg-equipamento', 'Salvando...', 'blue');
    const payload = {
      tag, categoria: cat,
      marca: $('eq-marca')?.value.trim()||null, produto: $('eq-produto')?.value.trim()||null,
      nr_serie: $('eq-serie')?.value.trim()||null, patrimonio: $('eq-patrimonio')?.value.trim()||null,
      bloco: $('eq-bloco')?.value.trim()||null, setor: $('eq-setor')?.value.trim()||null,
      sala: $('eq-sala')?.value.trim()||null, instituicao: $('eq-instituicao')?.value.trim()||null,
      criticidade: calcularCriticidadeFluxograma(),
    };
    const extras = {};
    (EQ_CAMPOS_EXTRAS[cat] || []).forEach(id => {
      const el = $(id); if (!el || !el.value.trim()) return;
      extras[id.replace('eq-','')] = el.value.trim();
    });
    if (Object.keys(extras).length) payload.extras_tecnico = extras;
    if ($('eq-potencia')?.value) payload.potencia = $('eq-potencia').value.trim();
    if ($('eq-validade')?.value) payload.validade = $('eq-validade').value.trim();

    const { error } = await db.from('equipamentos').insert([payload]);
    if (error) { msgForm('msg-equipamento', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-equipamento', '✓ Equipamento salvo!', 'green');
    setTimeout(() => location.href = 'gerir-equipamentos.html', 1200);
  });
}

async function carregarEquipamentos() {
  const { data } = await db.from('equipamentos').select('*').order('tag', { ascending: true });
  globalEquipamentos = data || []; filtrarEquipamentos(0); atualizarSelectEquipamentos();
}

function filtrarEquipamentos(delta) {
  paginaAtualEquipamento = Math.max(0, paginaAtualEquipamento + delta);
  const termo = ($('search-eq-termo')?.value || '').toLowerCase();
  const crit = ($('search-eq-criticidade')?.value || '');
  const bloco = ($('search-eq-bloco')?.value || '').toLowerCase();
  let items = globalEquipamentos.filter(e =>
    (!termo || e.tag.toLowerCase().includes(termo) || (e.produto || '').toLowerCase().includes(termo)) &&
    (!crit || (e.criticidade || '') === crit) &&
    (!bloco || (e.bloco || '').toLowerCase().includes(bloco))
  );
  const total = Math.max(1, Math.ceil(items.length / itensPorPagina));
  paginaAtualEquipamento = Math.min(paginaAtualEquipamento, total - 1);
  if ($('txt-eq-paginacao')) $('txt-eq-paginacao').innerText = `Página ${paginaAtualEquipamento + 1} de ${total}`;
  const slice = items.slice(paginaAtualEquipamento * itensPorPagina, (paginaAtualEquipamento + 1) * itensPorPagina);
  const tbody = $('tbody-equipamentos-gerir'); if (!tbody) return;
  if (!slice.length) { tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum ativo encontrado.</td></tr>'; return; }
  tbody.innerHTML = slice.map(eq => {
    const critCls = eq.criticidade === 'Alta' ? 'danger' : eq.criticidade === 'Baixa' ? 'success' : '';
    return `<tr>
      <td><span class="tag-badge">${eq.tag}</span></td>
      <td><strong>${eq.produto || '—'}</strong><br><small style="color:#a0aec0">${eq.marca || ''}</small></td>
      <td>${eq.bloco || '—'} / ${eq.setor || '—'}<br><small style="color:#a0aec0">${eq.sala || ''}</small></td>
      <td><span class="tag-badge ${critCls}">Classe ${eq.criticidade || 'Média'}</span></td>
      <td>${eq.qrcode_token ? `<button class="btn-primary" style="padding:3px 8px;font-size:11px;" onclick="exibirJanelaQRCode('${eq.qrcode_token}','${eq.tag}')">👁️ QR</button>` : '—'}</td>
      <td><button class="btn-primary" style="background:#4a5568;padding:3px 8px;font-size:11px;" onclick="editarEquipamento('${eq.id}')">✍️</button> <button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕</button></td>
    </tr>`;
  }).join('');
}
function mudarPaginaEquipamento(d) { filtrarEquipamentos(d); }
async function excluirEquipamento(id) { if (confirm('Remover ativo?')) { await db.from('equipamentos').delete().eq('id', id); carregarEquipamentos(); } }
function editarEquipamento(id) { location.href = 'equipamentos.html?edit=' + id; }

async function atualizarSelectEquipamentos() {
  const { data } = await db.from('equipamentos').select('id, tag, produto, categoria');
  ['pmoc-equipamento', 'os-equipamento'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Ativo --</option>';
    (data || []).forEach(e => {
      const opt = document.createElement('option'); opt.value = e.id; opt.textContent = `${e.tag} — ${e.produto || ''}`; opt.dataset.categoria = e.categoria || 'OUT'; sel.appendChild(opt);
    });
  });
}

function onEquipamentoSelecionado() {
  const sel = $('pmoc-equipamento'); if (!sel) return;
  const cat = sel.options[sel.selectedIndex]?.dataset?.categoria || '';
  ['AC','BEB','CLIM','VEN','OUT'].forEach(t => { const el = $('checklist-' + t); if (el) { el.style.display = 'none'; el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false); } });
  if (!cat) { if ($('checklist-placeholder')) $('checklist-placeholder').style.display = 'block'; return; }
  if ($('checklist-placeholder')) $('checklist-placeholder').style.display = 'none';
  const alvo = $('checklist-' + cat) || $('checklist-OUT'); if (alvo) alvo.style.display = 'block';
  if ($('pmoc-tipo-badge')) $('pmoc-tipo-badge').style.display = 'block';
  if ($('pmoc-tipo-label')) $('pmoc-tipo-label').textContent = EQ_CATEGORIA_LABEL[cat] || 'Outro';
  toggleItemsPorFrequencia();
}

// ===================== COLABORADORES & FUNÇÕES =====================
async function atualizarSelectColaboradores() {
  const { data } = await db.from('colaboradores').select('id, nome, assinatura_digital');
  ['pmoc-tecnico', 'os-tecnico', 'osg-tecnico'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      opt.dataset.assinatura = c.assinatura_digital || '';
      sel.appendChild(opt);
    });
  });
}
async function atualizarSelectFuncoes() {
  const sel = $('colab-funcao'); if (!sel) return;
  const { data } = await db.from('funcoes').select('id, nome');
  sel.innerHTML = '<option value="">-- Selecione uma Função --</option>';
  (data || []).forEach(f => { sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`; });
}
let _colabCache = [];
async function carregarColaboradores() {
  const tbody = $('tbody-colaboradores'); if (!tbody) return;
  const { data } = await db.from('colaboradores').select('*, funcoes(nome)').order('nome', { ascending: true });
  _colabCache = data || [];
  tbody.innerHTML = _colabCache.length ? _colabCache.map(c => {
    const temAssinatura = c.assinatura_digital && c.assinatura_digital.startsWith('data:image');
    const badgeAssinatura = temAssinatura
      ? `<span class="tag-badge success" style="font-size:10px;">✓ Cadastrada</span>`
      : `<span class="tag-badge" style="font-size:10px;color:#a0aec0;">— Sem assinatura</span>`;
    return `<tr>
      <td><strong>${c.nome}</strong></td>
      <td>${c.cpf ? c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : '—'}</td>
      <td>${c.funcoes?.nome || '—'}</td>
      <td>${c.data_contratacao ? fmtDate(c.data_contratacao) : '—'}</td>
      <td>${badgeAssinatura}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarColaborador('${c.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="td-loading">Sem registros.</td></tr>';
}

async function excluirColaborador(id) { if (confirm('Remover colaborador?')) { await db.from('colaboradores').delete().eq('id', id); carregarColaboradores(); } }

async function carregarFuncoes() {
  const tbody = $('tbody-funcoes'); if (!tbody) return;
  const { data: funcoes } = await db.from('funcoes').select('*').order('nome', { ascending: true });
  const { data: colabs } = await db.from('colaboradores').select('funcao_id');
  const countMap = {};
  (colabs||[]).forEach(c => { if(c.funcao_id) countMap[c.funcao_id] = (countMap[c.funcao_id]||0)+1; });
  const nivelCor = { Junior:'#dbeafe', Pleno:'#d1fae5', Senior:'#fef3c7' };
  tbody.innerHTML = (funcoes || []).length ? funcoes.map(f => {
    const nivel = f.nivel || 'Pleno';
    const cor = nivelCor[nivel] || '#f3f4f6';
    return `<tr>
      <td><strong>${f.nome}</strong></td>
      <td><span style="background:${cor};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">${nivel}</span></td>
      <td>R$ ${Number(f.salario || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
      <td style="text-align:center;"><span class="tag-badge">${countMap[f.id]||0}</span></td>
      <td><button class="btn-excluir" onclick="excluirFuncao('${f.id}')">✕</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="td-loading">Sem registros.</td></tr>';
}
async function excluirFuncao(id) { if (confirm('Remover função?')) { await db.from('funcoes').delete().eq('id', id); carregarFuncoes(); } }

if ($('btn-salvar-colaborador')) {
  $('btn-salvar-colaborador').addEventListener('click', async () => {
    const nome = $('colab-nome')?.value.trim();
    const cpf  = $('colab-cpf')?.value.trim();
    if (!nome || !cpf || !validarCPF(cpf)) { msgForm('msg-colaborador', 'Verifique o nome e o CPF informado.', 'red'); return; }

    msgForm('msg-colaborador', 'Salvando...', 'blue');

    // Captura assinatura do canvas (se houver traço)
    let assinatura_digital = null;
    const canvasColab = document.getElementById('canvas-colab-assinatura');
    const ctxColab    = canvasColab ? canvasColab.getContext('2d') : null;
    if (ctxColab && canvasColab && canvasColab.style.display !== 'none') {
      const idat = ctxColab.getImageData(0, 0, canvasColab.width, canvasColab.height);
      if (idat.data.some((v, i) => i % 4 === 3 && v > 0)) {
        assinatura_digital = canvasColab.toDataURL('image/png');
      }
    }
    // Se estava editando e havia assinatura anterior preservada (canvas oculto)
    if (!assinatura_digital && canvasColab && canvasColab.style.display === 'none') {
      const idEd = $('colab-id-edicao')?.value;
      const cached = (typeof _colabCache !== 'undefined' ? _colabCache : []).find(x => x.id === idEd);
      if (cached?.assinatura_digital) assinatura_digital = cached.assinatura_digital;
    }

    const payload = {
      nome,
      cpf: cpf.replace(/\D/g, ''),
      funcao_id: $('colab-funcao')?.value || null,
      data_contratacao: $('colab-contratacao')?.value || null,
      assinatura_digital,
    };

    const idEd = $('colab-id-edicao')?.value;
    const { error } = idEd
      ? await db.from('colaboradores').update(payload).eq('id', idEd)
      : await db.from('colaboradores').insert([payload]);

    if (error) { msgForm('msg-colaborador', 'Erro: ' + error.message, 'red'); return; }

    msgForm('msg-colaborador', idEd ? '✓ Colaborador atualizado!' : '✓ Colaborador registrado!', 'green');
    carregarColaboradores();
    atualizarSelectColaboradores();
    // Reseta form via função do HTML (se disponível) ou inline
    if (typeof resetarFormColaborador === 'function') resetarFormColaborador();
    else { $('colab-nome').value = ''; $('colab-cpf').value = ''; }
  });
}
if ($('btn-salvar-funcao')) {
  $('btn-salvar-funcao').addEventListener('click', async () => {
    const nome = $('func-nome')?.value.trim(); if (!nome) return;
    const { error } = await db.from('funcoes').insert([{ nome, salario: parseFloat($('func-salario')?.value) || 0, nivel: $('func-nivel')?.value || 'Pleno' }]);
    if (!error) { msgForm('msg-funcao', '✓ Salva!', 'green'); carregarFuncoes(); atualizarSelectFuncoes(); $('func-nome').value = ''; }
  });
}

// ===================== FORMULÁRIO PMOC =====================
if ($('btn-salvar-ficha')) {
  $('btn-salvar-ficha').addEventListener('click', async () => {
    const equipamento_id = $('pmoc-equipamento')?.value; const tecnico_id = $('pmoc-tecnico')?.value;
    const fiscal_nome = $('pmoc-fiscal-nome')?.value.trim();
    if (!equipamento_id || !tecnico_id) { msgForm('msg-ficha', 'Preencha os campos obrigatórios.', 'red'); return; }
    if (!fiscal_nome) { msgForm('msg-ficha', 'Informe o nome do fiscal validador.', 'red'); return; }
    msgForm('msg-ficha', 'Salvando...', 'blue');
    const freq = $('pmoc-frequencia')?.value || 'M'; const dataInsp = $('pmoc-data')?.value || hoje();
    const cat = $('pmoc-equipamento').options[$('pmoc-equipamento').selectedIndex]?.dataset?.categoria || 'OUT';
    
    const checklistResult = {};
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]:checked').forEach(r => { checklistResult[r.name] = r.value; });

    let assinaturaBase64 = null; 
    if (canvas && ctx) { 
      const idat = ctx.getImageData(0, 0, canvas.width, canvas.height); 
      if (idat.data.some((v, i) => i % 4 === 3 && v > 0)) {
        // Correção de codificação de string para renderização em laudo nativo
        assinaturaBase64 = canvas.toDataURL('image/png'); 
      }
    }
    
    const obsCompleto = `[DataInspecao: ${dataInsp}]\n[Frequencia: ${freq === 'M' ? 'Mensal' : freq === 'T' ? 'Trimestral' : freq === 'S' ? 'Semestral' : 'Anual'}]\n[TipoEquipamento: ${cat}]\n[Checklist: ${JSON.stringify(checklistResult)}]\n[FiscalNome: ${fiscal_nome}]\n${$('pmoc-obs')?.value.trim() || ''}`;
    const foto_url = await uploadFoto($('pmoc-foto')?.files[0], 'pmoc', 'msg-ficha');
    const { data: colab } = await db.from('colaboradores').select('nome, assinatura_digital').eq('id', tecnico_id).single();
    const { data: { user } } = await db.auth.getUser();

    // Usa assinatura cadastrada do técnico; se não houver, usa o canvas do fiscal (fallback)
    const assinaturaTecnico = colab?.assinatura_digital || null;
    // Assinatura do fiscal (canvas desenhado no momento)
    const assinaturaFiscal  = assinaturaBase64 || null;

    const payload = { equipamento_id, tecnico_nome: colab?.nome || 'Técnico', observacoes: obsCompleto, user_id: user?.id };
    if (foto_url) payload.foto_url = foto_url;
    if (assinaturaTecnico) payload.assinatura_digital = assinaturaTecnico;
    if (assinaturaFiscal)  payload.assinatura_fiscal  = assinaturaFiscal;

    const idEdicao = $('pmoc-id-edicao')?.value;
    const { error } = idEdicao
      ? await db.from('fichas_pmoc').update(payload).eq('id', idEdicao)
      : await db.from('fichas_pmoc').insert([payload]);
    if (error) { msgForm('msg-ficha', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-ficha', idEdicao ? '✓ Ficha atualizada!' : '✓ PMOC salvo!', 'green');
    limparCanvasAssinatura(); if ($('pmoc-obs')) $('pmoc-obs').value = ''; if ($('pmoc-fiscal-nome')) $('pmoc-fiscal-nome').value = '';
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]').forEach(r => r.checked = false);
    resetarFormPMOC();
    carregarHistoricoFichas(); alternarSubAbasPMOC('hist');
  });
}

let _fichasCache = [];
async function carregarHistoricoFichas() {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  const { data } = await db.from('fichas_pmoc').select('*, equipamentos(tag, marca, potencia, nr_serie, patrimonio, produto, bloco, setor, sala, categoria)').order('created_at', { ascending: false });
  _fichasCache = data || []; renderHistoricoFichas(_fichasCache);
}
function filtrarHistoricoFichas() {
  const tag = ($('filtro-hist-tag')?.value || '').toLowerCase(); const tipo = $('filtro-hist-tipo')?.value || ''; const freq = $('filtro-hist-freq')?.value || '';
  renderHistoricoFichas(_fichasCache.filter(f => (f.equipamentos?.tag || '').toLowerCase().includes(tag) && (!tipo || (f.observacoes || '').includes(`[TipoEquipamento: ${tipo}]`)) && (!freq || (f.observacoes || '').includes(`[Frequencia: ${freq}]`))));
}
function renderHistoricoFichas(data) {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Sem registros.</td></tr>'; return; }
  tbody.innerHTML = data.map(f => {
    const matchFreq = f.observacoes?.match(/\[Frequencia:\s*([^\]]+)\]/); const freq = matchFreq ? matchFreq[1] : 'Mensal';
    const matchTipo = f.observacoes?.match(/\[TipoEquipamento:\s*([^\]]+)\]/); const tipo = matchTipo ? matchTipo[1] : 'OUT';
    return `<tr>
      <td><strong>L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}</strong></td>
      <td>${fmtDate(f.created_at)}</td>
      <td><span class="tag-badge">${f.equipamentos?.tag || '—'}</span></td>
      <td><small>${tipo}</small></td>
      <td>${f.tecnico_nome}</td>
      <td><span class="tag-badge">${freq}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="emitirRelatorioPMOC('${btoa(unescape(encodeURIComponent(JSON.stringify(f))))}')">🖨️ Emitir</button>
        <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="editarFichaPMOC('${f.id}')">✏️ Editar</button>
        <button class="btn-excluir" style="padding:4px 10px;font-size:11px;" onclick="excluirFichaPMOC('${f.id}')">✕ Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

// ===================== IMPRESSÃO PMOC & OS =====================
function emitirRelatorioPMOC(b64) {
  const f  = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const eq = f.equipamentos || {};

  // Extrai metadados das observações
  const matchData  = (f.observacoes || '').match(/\[DataInspecao:\s*([^\]]+)\]/);
  const matchFreq  = (f.observacoes || '').match(/\[Frequencia:\s*([^\]]+)\]/);
  const matchTipo  = (f.observacoes || '').match(/\[TipoEquipamento:\s*([^\]]+)\]/);
  const matchChk   = (f.observacoes || '').match(/\[Checklist:\s*([^\]]+)\]/);
  const matchFiscal = (f.observacoes || '').match(/\[FiscalNome:\s*([^\]]+)\]/);
  const obsLimpa   = (f.observacoes || '').replace(/\[[^\]]+\]/g, '').trim();
  const checklist  = matchChk ? (() => { try { return JSON.parse(matchChk[1]); } catch(e) { return {}; } })() : {};
  const dataInsp   = matchData ? matchData[1] : fmtDate(f.created_at);
  const freq       = matchFreq ? matchFreq[1] : '—';
  const tipo       = matchTipo ? matchTipo[1] : '—';
  const fiscalNome = matchFiscal ? matchFiscal[1].trim() : 'Fiscal Responsável';

  // Checklist formatado
  const labelChk = {
    'limpeza-filtro':'Limpeza de Filtro','limpeza-evaporadora':'Limpeza Evaporadora','limpeza-condensadora':'Limpeza Condensadora',
    'verificacao-dreno':'Verificação de Dreno','verificacao-eletrica':'Verificação Elétrica','verificacao-fluido':'Verificação de Fluido',
    'teste-operacao':'Teste de Operação','verificacao-ruidos':'Verificação de Ruídos','limpeza-geral':'Limpeza Geral',
  };
  const statusChk = { 'OK':'<span class="ok">✓ OK</span>', 'NOK':'<span class="nok">✗ NOK</span>', 'NA':'<span class="na">N/A</span>' };
  const chkRows = Object.entries(checklist).map(([k,v]) =>
    `<tr><td>${labelChk[k] || k}</td><td style="text-align:center;">${statusChk[v] || v}</td></tr>`
  ).join('');

  const assinaturaTecnicoHTML = (f.assinatura_digital && f.assinatura_digital.includes('data:image'))
    ? `<img src="${f.assinatura_digital}" style="max-width:200px;max-height:65px;display:block;margin:0 auto 4px;" alt="Assinatura Técnico"/>`
    : `<div style="height:55px;border-bottom:1px dashed #94a3b8;margin-bottom:4px;"></div>`;

  const assinaturaFiscalHTML = (f.assinatura_fiscal && f.assinatura_fiscal.includes('data:image'))
    ? `<img src="${f.assinatura_fiscal}" style="max-width:200px;max-height:65px;display:block;margin:0 auto 4px;" alt="Assinatura Fiscal"/>`
    : `<div style="height:55px;border-bottom:1px dashed #94a3b8;margin-bottom:4px;"></div>`;

  const urlValidacao  = gerarUrlValidacao(f.id, 'pmoc');
  const qrCodeHTML    = gerarQrCodeSVG(urlValidacao, 100);
  const codigoLaudo   = `L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}`;

  const fotoHTML = f.foto_url
    ? `<div class="laudo-section"><div class="laudo-section-title">Evidência Fotográfica</div><img src="${f.foto_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;"></div>`
    : '';

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div>
        <h1>🏗️ PMOC — CONCREDUR</h1>
        <p>Plano de Manutenção, Operação e Controle</p>
      </div>
      <div class="laudo-header-meta">
        <strong>Código: L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}</strong><br>
        Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}<br>
        Frequência: ${freq}
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">Identificação do Ativo</div>
      <div class="laudo-grid-3">
        <div class="laudo-field"><label>TAG</label><span>${eq.tag || '—'}</span></div>
        <div class="laudo-field"><label>Equipamento</label><span>${eq.produto || tipo}</span></div>
        <div class="laudo-field"><label>Marca</label><span>${eq.marca || '—'}</span></div>
        <div class="laudo-field"><label>Potência</label><span>${eq.potencia || '—'}</span></div>
        <div class="laudo-field"><label>Nº Série</label><span>${eq.nr_serie || '—'}</span></div>
        <div class="laudo-field"><label>Patrimônio</label><span>${eq.patrimonio || '—'}</span></div>
        <div class="laudo-field"><label>Bloco</label><span>${eq.bloco || '—'}</span></div>
        <div class="laudo-field"><label>Setor</label><span>${eq.setor || '—'}</span></div>
        <div class="laudo-field"><label>Sala</label><span>${eq.sala || '—'}</span></div>
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">Dados da Inspeção</div>
      <div class="laudo-grid">
        <div class="laudo-field"><label>Técnico Responsável</label><span>${f.tecnico_nome}</span></div>
        <div class="laudo-field"><label>Data da Inspeção</label><span>${dataInsp}</span></div>
      </div>
    </div>

    ${chkRows ? `
    <div class="laudo-section">
      <div class="laudo-section-title">Checklist de Manutenção</div>
      <table class="laudo-checklist-table">
        <thead><tr><th>Item Verificado</th><th style="text-align:center;width:80px;">Status</th></tr></thead>
        <tbody>${chkRows}</tbody>
      </table>
    </div>` : ''}

    ${obsLimpa ? `
    <div class="laudo-section">
      <div class="laudo-section-title">Observações Técnicas</div>
      <p style="font-size:12px;line-height:1.6;">${obsLimpa}</p>
    </div>` : ''}

    ${fotoHTML}

    <div class="laudo-section">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap;">

        <!-- Assinaturas -->
        <div style="display:flex; gap:32px; align-items:flex-end; flex:1;">
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaTecnicoHTML}
            <div class="laudo-assinatura-linha">${f.tecnico_nome}<br>Técnico Executor</div>
          </div>
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaFiscalHTML}
            <div class="laudo-assinatura-linha">${fiscalNome}<br>Fiscal / Validador do Serviço</div>
          </div>
        </div>

        <!-- QR Code de Validação -->
        <div style="text-align:center; flex-shrink:0;">
          ${qrCodeHTML}
          <div style="font-size:9px; color:#718096; margin-top:5px; font-weight:600;">AUTENTICIDADE DO DOCUMENTO</div>
          <div style="font-size:8px; color:#a0aec0; margin-top:2px;">${codigoLaudo}</div>
          <div style="font-size:8px; color:#a0aec0;">Aponte a câmera para verificar</div>
        </div>

      </div>
      <div style="margin-top:14px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:9px; color:#a0aec0;">
        Documento gerado pelo Sistema Concredur · ${new Date().toLocaleString('pt-BR')} · Verificação: ${urlValidacao}
      </div>
    </div>
  </div>`;

  imprimir('area-laudo-impressao', html);
}

function emitirRelatorioOS(os) {
  const eq  = os.equipamentos  || {};
  const col = os.colaboradores || {};

  const urlValidacao = gerarUrlValidacao(os.id, 'os');
  const qrCodeHTML   = gerarQrCodeSVG(urlValidacao, 100);
  const codigoOS     = `OS-AC-${os.id.toString().slice(0,5).toUpperCase()}`;

  // Assinatura do técnico (vinda do cadastro de colaboradores via JOIN)
  const assinaturaTecnicoHTML = (col.assinatura_digital && col.assinatura_digital.includes('data:image'))
    ? `<img src="${col.assinatura_digital}" style="max-width:200px;max-height:65px;display:block;margin:0 auto 4px;" alt="Assinatura Técnico"/>`
    : `<div style="height:55px;border-bottom:1px dashed #94a3b8;margin-bottom:4px;"></div>`;

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div>
        <h1>🛠️ Ordem de Serviço — CONCREDUR</h1>
        <p>Registro Técnico de Manutenção</p>
      </div>
      <div class="laudo-header-meta">
        <strong>Código: ${codigoOS}</strong><br>
        Abertura: ${fmtDate(os.created_at)}<br>
        Emissão: ${new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">Ativo / Equipamento</div>
      <div class="laudo-grid">
        <div class="laudo-field"><label>TAG</label><span>${eq.tag || '—'}</span></div>
        <div class="laudo-field"><label>Equipamento</label><span>${eq.produto || '—'}</span></div>
        <div class="laudo-field"><label>Localização</label><span>${eq.bloco || '—'} ${eq.setor ? '— ' + eq.setor : ''}</span></div>
        <div class="laudo-field"><label>Nº Série</label><span>${eq.nr_serie || '—'}</span></div>
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">Dados da Ordem</div>
      <div class="laudo-grid-3">
        <div class="laudo-field"><label>Técnico</label><span>${col.nome || '—'}</span></div>
        <div class="laudo-field"><label>Tipo</label><span>${os.tipo_os || '—'}</span></div>
        <div class="laudo-field"><label>Status</label><span>${os.status_os || '—'}</span></div>
      </div>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">Descrição da Ocorrência / Sintomas</div>
      <p style="font-size:12px;line-height:1.7;min-height:50px;">${os.descricao_defeito || 'Não informado.'}</p>
    </div>

    <div class="laudo-section">
      <div class="laudo-section-title">Diagnóstico Técnico / Ações Executadas</div>
      <p style="font-size:12px;line-height:1.7;min-height:60px;">${os.laudo_tecnico || 'Não informado.'}</p>
    </div>

    ${os.foto_url ? `<div class="laudo-section"><div class="laudo-section-title">Evidência Fotográfica</div><img src="${os.foto_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;"></div>` : ''}

    <div class="laudo-section">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap;">

        <!-- Assinatura do Técnico -->
        <div style="flex:1;">
          <div class="laudo-assinatura-box" style="min-width:200px; text-align:center;">
            ${assinaturaTecnicoHTML}
            <div class="laudo-assinatura-linha">${col.nome || 'Técnico Responsável'}<br>Técnico Executor</div>
          </div>
        </div>

        <!-- QR Code de Validação -->
        <div style="text-align:center; flex-shrink:0;">
          ${qrCodeHTML}
          <div style="font-size:9px; color:#718096; margin-top:5px; font-weight:600;">AUTENTICIDADE DO DOCUMENTO</div>
          <div style="font-size:8px; color:#a0aec0; margin-top:2px;">${codigoOS}</div>
          <div style="font-size:8px; color:#a0aec0;">Aponte a câmera para verificar</div>
        </div>

      </div>
      <div style="margin-top:14px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:9px; color:#a0aec0;">
        Sistema Concredur · ${new Date().toLocaleString('pt-BR')} · Verificação: ${urlValidacao}
      </div>
    </div>
  </div>`;

  imprimir('area-os-impressao', html);
}

// ===================== ORDENS DE SERVIÇO =====================
if ($('btn-salvar-os')) {
  $('btn-salvar-os').addEventListener('click', async () => {
    const payload = { equipamento_id: $('os-equipamento').value, colaborador_id: $('os-tecnico').value, tipo_os: $('os-tipo').value, status_os: $('os-status').value, descricao_defeito: $('os-defeito').value.trim(), laudo_tecnico: $('os-laudo').value.trim() };
    const idEd = $('os-id-edicao').value;
    const { error } = idEd ? await db.from('ordens_servico').update(payload).eq('id', idEd) : await db.from('ordens_servico').insert([payload]);
    if (!error) { resetarFormOS(); carregarOrdensServico(); carregarCentralUnificadaOS(); }
  });
}
async function carregarOrdensServico() {
  const tbody = $('tbody-os'); if (!tbody) return;
  const { data } = await db.from('ordens_servico').select('*, equipamentos(tag, produto, bloco, setor, nr_serie), colaboradores(nome, assinatura_digital)').order('created_at', { ascending: false });
  tbody.innerHTML = (data || []).map(os => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `<tr>
    <td><strong>OS-AC-${os.id.toString().slice(0,5).toUpperCase()}</strong></td>
    <td>${fmtDate(os.created_at)}</td>
    <td><span class="tag-badge">${os.equipamentos?.tag || '—'}</span></td>
    <td>${os.colaboradores?.nome || '—'}</td>
    <td>${os.tipo_os}</td>
    <td>${statusBadge(os.status_os)}</td>
    <td style="display:flex;gap:4px;flex-wrap:wrap;">
      <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="emitirRelatorioOS(JSON.parse(decodeURIComponent(escape(atob('${b64}')))))">🖨️ Imprimir</button>
      <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="editarOS('${os.id}','${os.equipamento_id || ''}','${os.colaborador_id || ''}','${os.tipo_os}','${os.status_os}',\`${(os.descricao_defeito||'').replace(/\`/g,'')}\`,\`${(os.laudo_tecnico||'').replace(/\`/g,'')}\`)">✏️ Editar</button>
      <button class="btn-excluir" style="padding:4px 10px;font-size:11px;" onclick="excluirOS('${os.id}')">✕ Excluir</button>
    </td>
  </tr>`;}).join('');
}

// ===================== FACILITIES =====================
if ($('btn-salvar-osg')) {
  $('btn-salvar-osg').addEventListener('click', async () => {
    const payload = { setor: $('osg-setor').value, servico_requisitado: $('osg-requisitado').value, falha_relatada: $('osg-falha').value, status_os: $('osg-status').value };
    const { error } = await db.from('ordens_servico_geral').insert([payload]);
    if (!error) { resetarFormOSG(); carregarOSGeral(); carregarCentralUnificadaOS(); }
  });
}
async function carregarOSGeral() {
  const tbody = $('tbody-osg'); if (!tbody) return;
  const { data } = await db.from('ordens_servico_geral').select('*').order('created_at', { ascending: false });
  tbody.innerHTML = (data || []).map(os => `<tr>
    <td><strong>${os.numero_os || 'OSG'}</strong></td>
    <td>${fmtDate(os.created_at)}</td>
    <td>${os.setor || '—'}</td>
    <td>${statusBadge(os.status_os)}</td>
    <td style="display:flex;gap:4px;flex-wrap:wrap;">
      <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="editarOSG('${os.id}','${(os.setor||'').replace(/'/g,'')}','${(os.servico_requisitado||'').replace(/'/g,'')}','${os.status_os}')">✏️ Editar</button>
      <button class="btn-excluir" style="padding:4px 10px;font-size:11px;" onclick="excluirOSG('${os.id}')">✕ Excluir</button>
    </td>
  </tr>`).join('');
}

async function carregarCentralUnificadaOS() {
  const tbody = $('tbody-central-unificada-os'); if (!tbody) return;
  const { data: ac } = await db.from('ordens_servico').select('id,created_at,tipo_os,status_os,descricao_defeito').limit(20);
  const { data: g } = await db.from('ordens_servico_geral').select('id,created_at,tipo_manutencao,status_os,servico_requisitado,numero_os').limit(20);
  const linhas = [...(ac || []).map(d => ({ id:'OS-AC-'+d.id.toString().slice(0,5).toUpperCase(), data:d.created_at, mod:'Refrigeração', cat:d.tipo_os, st:d.status_os })), ...(g || []).map(d => ({ id:d.numero_os||'OSG', data:d.created_at, mod:'Facilities', cat:d.tipo_manutencao, st:d.status_os }))].sort((a,b) => new Date(b.data) - new Date(a.data));
  tbody.innerHTML = linhas.map(l => `<tr><td><strong>${l.id}</strong></td><td>${fmtDate(l.data)}</td><td>${l.mod}</td><td>${l.cat || '—'}</td><td>${statusBadge(l.st)}</td></tr>`).join('');
}

// ===================== GESTÃO DE USUÁRIOS (ROTA MÓVEL WHATSAPP) =====================
if ($('btn-admin-salvar-usuario')) {
  $('btn-admin-salvar-usuario').addEventListener('click', async () => {
    const email = $('adm-user-email')?.value.trim(); const cpf = $('adm-user-cpf')?.value.trim();
    const role = $('adm-user-role')?.value; const nome = $('adm-user-nome')?.value.trim();
    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'none';
    if (!email || !nome || !cpf || !validarCPF(cpf)) { msgForm('msg-admin-usuario', 'Campos obrigatórios inválidos.', 'red'); return; }
    msgForm('msg-admin-usuario', 'Inserindo credenciais no banco público...', 'blue');

    const novoId = crypto.randomUUID();
    const { error } = await db.from('profiles').insert([{ id: novoId, email, nome, role, cpf: cpf.replace(/\D/g, ''), status: 'pendente' }]);
    if (error) { msgForm('msg-admin-usuario', 'Erro: ' + error.message, 'red'); return; }

    const tokenWhatsApp = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar_direto`;
    if ($('adm-link-gerado')) $('adm-link-gerado').value = tokenWhatsApp;
    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'block';

    msgForm('msg-admin-usuario', '✓ Pré-cadastro efetuado com sucesso!', 'green');
    $('adm-user-email').value = ''; $('adm-user-cpf').value = ''; $('adm-user-nome').value = '';
    carregarUsuariosSistema();
  });
}

async function carregarUsuariosSistema() {
  const tbody = $('tbody-usuarios-sistema'); if (!tbody) return;
  const { data: { user: userAtual } } = await db.auth.getUser();
  const { data: perfis, error } = await db.from('profiles').select('*').order('email', { ascending: true });

  let lista = perfis || [];
  const adminNaLista = lista.some(u => u.email === userAtual?.email);
  if (userAtual?.email && !adminNaLista) {
    lista = [{ id: userAtual.id, email: userAtual.email, role: 'admin', nome: 'Administrador', cpf: null, status: 'ativo', _isCurrentUser: true }, ...lista];
  } else if (userAtual?.email) {
    lista = lista.map(u => u.email === userAtual.email ? { ...u, _isCurrentUser: true } : u);
  }

  const roleBadge = { admin: '<span class="tag-badge danger">🛡️ Admin</span>', master: '<span class="tag-badge warning">👨‍💻 Master</span>', tecnico: '<span class="tag-badge">🔬 Técnico</span>', auditor: '<span class="tag-badge" style="background:#f3e8ff;color:#7c3aed;">👁️ Auditor</span>' };
  const statusBadgeUser = { ativo: '<span class="tag-badge success">● Ativo</span>', pendente: '<span class="tag-badge warning">⏳ Aguardando</span>' };

  tbody.innerHTML = lista.map(u => {
    const isVoce = !!u._isCurrentUser;
    return `<tr${isVoce ? ' style="background:#f0f7ff;"' : ''}>
      <td><strong>${u.nome || u.email}</strong>${isVoce ? '<span class="tag-badge" style="background:#dbeafe;color:#1e40af;margin-left:6px;font-size:10px;">Você</span>' : ''}<br><small style="color:#a0aec0;">${u.email}</small></td>
      <td>${u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
      <td>${roleBadge[u.role] || `<span>${u.role || '—'}</span>`}</td>
      <td>${statusBadgeUser[u.status] || statusBadgeUser['ativo']}</td>
      <td>${isVoce ? '—' : `<button class="btn-excluir" onclick="excluirPerfil('${u.id}','${u.email}')">✕ Revogar</button> ${u.status === 'pendente' ? `<button class="btn-primary" style="padding:3px 8px;font-size:11px;margin-left:4px;background:#d97706;border-color:#d97706;" onclick="reenviarConvite('${u.email}')">↺ Link</button>` : ''}`}</td>
    </tr>`;
  }).join('');
}

async function excluirPerfil(id, email) {
  if (confirm(`Revogar acesso de "${email}"?`)) { await db.from('profiles').delete().eq('id', id); carregarUsuariosSistema(); }
}
function reenviarConvite(email) {
  if ($('wrapper-link-ativacao') && $('adm-link-gerado')) {
    $('adm-link-gerado').value = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar_direto`;
    $('wrapper-link-ativacao').style.display = 'block'; $('wrapper-link-ativacao').scrollIntoView({ behavior: 'smooth' });
  }
}

// ===================== VALIDAÇÃO CPF =====================
function validarCPF(cpf) {
  const s = cpf.replace(/\D/g, ''); if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  let soma = 0; for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0; if (r !== parseInt(s[9])) return false;
  soma = 0; for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0; return r === parseInt(s[10]);
}

// ===================== CONTROLLERS & ENGINE IMPRESSÃO =====================
function alternarSubAbasPMOC(m) { if($('sub-pmoc-form'))$('sub-pmoc-form').style.display=m==='form'?'block':'none'; if($('sub-pmoc-historico'))$('sub-pmoc-historico').style.display=m==='hist'?'block':'none'; if(m==='hist')carregarHistoricoFichas(); }
function alternarSubAbasOS(m) { if($('sub-os-ac'))$('sub-os-ac').style.display=m==='ac'?'block':'none'; if($('sub-os-fac'))$('sub-os-fac').style.display=m==='fac'?'block':'none'; if($('sub-os-central'))$('sub-os-central').style.display=m==='central'?'block':'none'; if(m==='central')carregarCentralUnificadaOS(); }
function alternarSubAbasRH(m) { if($('sub-rh-usuarios'))$('sub-rh-usuarios').style.display=m==='usuarios'?'block':'none'; if($('sub-rh-colab'))$('sub-rh-colab').style.display=m==='colab'?'block':'none'; if($('sub-rh-cargo'))$('sub-rh-cargo').style.display=m==='cargo'?'block':'none'; }
function resetarFormOS() { ['os-defeito','os-laudo','os-id-edicao'].forEach(id => { if($(id)) $(id).value=''; }); }
function resetarFormOSG() { ['osg-setor','osg-requisitado','osg-falha'].forEach(id => { if($(id)) $(id).value=''; }); }

function gerarQrCodeSVG(texto, tamanho = 120) {
  // QR Code gerado via API pública — sem dependência extra no bundle
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${tamanho}x${tamanho}&data=${encodeURIComponent(texto)}&format=svg&margin=4`;
  return `<img src="${url}" width="${tamanho}" height="${tamanho}" alt="QR Code de Validação" style="display:block;border:1px solid #e2e8f0;border-radius:4px;background:#fff;">`;
}

function gerarUrlValidacao(id, tipo) {
  const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
  return `${base}/verificar.html?id=${id}&tipo=${tipo}`;
}

function imprimir(areaId, html) {
  // Abre uma janela limpa exclusiva para impressão
  // Elimina interferência do layout da aplicação (sidebar, topbar, etc.)
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Permita pop-ups para este site para imprimir os laudos.');
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concredur — Impressão</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { margin: 14mm; size: A4 portrait; }
    html, body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1a202c; background: #fff; }

    /* ===== LAUDO ===== */
    .laudo-wrapper { width: 100%; }
    .laudo-header { background: #1a56db; color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 6px 6px 0 0; }
    .laudo-header h1 { font-size: 18px; font-weight: 700; }
    .laudo-header p  { font-size: 11px; margin-top: 4px; opacity: 0.85; }
    .laudo-header-meta { text-align: right; font-size: 11px; }
    .laudo-section { border: 1px solid #e2e8f0; border-top: none; padding: 12px 16px; break-inside: avoid; }
    .laudo-section:last-child { border-radius: 0 0 6px 6px; }
    .laudo-section-title { font-size: 10px; font-weight: 700; color: #1a56db; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .laudo-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .laudo-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 16px; }
    .laudo-field  { margin-bottom: 4px; }
    .laudo-field label { font-size: 9px; color: #718096; text-transform: uppercase; letter-spacing: 0.06em; display: block; }
    .laudo-field span  { font-size: 12px; font-weight: 600; color: #1a202c; }
    .laudo-checklist-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
    .laudo-checklist-table th { background: #1a56db; color: #fff; padding: 5px 8px; text-align: left; font-size: 10px; }
    .laudo-checklist-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
    .laudo-checklist-table tr:nth-child(even) td { background: #f8fafc; }
    .ok  { color: #059669; font-weight: 700; }
    .nok { color: #dc2626; font-weight: 700; }
    .na  { color: #a0aec0; }
    .laudo-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .laudo-assinatura-box { text-align: center; min-width: 180px; }
    .laudo-assinatura-linha { border-top: 1px solid #1a202c; margin-top: 8px; padding-top: 4px; font-size: 10px; color: #4a5568; }
    img { max-width: 100%; height: auto; display: block; }
    .tag-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #e2e8f0; color: #2d3748; }
    .tag-badge.success { background: #d1fae5; color: #065f46; }
    .tag-badge.warning { background: #fef3c7; color: #92400e; }
    .tag-badge.danger  { background: #fee2e2; color: #991b1b; }
    .tag-badge.andamento { background: #dbeafe; color: #1e40af; }
  </style>
</head>
<body>
  ${html}
  <script>
    // Aguarda fontes e imagens carregarem antes de imprimir
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
        window.addEventListener('afterprint', function() { window.close(); });
      }, 400);
    });
  </script>
</body>
</html>`);
  win.document.close();
}

// ===================== MÓDULO DE LOGIN (index.html) =====================
// Toda a lógica fica aqui — não depende de script inline no index.html
if ($('btn-login')) {
  const paramsUrl = new URLSearchParams(window.location.search);
  let fluxoAtivacaoDireta = false;
  let emailAlvoAtivacao = "";

  (async () => {
    if (!paramsUrl.get('token')) {
      try { await db.auth.signOut(); } catch(e) {}
    }
    if (paramsUrl.get('email') && paramsUrl.get('token') === 'ativar_direto') {
      fluxoAtivacaoDireta = true;
      emailAlvoAtivacao = decodeURIComponent(paramsUrl.get('email'));
      if ($('email')) { $('email').value = emailAlvoAtivacao; $('email').readOnly = true; }
      if ($('login-password-group')) $('login-password-group').style.display = 'flex';
      if ($('link-recuperar')) $('link-recuperar').style.display = 'none';
      if ($('link-voltar')) $('link-voltar').style.display = 'inline';
      if ($('login-title')) $('login-title').innerText = "Criar Senha de Acesso";
      if ($('login-desc')) $('login-desc').innerText = "Defina sua senha definitiva abaixo para ativar a sua conta instantaneamente.";
      if ($('lbl-password')) $('lbl-password').innerText = "Nova Senha Definitiva";
      if ($('btn-login')) $('btn-login').innerHTML = "<span>✓</span> Ativar e Entrar";
    }
  })();

  $('btn-login').addEventListener('click', async () => {
    const email    = $('email')?.value.trim();
    const password = $('password')?.value;
    if (!email) { alert("Por favor, preencha o campo de e-mail."); return; }

    if (fluxoAtivacaoDireta) {
      if (!password || password.length < 6) { alert("A nova senha precisa conter no mínimo 6 dígitos."); return; }
      msgForm('mensagem', 'Autenticando canal de segurança silencioso...', 'blue');
      const senhaTemporariaPadrao = "Acesso@Provisorio123";
      const { error: errorLoginProv } = await db.auth.signInWithPassword({ email: emailAlvoAtivacao, password: senhaTemporariaPadrao });
      if (errorLoginProv) {
        const { error: errorLoginDireto } = await db.auth.signInWithPassword({ email: emailAlvoAtivacao, password });
        if (!errorLoginDireto) {
          await db.from('profiles').update({ status: 'ativo' }).eq('email', emailAlvoAtivacao);
          window.location.href = "dashboard.html"; return;
        }
        const { error: sError } = await db.auth.signUp({ email: emailAlvoAtivacao, password, options: { emailRedirectTo: null } });
        if (sError) { msgForm('mensagem', 'Erro: ' + sError.message, 'red'); return; }
        await db.from('profiles').update({ status: 'ativo' }).eq('email', emailAlvoAtivacao);
        msgForm('mensagem', 'Conta ativada! Redirecionando...', 'green');
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1000); return;
      }
      const { error: errorUpdate } = await db.auth.updateUser({ password });
      if (errorUpdate) { msgForm('mensagem', 'Erro ao salvar senha: ' + errorUpdate.message, 'red'); return; }
      // Garante que o perfil existe com upsert
      const { data: { user: uAtivo } } = await db.auth.getUser();
      if (uAtivo) {
        await db.from('profiles').upsert({
          id: uAtivo.id, email: emailAlvoAtivacao, status: 'ativo'
        }, { onConflict: 'id', ignoreDuplicates: false });
      }
      msgForm('mensagem', '✓ Conta ativada! Entrando...', 'green');
      setTimeout(() => { window.location.href = "dashboard.html"; }, 1000); return;
    }

    if (modoRecuperacao) {
      msgForm('mensagem', 'Processando requisição...', 'blue');
      await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/index.html" });
      msgForm('mensagem', 'Se o SMTP estiver ativo, as instruções chegarão no e-mail.', 'green');
    } else {
      if (!password) { alert("Por favor, informe sua senha."); return; }
      msgForm('mensagem', 'Verificando credenciais...', 'blue');
      const { error: loginError } = await db.auth.signInWithPassword({ email, password });
      if (loginError) {
        msgForm('mensagem', 'Acesso negado: ' + loginError.message, 'red');
      } else {
        msgForm('mensagem', 'Acesso autorizado! Carregando dashboard...', 'green');

        // Verifica se o perfil existe; cria automaticamente se for o primeiro acesso do admin
        const { data: { user: userLogado } } = await db.auth.getUser();
        if (userLogado) {
          const { data: perfilExistente } = await db
            .from('profiles')
            .select('id')
            .eq('id', userLogado.id)
            .maybeSingle();

          if (!perfilExistente) {
            // Cria o perfil admin automaticamente — nunca bloqueia o login
            await db.from('profiles').insert([{
              id:     userLogado.id,
              email:  userLogado.email,
              nome:   userLogado.user_metadata?.full_name || 'Administrador',
              role:   'admin',
              status: 'ativo',
            }]);
          } else {
            await db.from('profiles').update({ status: 'ativo' }).eq('id', userLogado.id);
          }
        }

        setTimeout(() => { window.location.href = "dashboard.html"; }, 600);
      }
    }
  });
}

// ===================== DASHBOARD =====================
const CHART_DEFAULTS = { responsive: true, maintainAspectRatio: true, devicePixelRatio: 2 };

async function renderizarGraficosDashboard() {
  // Cards — soma AC + Facilities
  const [{ count: cAtivos }, { count: cFichas }, { count: cAbAC }, { count: cFecAC }, { count: cAbFac }, { count: cFecFac }] = await Promise.all([
    db.from('equipamentos').select('*', { count: 'exact', head: true }),
    db.from('fichas_pmoc').select('*', { count: 'exact', head: true }),
    db.from('ordens_servico').select('*', { count: 'exact', head: true }).in('status_os', ['Aberta', 'Em Andamento']),
    db.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status_os', 'Concluída'),
    db.from('ordens_servico_geral').select('*', { count: 'exact', head: true }).in('status_os', ['Aberta', 'Em Andamento']),
    db.from('ordens_servico_geral').select('*', { count: 'exact', head: true }).eq('status_os', 'Concluída'),
  ]);
  if ($('dash-txt-ativos'))      $('dash-txt-ativos').innerText      = cAtivos ?? '0';
  if ($('dash-txt-fichas'))      $('dash-txt-fichas').innerText      = cFichas ?? '0';
  if ($('dash-txt-os-abertas'))  $('dash-txt-os-abertas').innerText  = (cAbAC ?? 0) + (cAbFac ?? 0);
  if ($('dash-txt-os-fechadas')) $('dash-txt-os-fechadas').innerText = (cFecAC ?? 0) + (cFecFac ?? 0);

  // Gráfico 1 — Volumetria TOTAL (AC + Facilities)
  const [{ data: osAC }, { data: osFacAll }] = await Promise.all([
    db.from('ordens_servico').select('status_os'),
    db.from('ordens_servico_geral').select('status_os'),
  ]);
  if ($('chartStatusOS')) {
    const cnt = { Aberta: 0, 'Em Andamento': 0, Concluida: 0 };
    [...(osAC||[]), ...(osFacAll||[])].forEach(o => {
      if (o.status_os === 'Aberta') cnt.Aberta++;
      else if (o.status_os === 'Em Andamento') cnt['Em Andamento']++;
      else if (o.status_os === 'Concluída') cnt.Concluida++;
    });
    if (chartOS) chartOS.destroy();
    chartOS = new Chart($('chartStatusOS'), {
      type: 'doughnut',
      data: {
        labels: ['Aberta / Pendente', 'Em Andamento', 'Concluída'],
        datasets: [{ data: [cnt.Aberta, cnt['Em Andamento'], cnt.Concluida], backgroundColor: ['#f59e0b','#3b82f6','#10b981'], borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }]
      },
      options: { ...CHART_DEFAULTS, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 }, usePointStyle: true } }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed} O.S.` } } } }
    });
  }

  // Gráfico 2 — Criticidade dos ativos
  const { data: eqCrit } = await db.from('equipamentos').select('criticidade');
  if ($('chartCriticidade')) {
    const cnt = { Alta: 0, Media: 0, Baixa: 0 };
    (eqCrit||[]).forEach(e => {
      if (e.criticidade === 'Alta') cnt.Alta++;
      else if (e.criticidade === 'Média') cnt.Media++;
      else if (e.criticidade === 'Baixa') cnt.Baixa++;
    });
    if (chartCrit) chartCrit.destroy();
    chartCrit = new Chart($('chartCriticidade'), {
      type: 'bar',
      data: {
        labels: ['Alta (A)', 'Média (B)', 'Baixa (C)'],
        datasets: [{ data: [cnt.Alta, cnt.Media, cnt.Baixa], backgroundColor: ['rgba(239,68,68,0.85)','rgba(245,158,11,0.85)','rgba(16,185,129,0.85)'], borderColor: ['#ef4444','#f59e0b','#10b981'], borderWidth: 2, borderRadius: 6, borderSkipped: false }]
      },
      options: { ...CHART_DEFAULTS, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.y} ativo(s)` } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 12 } }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { ticks: { font: { size: 12 } }, grid: { display: false } } } }
    });
  }

  // Gráfico 3 — Facilities por status (barras horizontais)
  const { data: osFac } = await db.from('ordens_servico_geral').select('status_os');
  if ($('chartStatusOSG')) {
    const cnt = { Aberta: 0, 'Em Andamento': 0, Concluida: 0 };
    (osFac||[]).forEach(o => {
      if (o.status_os === 'Aberta') cnt.Aberta++;
      else if (o.status_os === 'Em Andamento') cnt['Em Andamento']++;
      else if (o.status_os === 'Concluída') cnt.Concluida++;
    });
    if (chartOSG) chartOSG.destroy();
    chartOSG = new Chart($('chartStatusOSG'), {
      type: 'bar',
      data: {
        labels: ['Aberta', 'Em Andamento', 'Concluída'],
        datasets: [{ data: [cnt.Aberta, cnt['Em Andamento'], cnt.Concluida], backgroundColor: ['rgba(245,158,11,0.85)','rgba(139,92,246,0.85)','rgba(16,185,129,0.85)'], borderColor: ['#f59e0b','#8b5cf6','#10b981'], borderWidth: 2, borderRadius: 6, borderSkipped: false }]
      },
      options: { ...CHART_DEFAULTS, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x} O.S.` } } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 12 } }, grid: { color: 'rgba(0,0,0,0.05)' } }, y: { ticks: { font: { size: 13 } }, grid: { display: false } } } }
    });
  }

  // Logs recentes unificados
  const [{ data: logsAC2 }, { data: logsFac }] = await Promise.all([
    db.from('ordens_servico').select('created_at, status_os, tipo_os, equipamentos(tag)').order('created_at', { ascending: false }).limit(5),
    db.from('ordens_servico_geral').select('created_at, status_os, servico_requisitado, setor').order('created_at', { ascending: false }).limit(5),
  ]);
  const el = $('dash-atividades');
  if (el) {
    const todos = [
      ...(logsAC2||[]).map(l => ({ data: l.created_at, status: l.status_os, desc: l.tipo_os, ref: l.equipamentos?.tag||'—', origem: '❄️' })),
      ...(logsFac||[]).map(l => ({ data: l.created_at, status: l.status_os, desc: l.servico_requisitado||'—', ref: l.setor||'—', origem: '🏢' })),
    ].sort((a,b) => new Date(b.data)-new Date(a.data)).slice(0,8);
    el.innerHTML = todos.length ? todos.map(l =>
      `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:10px;color:#a0aec0;min-width:70px;">${fmtDate(l.data)}</span>
        <span style="font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${l.origem}</span>
        <strong style="font-size:13px;">${l.ref}</strong>
        <span style="color:#4a5568;font-size:12px;flex:1;">${l.desc}</span>
        ${statusBadge(l.status)}
      </div>`).join('') : '<p style="color:#a0aec0;">Nenhum registro encontrado.</p>';
  }
}
async function carregarAgendaManutencoes() {
  const tbody = $('tbody-agenda-pmoc'); if (!tbody) return;
  const { data } = await db.from('fichas_pmoc')
    .select('proxima_manutencao, equipamentos(tag, bloco)')
    .not('proxima_manutencao', 'is', null)
    .order('proxima_manutencao', { ascending: true })
    .limit(10);

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Nenhuma manutenção agendada.</td></tr>';
    return;
  }

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  tbody.innerHTML = data.map(f => {
    const dt = new Date(f.proxima_manutencao + 'T00:00:00');
    const diff = Math.ceil((dt - hoje) / (1000 * 60 * 60 * 24));
    const status = diff < 0 ? '<span class="tag-badge danger">Vencida</span>'
      : diff <= 7  ? '<span class="tag-badge warning">Urgente</span>'
      : '<span class="tag-badge success">Programada</span>';
    return `<tr>
      <td><span class="tag-badge">${f.equipamentos?.tag || '—'}</span></td>
      <td>${f.equipamentos?.bloco || '—'}</td>
      <td>${fmtDate(f.proxima_manutencao)}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

// ===================== ALERTAS DE VENCIMENTO =====================
async function carregarAlertasVencimento() {
  const painel = $('painel-alertas-vencimento');
  const lista  = $('lista-alertas-vencimento');
  const badge  = $('badge-alertas-count');
  const sub    = $('txt-alerta-subtitulo');
  if (!painel || !lista) return;

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);

  // Busca fichas PMOC com proxima_manutencao definida
  const { data: fichas } = await db.from('fichas_pmoc')
    .select('proxima_manutencao, equipamentos(tag, bloco, produto, categoria)')
    .not('proxima_manutencao', 'is', null)
    .lte('proxima_manutencao', em30.toISOString().split('T')[0])
    .order('proxima_manutencao', { ascending: true });

  // Busca todos os equipamentos com campo 'validade' preenchido
  const { data: eqsValidade } = await db.from('equipamentos')
    .select('tag, bloco, categoria, produto, validade')
    .not('validade', 'is', null);

  const alertas = [];

  // Processar fichas PMOC
  (fichas || []).forEach(f => {
    const dt = new Date(f.proxima_manutencao + 'T00:00:00');
    const diff = Math.ceil((dt - hoje) / (1000 * 60 * 60 * 24));
    if (diff > 30) return;
    alertas.push({
      tipo: diff < 0 ? 'vencida' : diff <= 7 ? 'urgente' : 'proxima',
      diff,
      tag: f.equipamentos?.tag || '—',
      local: f.equipamentos?.bloco || '—',
      descricao: `Manutenção PMOC — ${f.equipamentos?.produto || f.equipamentos?.categoria || 'Equipamento'}`,
      data: f.proxima_manutencao,
    });
  });

  // Processar equipamentos com validade (filtros, lacres, peças)
  (eqsValidade || []).forEach(b => {
    if (!b.validade) return;
    const dt = new Date(b.validade + 'T00:00:00');
    const diff = Math.ceil((dt - hoje) / (1000 * 60 * 60 * 24));
    if (diff > 30) return;
    const cat = b.categoria || '';
    const descricao = cat === 'BEB' || cat === 'Bebedouro'
      ? 'Troca de Filtro/Lacre — Bebedouro'
      : `Validade de Item — ${b.produto || cat || 'Equipamento'}`;
    alertas.push({
      tipo: diff < 0 ? 'vencida' : diff <= 7 ? 'urgente' : 'proxima',
      diff,
      tag: b.tag || '—',
      local: b.bloco || '—',
      descricao,
      data: b.validade,
    });
  });

  if (alertas.length === 0) { painel.style.display = 'none'; return; }

  // Ordena: vencidas primeiro, depois por proximidade
  alertas.sort((a, b) => a.diff - b.diff);

  badge.textContent = alertas.length + (alertas.length === 1 ? ' alerta' : ' alertas');

  const vencidas = alertas.filter(a => a.diff < 0).length;
  const urgentes = alertas.filter(a => a.diff >= 0 && a.diff <= 7).length;
  sub.textContent = [
    vencidas ? `${vencidas} vencida(s)` : '',
    urgentes ? `${urgentes} urgente(s) esta semana` : '',
  ].filter(Boolean).join(' · ') || 'Itens que requerem atenção imediata';

  const corTipo = { vencida: { bg:'#fef2f2', borda:'#ef4444', txt:'#991b1b', label:'VENCIDA' }, urgente: { bg:'#fff7ed', borda:'#f97316', txt:'#c2410c', label:'URGENTE' }, proxima: { bg:'#fefce8', borda:'#eab308', txt:'#854d0e', label:'ATENÇÃO' } };

  lista.innerHTML = alertas.map(a => {
    const c = corTipo[a.tipo];
    const diffTxt = a.diff < 0 ? `Venceu há ${Math.abs(a.diff)} dia(s)` : a.diff === 0 ? 'Vence HOJE' : `Vence em ${a.diff} dia(s)`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${c.bg};border:1px solid ${c.borda};border-radius:8px;flex-wrap:wrap;">
      <span style="background:${c.borda};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;">${c.label}</span>
      <span style="font-size:13px;font-weight:700;color:#1a202c;">${a.tag}</span>
      <span style="font-size:12px;color:#4a5568;flex:1;">${a.descricao} — ${a.local}</span>
      <span style="font-size:12px;color:${c.txt};font-weight:600;white-space:nowrap;">${diffTxt}</span>
      <span style="font-size:11px;color:#a0aec0;">${fmtDate(a.data)}</span>
    </div>`;
  }).join('');

  painel.style.display = 'block';
}

// ===================== EDIÇÃO E EXCLUSÃO — PMOC =====================
async function editarFichaPMOC(id) {
  const ficha = _fichasCache.find(f => f.id == id);
  if (!ficha) { alert('Ficha não encontrada no cache. Recarregue a página.'); return; }

  // Extrai dados das observações
  const matchObs  = ficha.observacoes?.match(/\[DataInspecao:\s*([^\]]+)\]/);
  const matchFreq = ficha.observacoes?.match(/\[Frequencia:\s*([^\]]+)\]/);
  const freqMap   = { Mensal: 'M', Trimestral: 'T', Semestral: 'S', Anual: 'A' };
  const obsLimpa  = (ficha.observacoes || '').replace(/\[[^\]]+\]/g, '').trim();

  // Preenche o formulário
  if ($('pmoc-equipamento')) $('pmoc-equipamento').value = ficha.equipamento_id || '';
  if ($('pmoc-data'))        $('pmoc-data').value        = matchObs ? matchObs[1] : '';
  if ($('pmoc-frequencia'))  $('pmoc-frequencia').value  = freqMap[matchFreq?.[1]] || 'M';
  if ($('pmoc-obs'))         $('pmoc-obs').value         = obsLimpa;

  // Guarda o ID e muda título
  if ($('pmoc-id-edicao'))   $('pmoc-id-edicao').value  = id;
  const titulo = $('titulo-formulario-pmoc') || document.querySelector('#sub-pmoc-form h3');
  if (titulo) titulo.innerText = '✏️ Editando Ficha PMOC — ' + (ficha.equipamentos?.tag || id.toString().slice(0,6).toUpperCase());

  const btnSalvar = $('btn-salvar-ficha');
  if (btnSalvar) { btnSalvar.innerText = '💾 Salvar Alterações'; btnSalvar.style.background = '#d97706'; }

  // Mostra botão cancelar
  let btnCancelar = $('btn-cancelar-edicao-pmoc');
  if (!btnCancelar) {
    btnCancelar = document.createElement('button');
    btnCancelar.id = 'btn-cancelar-edicao-pmoc';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.innerText = '✕ Cancelar';
    btnCancelar.onclick = resetarFormPMOC;
    btnSalvar?.parentNode?.appendChild(btnCancelar);
  }
  btnCancelar.style.display = 'inline-block';

  // Navega para o formulário
  alternarSubAbasPMOC('form');
  document.getElementById('sub-pmoc-form')?.scrollIntoView({ behavior: 'smooth' });
}

function resetarFormPMOC() {
  if ($('pmoc-id-edicao')) $('pmoc-id-edicao').value = '';
  if ($('pmoc-obs'))       $('pmoc-obs').value = '';
  if ($('pmoc-data'))      $('pmoc-data').value = '';
  const titulo = $('titulo-formulario-pmoc') || document.querySelector('#sub-pmoc-form h3');
  if (titulo) titulo.innerText = '📋 Novo Laudo PMOC';
  const btnSalvar = $('btn-salvar-ficha');
  if (btnSalvar) { btnSalvar.innerText = '✓ Registrar Ficha PMOC'; btnSalvar.style.background = ''; }
  const btnCancelar = $('btn-cancelar-edicao-pmoc');
  if (btnCancelar) btnCancelar.style.display = 'none';
}

async function excluirFichaPMOC(id) {
  const ficha = _fichasCache.find(f => f.id == id);
  const tag = ficha?.equipamentos?.tag || id.toString().slice(0,6).toUpperCase();
  if (!confirm(`Excluir ficha PMOC do equipamento ${tag}? Esta ação não pode ser desfeita.`)) return;
  const { error } = await db.from('fichas_pmoc').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  carregarHistoricoFichas();
}

// ===================== EDIÇÃO E EXCLUSÃO — OS AC =====================
async function editarOS(id, equipId, colabId, tipo, status, defeito, laudo) {
  if ($('os-id-edicao'))    $('os-id-edicao').value    = id;
  if ($('os-equipamento'))  $('os-equipamento').value  = equipId;
  if ($('os-tecnico'))      $('os-tecnico').value      = colabId;
  if ($('os-tipo'))         $('os-tipo').value         = tipo;
  if ($('os-status'))       $('os-status').value       = status;
  if ($('os-defeito'))      $('os-defeito').value      = defeito;
  if ($('os-laudo'))        $('os-laudo').value        = laudo;

  const titulo = $('titulo-formulario-os');
  if (titulo) titulo.innerText = '✏️ Editando O.S. — ' + 'OS-AC-' + id.toString().slice(0,5).toUpperCase();

  const btnSalvar = $('btn-salvar-os');
  if (btnSalvar) { btnSalvar.innerText = '💾 Salvar Alterações'; btnSalvar.style.background = '#d97706'; }

  const btnCancelar = $('btn-cancelar-edicao-os');
  if (btnCancelar) btnCancelar.style.display = 'inline-block';

  document.getElementById('foco-formulario-os')?.scrollIntoView({ behavior: 'smooth' });
}

async function excluirOS(id) {
  if (!confirm(`Excluir OS-AC-${id.toString().slice(0,5).toUpperCase()}? Esta ação não pode ser desfeita.`)) return;
  const { error } = await db.from('ordens_servico').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  carregarOrdensServico(); carregarCentralUnificadaOS();
}

// Cancelar edição OS AC
if ($('btn-cancelar-edicao-os')) {
  $('btn-cancelar-edicao-os').addEventListener('click', () => {
    resetarFormOS();
    const titulo = $('titulo-formulario-os');
    if (titulo) titulo.innerText = 'Abertura / Atualização de O.S. Técnica';
    const btnSalvar = $('btn-salvar-os');
    if (btnSalvar) { btnSalvar.innerText = '✓ Registrar Ordem de Serviço'; btnSalvar.style.background = ''; }
    const btnCancelar = $('btn-cancelar-edicao-os');
    if (btnCancelar) btnCancelar.style.display = 'none';
  });
}

// ===================== EDIÇÃO E EXCLUSÃO — OS FACILITIES =====================
async function editarOSG(id, setor, servico, status) {
  if ($('osg-id-edicao'))        $('osg-id-edicao').value        = id;
  if ($('osg-setor'))            $('osg-setor').value            = setor;
  if ($('osg-requisitado'))      $('osg-requisitado').value      = servico;
  if ($('osg-status'))           $('osg-status').value           = status;

  const btnSalvar = $('btn-salvar-osg');
  if (btnSalvar) { btnSalvar.innerText = '💾 Salvar Alterações'; btnSalvar.style.background = '#d97706'; }

  const btnCancelar = $('btn-cancelar-edicao-osg');
  if (btnCancelar) btnCancelar.style.display = 'inline-block';

  document.getElementById('foco-formulario-osg')?.scrollIntoView({ behavior: 'smooth' });
}

async function excluirOSG(id) {
  if (!confirm(`Excluir esta O.S. de Facilities? Esta ação não pode ser desfeita.`)) return;
  const { error } = await db.from('ordens_servico_geral').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  carregarOSGeral(); carregarCentralUnificadaOS();
}

// Cancelar edição OSG
if ($('btn-cancelar-edicao-osg')) {
  $('btn-cancelar-edicao-osg').addEventListener('click', () => {
    resetarFormOSG();
    const btnSalvar = $('btn-salvar-osg');
    if (btnSalvar) { btnSalvar.innerText = '✓ Salvar Ordem Facilities'; btnSalvar.style.background = ''; }
    const btnCancelar = $('btn-cancelar-edicao-osg');
    if (btnCancelar) btnCancelar.style.display = 'none';
  });
}
