// =====================================================================
//  CONCREDUR — app.js  (versão refatorada — Fases 1-4)
//  Fase 1: credenciais removidas → consumidas de config.js
//  Fase 2: assinaturas → Storage; observacoes → meta_pmoc JSONB
//  Fase 3: CanvasAssinatura isolado; escapeHTML contra XSS
//  Fase 4: dashboard lê views SQL materializadas
// =====================================================================

// ── Credenciais: lidas de config.js (carregado antes no HTML)
// Fallback embutido garante funcionamento mesmo se config.js falhar no deploy
const _SUPA_URL = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL)
  ? SUPABASE_URL
  : 'https://mqijbvcnalbfjbhhjjzx.supabase.co';
const _SUPA_KEY = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY)
  ? SUPABASE_ANON_KEY
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaWpidmNuYWxiZmpiaGhqanp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM5ODcsImV4cCI6MjA5NjA1OTk4N30.2L_zzKs_voAt5SnmcKeYSBiskX46k8SFFdJgTkIGe7Q';
const db = supabase.createClient(_SUPA_URL, _SUPA_KEY);

// Logo institucional (base64) — usada nas etiquetas de impressão
const LOGO_ETIQUETA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA9CAYAAADoByY0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDAyIDc5LjE2NDQ4OCwgMjAyMC8wNy8xMC0yMjowNjo1MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjAgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjM4MEYxMjVBNTg3NDExRUU5QTBGQkI4N0VFOTE2RTJGIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjM4MEYxMjVCNTg3NDExRUU5QTBGQkI4N0VFOTE2RTJGIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MzgwRjEyNTg1ODc0MTFFRTlBMEZCQjg3RUU5MTZFMkYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MzgwRjEyNTk1ODc0MTFFRTlBMEZCQjg3RUU5MTZFMkYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6klSGIAAAP7ElEQVR42uxdCXQV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';

// ===================== ESTADO GLOBAL =====================
let globalEquipamentos     = [];
let paginaAtualEquipamento = 0;
const itensPorPagina       = 8;
let chartOS = null, chartCrit = null, chartOSG = null;
let modoRecuperacao = false;

// ===================== UTILITÁRIOS =====================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso
  ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR')
  : '—';
const hoje = () => new Date().toISOString().split('T')[0];

// ── Fase 3: escapeHTML — sanitização para todos os innerHTML com dados do banco ──
function escapeHTML(str) {
  if (str === null || str === undefined) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Compatibilidade: lê meta_pmoc (novo JSONB) com fallback para observacoes regex (legado) ──
function lerMetaPMOC(ficha) {
  if (ficha.meta_pmoc && Object.keys(ficha.meta_pmoc).length > 0) {
    return ficha.meta_pmoc;
  }
  const obs = ficha.observacoes || '';
  const matchData   = obs.match(/\[DataInspecao:\s*([^\]]+)\]/);
  const matchFreq   = obs.match(/\[Frequencia:\s*([^\]]+)\]/);
  const matchTipo   = obs.match(/\[TipoEquipamento:\s*([^\]]+)\]/);
  const matchChk    = obs.match(/\[Checklist:\s*(\{[^\]]+\})\]/);
  const matchFiscal = obs.match(/\[FiscalNome:\s*([^\]]+)\]/);
  return {
    data_inspecao:    matchData   ? matchData[1]   : null,
    frequencia:       matchFreq   ? matchFreq[1]   : 'Mensal',
    tipo_equipamento: matchTipo   ? matchTipo[1]   : 'OUT',
    checklist:        matchChk    ? (() => { try { return JSON.parse(matchChk[1]); } catch(e) { return {}; } })() : {},
    fiscal_nome:      matchFiscal ? matchFiscal[1].trim() : '—',
    _obsLimpa:        obs.replace(/\[[^\]]+\]/g, '').trim(),
  };
}

// ── Compatibilidade: lê assinatura_url (Storage) com fallback para assinatura_digital (Base64 legado) ──
function lerAssinaturaURL(obj, campoUrl, campoBase64) {
  if (!obj) return null;
  if (obj[campoUrl])                                    return obj[campoUrl];
  if (obj[campoBase64]?.startsWith('data:image'))       return obj[campoBase64];
  return null;
}

function statusBadge(status) {
  const cls = status === 'Concluída' ? 'success' : status === 'Em Andamento' ? 'andamento' : 'warning';
  return `<span class="tag-badge ${cls}">${escapeHTML(status)}</span>`;
}

function msgForm(id, texto, cor) {
  const el = $(id);
  if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db';
  el.textContent = texto;
  if (cor === 'green') setTimeout(() => { el.textContent = ''; }, 4000);
}

// ===================== COMPRESSÃO E UPLOAD DE FOTO =====================
const FOTO_CONFIG = { maxWidth: 1280, maxHeight: 1280, qualidade: 0.78, maxBytes: 800_000 };

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
        const cnv = document.createElement('canvas');
        cnv.width = width; cnv.height = height;
        const c = cnv.getContext('2d');
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, width, height);
        c.drawImage(img, 0, 0, width, height);
        cnv.toBlob((blob) => {
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
  const { error } = await db.storage
    .from('fotos-pmoc')
    .upload(nomeArq, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) return null;
  const { data: { publicUrl } } = db.storage.from('fotos-pmoc').getPublicUrl(nomeArq);
  return publicUrl;
}

// ── Fase 2: upload de assinatura PNG para Storage (substitui Base64 no DB) ──
async function uploadAssinatura(blob, pasta, nomeBase) {
  const nomeArq = `assinaturas/${pasta}/${nomeBase}_${Date.now()}.png`;
  const { error } = await db.storage
    .from('fotos-pmoc')
    .upload(nomeArq, blob, { contentType: 'image/png', upsert: false });
  if (error) { console.warn('Falha upload assinatura:', error.message); return null; }
  const { data: { publicUrl } } = db.storage.from('fotos-pmoc').getPublicUrl(nomeArq);
  return publicUrl;
}

// ── Fase 3: CanvasAssinatura — componente isolado e reutilizável ──
class CanvasAssinatura {
  constructor(canvasId) {
    this.el         = document.getElementById(canvasId);
    this.ctx        = this.el ? this.el.getContext('2d') : null;
    this.desenhando = false;
    if (this.el) this._init();
  }

  _aplicarEstilo() {
    this.ctx.lineWidth   = 2.5;
    this.ctx.strokeStyle = '#1a202c';
    this.ctx.lineCap     = 'round';
    this.ctx.lineJoin    = 'round';
  }

  _sincronizarTamanho() {
    const rect = this.el.getBoundingClientRect();
    if (rect.width === 0) return;
    this.el.width  = Math.round(rect.width);
    this.el.height = Math.round(rect.height);
    this._aplicarEstilo();
  }

  _getPos(e) {
    const rect   = this.el.getBoundingClientRect();
    const scaleX = this.el.width  / rect.width;
    const scaleY = this.el.height / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

  _init() {
    this._sincronizarTamanho();
    let largAnt = this.el.width;
    window.addEventListener('resize', () => {
      const nova = Math.round(this.el.getBoundingClientRect().width);
      if (nova !== largAnt && nova > 0) { largAnt = nova; this._sincronizarTamanho(); }
    });

    this.el.addEventListener('mousedown', (e) => {
      this.desenhando = true;
      this.ctx.beginPath();
      const p = this._getPos(e);
      this.ctx.moveTo(p.x, p.y);
    });
    this.el.addEventListener('mousemove', (e) => {
      if (!this.desenhando) return;
      e.preventDefault();
      const p = this._getPos(e);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
    });
    window.addEventListener('mouseup', () => { this.desenhando = false; });
    this.el.addEventListener('touchstart', (e) => {
      this.desenhando = true;
      this.ctx.beginPath();
      const p = this._getPos(e);
      this.ctx.moveTo(p.x, p.y);
    }, { passive: true });
    this.el.addEventListener('touchmove', (e) => {
      if (!this.desenhando) return;
      e.preventDefault();
      const p = this._getPos(e);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
    }, { passive: false });
    window.addEventListener('touchend', () => { this.desenhando = false; });
  }

  temConteudo() {
    if (!this.ctx || !this.el) return false;
    return this.ctx.getImageData(0, 0, this.el.width, this.el.height)
      .data.some((v, i) => i % 4 === 3 && v > 0);
  }

  limpar() {
    if (this.ctx && this.el) this.ctx.clearRect(0, 0, this.el.width, this.el.height);
  }

  // Retorna Blob PNG (não Base64) — pronto para uploadAssinatura()
  async toBlob() {
    return new Promise((res) => this.el.toBlob(res, 'image/png'));
  }
}

// Instâncias globais (criadas após DOMContentLoaded nas páginas que usam canvas)
let canvasFiscal  = null; // canvas-assinatura (PMOC — assinatura do fiscal)
let canvasColab   = null; // canvas-colab-assinatura (colaborador)

// ── Compatibilidade retroativa com chamadas diretas ao canvas PMOC ──
function inicializarCanvasAssinatura() {
  canvasFiscal = new CanvasAssinatura('canvas-assinatura');
}
function limparCanvasAssinatura() { canvasFiscal?.limpar(); }

// ===================== SESSÃO & ROTEAMENTO =====================
async function verificarSessaoGlobal() {
  const pag = window.location.pathname.split('/').pop();
  const ehPaginaLogin   = (pag === '' || pag === 'index.html');
  const ehPaginaPublica = (pag === 'verificar.html');

  if (ehPaginaLogin || ehPaginaPublica) {
    if ($('user-display-email')) $('user-display-email').textContent = '';
    return;
  }

  // Verifica sessão — APENAS getUser(), sem depender da tabela profiles
  const { data: { user }, error } = await db.auth.getUser();
  if (!user || error) { window.location.href = 'index.html'; return; }

  // Exibe email imediatamente — não bloqueia em profiles
  if ($('user-display-email')) $('user-display-email').textContent = user.email;

  // Tenta buscar o nome do perfil em background — falha silenciosa se RLS bloquear
  try {
    const { data: perfil } = await db
      .from('profiles')
      .select('nome, role, status')
      .eq('id', user.id)
      .maybeSingle();

    if (perfil) {
      if ($('user-display-email'))
        $('user-display-email').textContent = perfil.nome || user.email;
    } else {
      // Perfil não existe — cria em background sem bloquear a página
      db.from('profiles').insert([{
        id:     user.id,
        email:  user.email,
        nome:   user.user_metadata?.full_name || user.email,
        role:   'admin',
        status: 'ativo',
      }]).then(() => {}).catch(() => {});
    }
  } catch(e) {
    // RLS ou outro erro em profiles — não impede o uso do sistema
    console.warn('profiles sync:', e.message);
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
  if ($('login-title')) $('login-title').textContent = ativar ? 'Recuperação de Acesso' : 'Acesso ao Sistema';
  if ($('login-desc'))  $('login-desc').textContent  = ativar
    ? 'Digite seu e-mail para receber o link de redefinição.'
    : 'Informe suas credenciais para continuar';
  if ($('login-password-group')) $('login-password-group').style.display = ativar ? 'none' : 'flex';
  if ($('link-recuperar')) $('link-recuperar').style.display = ativar ? 'none' : 'inline';
  if ($('link-voltar'))    $('link-voltar').style.display    = ativar ? 'inline' : 'none';
  if ($('btn-login')) {
    const btnEl = $('btn-login');
    // Preserva o ícone <span> e substitui apenas o texto do botão com segurança
    const spanEl = btnEl.querySelector('span');
    btnEl.textContent = ativar ? ' Enviar Link' : ' Entrar no Sistema';
    if (spanEl) btnEl.prepend(spanEl);
  }
}

// ===================== FLUXOGRAMA DE CRITICIDADE =====================
function calcularCriticidadeFluxograma() {
  if (!$('crit-interrupcao')) return 'Média';
  const i = $('crit-interrupcao').value, s = $('crit-seguranca').value;
  const o = $('crit-operacao').value,    r = $('crit-reserva').value;
  const res = (i === 'sim' || s === 'sim')
    ? (r === 'nao' ? 'Alta (A)' : 'Média (B)')
    : (o === 'sim' ? (r === 'nao' ? 'Média (B)' : 'Baixa (C)') : 'Baixa (C)');
  if ($('label-criticidade-calculada')) $('label-criticidade-calculada').textContent = 'Classe ' + res;
  return res.split(' ')[0];
}

const FREQ_HIERARQUIA = { M: ['M'], T: ['M','T'], S: ['M','T','S'], A: ['M','T','S','A'] };
function toggleItemsPorFrequencia() {
  const freq = $('pmoc-frequencia')?.value || 'M';
  const ativas = FREQ_HIERARQUIA[freq] || ['M'];
  [{ cls:'freq-item-t', fq:'T' }, { cls:'freq-item-s', fq:'S' }, { cls:'freq-item-a', fq:'A' }]
    .forEach(({ cls, fq }) => {
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
const EQ_CATEGORIA_LABEL = {
  AC:'❄️ Ar Condicionado', BEB:'💧 Bebedouro',
  CLIM:'🌀 Climatizador Evaporativo', VEN:'💨 Ventilador/Exaustor', OUT:'🔧 Outros',
};

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
    if (!tag || !cat) { msgForm('msg-equipamento', 'TAG e Categoria são obrigatórias.', 'red'); return; }
    msgForm('msg-equipamento', 'Salvando...', 'blue');
    const payload = {
      tag, categoria: cat,
      marca:      $('eq-marca')?.value.trim()      || null,
      produto:    $('eq-produto')?.value.trim()    || null,
      nr_serie:   $('eq-serie')?.value.trim()      || null,
      patrimonio: $('eq-patrimonio')?.value.trim() || null,
      bloco:      $('eq-bloco')?.value.trim()      || null,
      setor:      $('eq-setor')?.value.trim()      || null,
      sala:       $('eq-sala')?.value.trim()       || null,
      instituicao:$('eq-instituicao')?.value.trim()|| null,
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

    // Bug fix: UPDATE quando em modo edição (?edit=ID), INSERT quando novo
    const idEdicao = $('eq-id-edicao')?.value;
    // Novo ativo recebe um qrcode_token (UUID) automaticamente para a etiqueta QR
    if (!idEdicao) payload.qrcode_token = crypto.randomUUID();
    const { error } = idEdicao
      ? await db.from('equipamentos').update(payload).eq('id', idEdicao)
      : await db.from('equipamentos').insert([payload]);

    if (error) { msgForm('msg-equipamento', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-equipamento', idEdicao ? '✓ Equipamento atualizado!' : '✓ Equipamento salvo!', 'green');
    setTimeout(() => location.href = 'gerir-equipamentos.html', 1200);
  });
}

// Carrega os dados de um equipamento no formulário (modo edição via ?edit=ID)
async function carregarEquipamentoParaEdicao() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (!editId) return;

  const { data: eq, error } = await db.from('equipamentos').select('*').eq('id', editId).single();
  if (error || !eq) { msgForm('msg-equipamento', 'Equipamento não encontrado para edição.', 'red'); return; }

  // Campo oculto que marca o modo edição
  let idInput = $('eq-id-edicao');
  if (!idInput) {
    idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.id   = 'eq-id-edicao';
    document.body.appendChild(idInput);
  }
  idInput.value = eq.id;

  // Categoria primeiro (dispara campos condicionais), depois os demais campos
  if ($('eq-categoria')) { $('eq-categoria').value = eq.categoria || ''; toggleCamposEquipamento(); }
  if ($('eq-tag'))         $('eq-tag').value         = eq.tag         || '';
  if ($('eq-marca'))       $('eq-marca').value       = eq.marca       || '';
  if ($('eq-produto'))     $('eq-produto').value     = eq.produto     || '';
  if ($('eq-serie'))       $('eq-serie').value       = eq.nr_serie    || '';
  if ($('eq-patrimonio'))  $('eq-patrimonio').value  = eq.patrimonio  || '';
  if ($('eq-bloco'))       $('eq-bloco').value       = eq.bloco       || '';
  if ($('eq-setor'))       $('eq-setor').value       = eq.setor       || '';
  if ($('eq-sala'))        $('eq-sala').value        = eq.sala        || '';
  if ($('eq-instituicao')) $('eq-instituicao').value = eq.instituicao || '';
  if ($('eq-potencia') && eq.potencia) $('eq-potencia').value = eq.potencia;
  if ($('eq-validade') && eq.validade) $('eq-validade').value = eq.validade;

  // Preenche os campos técnicos extras (extras_tecnico JSONB)
  const extras = eq.extras_tecnico || {};
  Object.entries(extras).forEach(([k, v]) => {
    const el = $('eq-' + k);
    if (el) el.value = v;
  });

  // Atualiza o título e o botão para refletir o modo edição
  const btn = $('btn-salvar');
  if (btn) { btn.textContent = '💾 Salvar Alterações'; btn.style.background = '#d97706'; }
  msgForm('msg-equipamento', '✏️ Editando equipamento ' + (eq.tag || ''), 'blue');
}

async function carregarEquipamentos() {
  const { data } = await db.from('equipamentos').select('*').order('tag', { ascending: true });
  globalEquipamentos = data || [];
  filtrarEquipamentos(0);
  atualizarSelectEquipamentos();
}

function filtrarEquipamentos(delta) {
  paginaAtualEquipamento = Math.max(0, paginaAtualEquipamento + delta);
  const termo = ($('search-eq-termo')?.value || '').toLowerCase();
  const crit  = $('search-eq-criticidade')?.value || '';
  const bloco = ($('search-eq-bloco')?.value || '').toLowerCase();
  let items = globalEquipamentos.filter(e =>
    (!termo || e.tag.toLowerCase().includes(termo) || (e.produto||'').toLowerCase().includes(termo)) &&
    (!crit  || (e.criticidade||'') === crit) &&
    (!bloco || (e.bloco||'').toLowerCase().includes(bloco))
  );
  const total = Math.max(1, Math.ceil(items.length / itensPorPagina));
  paginaAtualEquipamento = Math.min(paginaAtualEquipamento, total - 1);
  if ($('txt-eq-paginacao'))
    $('txt-eq-paginacao').textContent = `Página ${paginaAtualEquipamento + 1} de ${total}`;
  const slice  = items.slice(paginaAtualEquipamento * itensPorPagina, (paginaAtualEquipamento + 1) * itensPorPagina);
  const tbody  = $('tbody-equipamentos-gerir'); if (!tbody) return;
  if (!slice.length) { tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum ativo encontrado.</td></tr>'; return; }
  tbody.innerHTML = slice.map(eq => {
    // Bug 2 fix: normalizar todas as propriedades com fallback '' antes do escapeHTML
    const tag      = eq.tag         || '';
    const produto  = eq.produto      || '';
    const marca    = eq.marca        || '';
    const bloco    = eq.bloco        || '';
    const setor    = eq.setor        || '';
    const sala     = eq.sala         || '';
    const crit     = eq.criticidade  || 'Média';
    const critCls  = crit === 'Alta' ? 'danger' : crit === 'Baixa' ? 'success' : '';
    const local    = [bloco, setor].filter(Boolean).join(' / ') || '—';
    return `<tr>
      <td><span class="tag-badge">${escapeHTML(tag)}</span></td>
      <td><strong>${escapeHTML(produto)}</strong><br><small style="color:#a0aec0">${escapeHTML(marca)}</small></td>
      <td>${escapeHTML(local)}<br><small style="color:#a0aec0">${escapeHTML(sala)}</small></td>
      <td><span class="tag-badge ${critCls}">Classe ${escapeHTML(crit)}</span></td>
      <td>${eq.qrcode_token
        ? `<button class="btn-primary" style="padding:3px 10px;font-size:11px;" title="Abrir etiqueta de impressão com QR Code" onclick="exibirJanelaQRCode('${escapeHTML(eq.qrcode_token)}','${escapeHTML(tag)}','${eq.id}')">🏷️ Etiqueta</button>`
        : `<button class="btn-primary" style="padding:3px 10px;font-size:11px;background:#10b981;border-color:#10b981;" title="Gerar QR Code para este ativo" onclick="gerarTokenEquipamento('${eq.id}')">➕ Gerar QR</button>`}</td>
      <td>
        <button class="btn-primary" style="background:#4a5568;padding:3px 8px;font-size:11px;" onclick="editarEquipamento('${eq.id}')">✍️</button>
        <button class="btn-excluir" onclick="excluirEquipamento('${eq.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}
function mudarPaginaEquipamento(d) { filtrarEquipamentos(d); }
async function excluirEquipamento(id) {
  if (confirm('Remover ativo?')) { await db.from('equipamentos').delete().eq('id', id); carregarEquipamentos(); }
}
function editarEquipamento(id) { location.href = 'equipamentos.html?edit=' + id; }

// Gera um qrcode_token para um ativo que ainda não tem (registros antigos)
async function gerarTokenEquipamento(id) {
  const token = crypto.randomUUID();
  const { error } = await db.from('equipamentos').update({ qrcode_token: token }).eq('id', id);
  if (error) {
    if (error.message && error.message.includes('qrcode_token')) {
      alert('⚠️ A coluna "qrcode_token" ainda não existe no banco.\n\nExecute o script fix_qrcode_token.sql no Supabase (SQL Editor) antes de gerar os QR Codes.');
    } else {
      alert('Erro ao gerar QR Code: ' + error.message);
    }
    return;
  }
  // Atualiza o cache local e a tabela sem recarregar a página inteira
  const eq = globalEquipamentos.find(e => String(e.id) === String(id));
  if (eq) eq.qrcode_token = token;
  filtrarEquipamentos(0);
  // Abre a etiqueta recém-gerada
  if (eq) exibirJanelaQRCode(token, eq.tag, id);
}

// Gera tokens para TODOS os ativos que ainda não têm — em lote
async function gerarTokensFaltantes() {
  const semToken = globalEquipamentos.filter(e => !e.qrcode_token);
  if (!semToken.length) { alert('Todos os ativos já possuem QR Code.'); return; }
  if (!confirm(`Gerar QR Code para ${semToken.length} ativo(s) sem token?`)) return;
  for (const eq of semToken) {
    const token = crypto.randomUUID();
    const { error } = await db.from('equipamentos').update({ qrcode_token: token }).eq('id', eq.id);
    if (!error) eq.qrcode_token = token;
  }
  filtrarEquipamentos(0);
  alert(`✓ QR Code gerado para ${semToken.length} ativo(s).`);
}

async function atualizarSelectEquipamentos() {
  const { data } = await db.from('equipamentos').select('id, tag, produto, categoria');
  ['pmoc-equipamento','os-equipamento'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Ativo --</option>';
    (data || []).forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.tag} — ${e.produto || ''}`;
      opt.dataset.categoria = e.categoria || 'OUT';
      sel.appendChild(opt);
    });
  });
}

function onEquipamentoSelecionado() {
  const sel = $('pmoc-equipamento'); if (!sel) return;
  const cat = sel.options[sel.selectedIndex]?.dataset?.categoria || '';
  ['AC','BEB','CLIM','VEN','OUT'].forEach(t => {
    const el = $('checklist-' + t);
    if (el) { el.style.display = 'none'; el.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false); }
  });
  if (!cat) { if ($('checklist-placeholder')) $('checklist-placeholder').style.display = 'block'; return; }
  if ($('checklist-placeholder')) $('checklist-placeholder').style.display = 'none';
  const alvo = $('checklist-' + cat) || $('checklist-OUT');
  if (alvo) alvo.style.display = 'block';
  if ($('pmoc-tipo-badge')) $('pmoc-tipo-badge').style.display = 'block';
  if ($('pmoc-tipo-label')) $('pmoc-tipo-label').textContent = EQ_CATEGORIA_LABEL[cat] || 'Outro';
  toggleItemsPorFrequencia();
}

// ===================== COLABORADORES & FUNÇÕES =====================
async function atualizarSelectColaboradores() {
  const { data } = await db.from('colaboradores').select('id, nome, assinatura_url, assinatura_digital');
  ['pmoc-tecnico','os-tecnico','osg-tecnico'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      opt.dataset.assinaturaUrl = c.assinatura_url || '';
      sel.appendChild(opt);
    });
  });
}

async function atualizarSelectFuncoes() {
  const sel = $('colab-funcao'); if (!sel) return;
  const { data } = await db.from('funcoes').select('id, nome');
  sel.innerHTML = '<option value="">-- Selecione uma Função --</option>';
  (data || []).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id; opt.textContent = f.nome;
    sel.appendChild(opt);
  });
}

let _colabCache = [];
async function carregarColaboradores() {
  const tbody = $('tbody-colaboradores'); if (!tbody) return;
  const { data } = await db.from('colaboradores').select('*, funcoes(nome)').order('nome', { ascending: true });
  _colabCache = data || [];
  tbody.innerHTML = _colabCache.length ? _colabCache.map(c => {
    // Bug 1 fix: usa lerAssinaturaURL para checar ambas as colunas
    const urlAssin = lerAssinaturaURL(c, 'assinatura_url', 'assinatura_digital');
    const badgeAssinatura = urlAssin
      ? `<span class="tag-badge success" style="font-size:10px;">✓ Cadastrada</span>`
      : `<span class="tag-badge" style="font-size:10px;color:#a0aec0;">— Sem assinatura</span>`;
    return `<tr>
      <td><strong>${escapeHTML(c.nome)}</strong></td>
      <td>${c.cpf ? c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : '—'}</td>
      <td>${escapeHTML(c.funcoes?.nome)}</td>
      <td>${c.data_contratacao ? fmtDate(c.data_contratacao) : '—'}</td>
      <td>${badgeAssinatura}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarColaborador('${c.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="td-loading">Sem registros.</td></tr>';
}

async function excluirColaborador(id) {
  if (confirm('Remover colaborador?')) { await db.from('colaboradores').delete().eq('id', id); carregarColaboradores(); }
}

async function carregarFuncoes() {
  const tbody = $('tbody-funcoes'); if (!tbody) return;
  const { data: funcoes } = await db.from('funcoes').select('*').order('nome', { ascending: true });
  const { data: colabs }  = await db.from('colaboradores').select('funcao_id');
  const countMap = {};
  (colabs||[]).forEach(c => { if (c.funcao_id) countMap[c.funcao_id] = (countMap[c.funcao_id]||0)+1; });
  const nivelCor = { Junior:'#dbeafe', Pleno:'#d1fae5', Senior:'#fef3c7' };
  tbody.innerHTML = (funcoes||[]).length ? funcoes.map(f => {
    const nivel = f.nivel || 'Pleno';
    return `<tr>
      <td><strong>${escapeHTML(f.nome)}</strong></td>
      <td><span style="background:${nivelCor[nivel]||'#f3f4f6'};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">${escapeHTML(nivel)}</span></td>
      <td>R$ ${Number(f.salario||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td style="text-align:center;"><span class="tag-badge">${countMap[f.id]||0}</span></td>
      <td><button class="btn-excluir" onclick="excluirFuncao('${f.id}')">✕</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="td-loading">Sem registros.</td></tr>';
}
async function excluirFuncao(id) {
  if (confirm('Remover função?')) { await db.from('funcoes').delete().eq('id', id); carregarFuncoes(); }
}

if ($('btn-salvar-colaborador')) {
  $('btn-salvar-colaborador').addEventListener('click', async () => {
    const nome = $('colab-nome')?.value.trim();
    const cpf  = $('colab-cpf')?.value.trim();
    if (!nome || !cpf || !validarCPF(cpf)) {
      msgForm('msg-colaborador', 'Verifique o nome e o CPF informado.', 'red'); return;
    }
    msgForm('msg-colaborador', 'Salvando...', 'blue');

    // ── Assinatura → Storage (URL); fallback preserva URL ou Base64 existente ──
    let assinatura_url = null;
    if (canvasColab && canvasColab.temConteudo()) {
      const blob = await canvasColab.toBlob();
      assinatura_url = await uploadAssinatura(blob, 'colaboradores', cpf.replace(/\D/g,''));
    }
    // Edição: preservar assinatura anterior (URL Storage ou Base64 legado) se canvas intocado
    if (!assinatura_url && $('canvas-colab-assinatura')?.style.display === 'none') {
      const idEd   = $('colab-id-edicao')?.value;
      const cached = _colabCache.find(x => x.id === idEd);
      assinatura_url = lerAssinaturaURL(cached, 'assinatura_url', 'assinatura_digital') || null;
    }

    const payload = {
      nome,
      cpf:              cpf.replace(/\D/g,''),
      funcao_id:        $('colab-funcao')?.value || null,
      data_contratacao: $('colab-contratacao')?.value || null,
      assinatura_url,
    };

    const idEd = $('colab-id-edicao')?.value;
    const { error } = idEd
      ? await db.from('colaboradores').update(payload).eq('id', idEd)
      : await db.from('colaboradores').insert([payload]);

    if (error) { msgForm('msg-colaborador', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-colaborador', idEd ? '✓ Colaborador atualizado!' : '✓ Colaborador registrado!', 'green');
    carregarColaboradores();
    atualizarSelectColaboradores();
    if (typeof resetarFormColaborador === 'function') resetarFormColaborador();
    else { $('colab-nome').value = ''; $('colab-cpf').value = ''; }
  });
}

if ($('btn-salvar-funcao')) {
  $('btn-salvar-funcao').addEventListener('click', async () => {
    const nome = $('func-nome')?.value.trim(); if (!nome) return;
    const { error } = await db.from('funcoes').insert([{
      nome,
      salario: parseFloat($('func-salario')?.value) || 0,
      nivel:   $('func-nivel')?.value || 'Pleno',
    }]);
    if (!error) { msgForm('msg-funcao', '✓ Salva!', 'green'); carregarFuncoes(); atualizarSelectFuncoes(); $('func-nome').value = ''; }
  });
}

// ===================== FORMULÁRIO PMOC =====================
if ($('btn-salvar-ficha')) {
  $('btn-salvar-ficha').addEventListener('click', async () => {
    const equipamento_id = $('pmoc-equipamento')?.value;
    const tecnico_id     = $('pmoc-tecnico')?.value;
    const fiscal_nome    = $('pmoc-fiscal-nome')?.value.trim();
    if (!equipamento_id || !tecnico_id) { msgForm('msg-ficha','Preencha os campos obrigatórios.','red'); return; }
    if (!fiscal_nome) { msgForm('msg-ficha','Informe o nome do fiscal validador.','red'); return; }
    msgForm('msg-ficha','Salvando...','blue');

    const freq     = $('pmoc-frequencia')?.value || 'M';
    const dataInsp = $('pmoc-data')?.value || hoje();
    const cat      = $('pmoc-equipamento').options[$('pmoc-equipamento').selectedIndex]?.dataset?.categoria || 'OUT';
    const freqLabel = { M:'Mensal', T:'Trimestral', S:'Semestral', A:'Anual' };

    // ── Fase 2: checklist e metadados em JSONB (campo meta_pmoc) ──
    const checklistResult = {};
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]:checked')
      .forEach(r => { checklistResult[r.name] = r.value; });

    const meta_pmoc = {
      data_inspecao:   dataInsp,
      frequencia:      freqLabel[freq] || 'Mensal',
      tipo_equipamento: cat,
      checklist:       checklistResult,
      fiscal_nome:     fiscal_nome,
    };

    // ── Fase 2: assinatura fiscal → Storage (URL), não Base64 ──
    let assinatura_fiscal_url = null;
    if (canvasFiscal && canvasFiscal.temConteudo()) {
      const blob = await canvasFiscal.toBlob();
      assinatura_fiscal_url = await uploadAssinatura(blob, 'fiscal', `fiscal_${Date.now()}`);
    }

    const foto_url = await uploadFoto($('pmoc-foto')?.files[0], 'pmoc', 'msg-ficha');
    const { data: colab }     = await db.from('colaboradores').select('nome, assinatura_url, assinatura_digital').eq('id', tecnico_id).single();
    const { data: { user } }  = await db.auth.getUser();

    const payload = {
      equipamento_id,
      tecnico_nome:         colab?.nome || 'Técnico',
      observacoes:          $('pmoc-obs')?.value.trim() || null, // campo livre — sem regex
      meta_pmoc,                                                 // ← JSONB estruturado
      user_id:              user?.id,
      assinatura_tecnico_url: lerAssinaturaURL(colab,'assinatura_url','assinatura_digital') || null,
      assinatura_fiscal_url:  assinatura_fiscal_url || null,
    };
    if (foto_url) payload.foto_url = foto_url;

    const idEdicao = $('pmoc-id-edicao')?.value;
    const { error } = idEdicao
      ? await db.from('fichas_pmoc').update(payload).eq('id', idEdicao)
      : await db.from('fichas_pmoc').insert([payload]);

    if (error) { msgForm('msg-ficha','Erro: ' + error.message,'red'); return; }
    msgForm('msg-ficha', idEdicao ? '✓ Ficha atualizada!' : '✓ PMOC salvo!', 'green');
    limparCanvasAssinatura();
    if ($('pmoc-obs')) $('pmoc-obs').value = '';
    if ($('pmoc-fiscal-nome')) $('pmoc-fiscal-nome').value = '';
    document.querySelectorAll('.pmoc-checklist-container input[type="radio"]').forEach(r => r.checked = false);
    resetarFormPMOC();
    carregarHistoricoFichas(); alternarSubAbasPMOC('hist');
  });
}

let _fichasCache = [];
async function carregarHistoricoFichas() {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  const { data } = await db.from('fichas_pmoc')
    .select('*, equipamentos(tag,marca,potencia,nr_serie,patrimonio,produto,bloco,setor,sala,categoria)')
    .order('created_at', { ascending: false });
  _fichasCache = data || [];
  renderHistoricoFichas(_fichasCache);
}

function filtrarHistoricoFichas() {
  const tag  = ($('filtro-hist-tag')?.value  || '').toLowerCase();
  const tipo = $('filtro-hist-tipo')?.value  || '';
  const freq = $('filtro-hist-freq')?.value  || '';
  renderHistoricoFichas(_fichasCache.filter(f =>
    (f.equipamentos?.tag||'').toLowerCase().includes(tag) &&
    (!tipo || lerMetaPMOC(f).tipo_equipamento === tipo) &&
    (!freq || lerMetaPMOC(f).frequencia === freq)
  ));
}

function renderHistoricoFichas(data) {
  const tbody = $('tbody-fichas'); if (!tbody) return;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Sem registros.</td></tr>'; return; }
  tbody.innerHTML = data.map(f => {
    const meta = lerMetaPMOC(f);
    const freq = meta.frequencia      || 'Mensal';
    const tipo = meta.tipo_equipamento || 'OUT';
    return `<tr>
      <td><strong>L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}</strong></td>
      <td>${fmtDate(f.created_at)}</td>
      <td><span class="tag-badge">${escapeHTML(f.equipamentos?.tag)}</span></td>
      <td><small>${escapeHTML(tipo)}</small></td>
      <td>${escapeHTML(f.tecnico_nome)}</td>
      <td><span class="tag-badge">${escapeHTML(freq)}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="emitirRelatorioPMOC('${btoa(unescape(encodeURIComponent(JSON.stringify(f))))}')">🖨️ Emitir</button>
        <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="editarFichaPMOC('${f.id}')">✏️ Editar</button>
        <button class="btn-excluir" style="padding:4px 10px;font-size:11px;" onclick="excluirFichaPMOC('${f.id}')">✕ Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

// ===================== IMPRESSÃO PMOC & OS =====================
function _assinaturaImg(url, style) {
  return url ? `<img src="${url}" style="${style}" alt="Assinatura">` : `<div style="height:55px;border-bottom:1px dashed #94a3b8;margin-bottom:4px;"></div>`;
}

function emitirRelatorioPMOC(b64) {
  const f  = JSON.parse(decodeURIComponent(escape(atob(b64))));
  const eq = f.equipamentos || {};
  // ── Lê meta_pmoc (novo JSONB) com fallback automático para observacoes legado ──
  const meta       = lerMetaPMOC(f);
  const dataInsp   = meta.data_inspecao   || fmtDate(f.created_at);
  const freq       = meta.frequencia      || '—';
  const tipo       = meta.tipo_equipamento|| '—';
  const fiscalNome = meta.fiscal_nome     || 'Fiscal Responsável';
  const checklist  = meta.checklist       || {};
  const obsLimpa   = meta._obsLimpa       || '';

  const labelChk = {
    'limpeza-filtro':'Limpeza de Filtro','limpeza-evaporadora':'Limpeza Evaporadora',
    'limpeza-condensadora':'Limpeza Condensadora','verificacao-dreno':'Verificação de Dreno',
    'verificacao-eletrica':'Verificação Elétrica','verificacao-fluido':'Verificação de Fluido',
    'teste-operacao':'Teste de Operação','verificacao-ruidos':'Verificação de Ruídos','limpeza-geral':'Limpeza Geral',
  };
  const statusChk = { OK:'<span class="ok">✓ OK</span>', NOK:'<span class="nok">✗ NOK</span>', NA:'<span class="na">N/A</span>' };
  const chkRows = Object.entries(checklist).map(([k,v]) =>
    `<tr><td>${labelChk[k]||k}</td><td style="text-align:center;">${statusChk[v]||v}</td></tr>`
  ).join('');

  const assinaturaTecnicoHTML = _assinaturaImg(lerAssinaturaURL(f,'assinatura_tecnico_url','assinatura_digital'),'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');
  const assinaturaFiscalHTML  = _assinaturaImg(lerAssinaturaURL(f,'assinatura_fiscal_url','assinatura_fiscal'), 'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');
  const urlValidacao = gerarUrlValidacao(f.id, 'pmoc');
  const qrCodeHTML   = gerarQrCodeSVG(urlValidacao, 100);
  const codigoLaudo  = `L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}`;
  const fotoHTML     = f.foto_url
    ? `<div class="laudo-section"><div class="laudo-section-title">Evidência Fotográfica</div><img src="${f.foto_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;"></div>`
    : '';

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div><h1>🏗️ PMOC — CONCREDUR</h1><p>Plano de Manutenção, Operação e Controle</p></div>
      <div class="laudo-header-meta">
        <strong>Código: ${codigoLaudo}</strong><br>
        Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}<br>
        Frequência: ${freq}
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">Identificação do Ativo</div>
      <div class="laudo-grid-3">
        <div class="laudo-field"><label>TAG</label><span>${escapeHTML(eq.tag)}</span></div>
        <div class="laudo-field"><label>Equipamento</label><span>${escapeHTML(eq.produto||tipo)}</span></div>
        <div class="laudo-field"><label>Marca</label><span>${escapeHTML(eq.marca)}</span></div>
        <div class="laudo-field"><label>Potência</label><span>${escapeHTML(eq.potencia)}</span></div>
        <div class="laudo-field"><label>Nº Série</label><span>${escapeHTML(eq.nr_serie)}</span></div>
        <div class="laudo-field"><label>Patrimônio</label><span>${escapeHTML(eq.patrimonio)}</span></div>
        <div class="laudo-field"><label>Bloco</label><span>${escapeHTML(eq.bloco)}</span></div>
        <div class="laudo-field"><label>Setor</label><span>${escapeHTML(eq.setor)}</span></div>
        <div class="laudo-field"><label>Sala</label><span>${escapeHTML(eq.sala)}</span></div>
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">Dados da Inspeção</div>
      <div class="laudo-grid">
        <div class="laudo-field"><label>Técnico Responsável</label><span>${escapeHTML(f.tecnico_nome)}</span></div>
        <div class="laudo-field"><label>Data da Inspeção</label><span>${escapeHTML(dataInsp)}</span></div>
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
      <p style="font-size:12px;line-height:1.6;">${escapeHTML(obsLimpa)}</p>
    </div>` : ''}
    ${fotoHTML}
    <div class="laudo-section">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;">
        <div style="display:flex;gap:32px;align-items:flex-end;flex:1;">
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaTecnicoHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(f.tecnico_nome)}<br>Técnico Executor</div>
          </div>
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaFiscalHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(fiscalNome)}<br>Fiscal / Validador do Serviço</div>
          </div>
        </div>
        <div style="text-align:center;flex-shrink:0;">
          ${qrCodeHTML}
          <div style="font-size:9px;color:#718096;margin-top:5px;font-weight:600;">AUTENTICIDADE DO DOCUMENTO</div>
          <div style="font-size:8px;color:#a0aec0;margin-top:2px;">${codigoLaudo}</div>
          <div style="font-size:8px;color:#a0aec0;">Aponte a câmera para verificar</div>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#a0aec0;">
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
  const assinaturaTecnicoHTML = _assinaturaImg(lerAssinaturaURL(col,'assinatura_url','assinatura_digital'),'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div><h1>🛠️ Ordem de Serviço — CONCREDUR</h1><p>Registro Técnico de Manutenção</p></div>
      <div class="laudo-header-meta">
        <strong>Código: ${codigoOS}</strong><br>
        Abertura: ${fmtDate(os.created_at)}<br>
        Emissão: ${new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">Ativo / Equipamento</div>
      <div class="laudo-grid">
        <div class="laudo-field"><label>TAG</label><span>${escapeHTML(eq.tag)}</span></div>
        <div class="laudo-field"><label>Equipamento</label><span>${escapeHTML(eq.produto)}</span></div>
        <div class="laudo-field"><label>Bloco / Setor</label><span>${escapeHTML(eq.bloco)} › ${escapeHTML(eq.setor)}</span></div>
        <div class="laudo-field"><label>Nº Série</label><span>${escapeHTML(eq.nr_serie)}</span></div>
      </div>
    </div>
    <div class="laudo-section">
      <div class="laudo-section-title">Dados da Intervenção</div>
      <div class="laudo-grid">
        <div class="laudo-field"><label>Técnico Responsável</label><span>${escapeHTML(col.nome)}</span></div>
        <div class="laudo-field"><label>Tipo de Manutenção</label><span>${escapeHTML(os.tipo_os)}</span></div>
        <div class="laudo-field"><label>Status</label><span>${escapeHTML(os.status_os)}</span></div>
      </div>
    </div>
    ${os.descricao_defeito ? `
    <div class="laudo-section">
      <div class="laudo-section-title">Descrição da Ocorrência</div>
      <p style="font-size:12px;line-height:1.7;min-height:60px;">${escapeHTML(os.descricao_defeito)}</p>
    </div>` : ''}
    <div class="laudo-section">
      <div class="laudo-section-title">Diagnóstico Técnico / Ações Executadas</div>
      <p style="font-size:12px;line-height:1.7;min-height:60px;">${escapeHTML(os.laudo_tecnico || 'Não informado.')}</p>
    </div>
    ${os.foto_url ? `<div class="laudo-section"><div class="laudo-section-title">Evidência Fotográfica</div><img src="${os.foto_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;"></div>` : ''}
    <div class="laudo-section">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div class="laudo-assinatura-box" style="min-width:200px;text-align:center;">
            ${assinaturaTecnicoHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(col.nome||'Técnico Responsável')}<br>Técnico Executor</div>
          </div>
        </div>
        <div style="text-align:center;flex-shrink:0;">
          ${qrCodeHTML}
          <div style="font-size:9px;color:#718096;margin-top:5px;font-weight:600;">AUTENTICIDADE DO DOCUMENTO</div>
          <div style="font-size:8px;color:#a0aec0;margin-top:2px;">${codigoOS}</div>
          <div style="font-size:8px;color:#a0aec0;">Aponte a câmera para verificar</div>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#a0aec0;">
        Sistema Concredur · ${new Date().toLocaleString('pt-BR')} · Verificação: ${urlValidacao}
      </div>
    </div>
  </div>`;
  imprimir('area-os-impressao', html);
}

// ===================== ORDENS DE SERVIÇO =====================
if ($('btn-salvar-os')) {
  $('btn-salvar-os').addEventListener('click', async () => {
    const payload = {
      equipamento_id:   $('os-equipamento').value,
      colaborador_id:   $('os-tecnico').value,
      tipo_os:          $('os-tipo').value,
      status_os:        $('os-status').value,
      descricao_defeito: $('os-defeito').value.trim(),
      laudo_tecnico:    $('os-laudo').value.trim(),
    };
    const idEd = $('os-id-edicao').value;
    const { error } = idEd
      ? await db.from('ordens_servico').update(payload).eq('id', idEd)
      : await db.from('ordens_servico').insert([payload]);
    if (!error) { resetarFormOS(); carregarOrdensServico(); carregarCentralUnificadaOS(); }
  });
}

async function carregarOrdensServico() {
  const tbody = $('tbody-os'); if (!tbody) return;
  const { data } = await db.from('ordens_servico')
    .select('*, equipamentos(tag,produto,bloco,setor,nr_serie), colaboradores(nome,assinatura_url,assinatura_digital)')
    .order('created_at', { ascending: false });
  tbody.innerHTML = (data||[]).map(os => {
    // Bug 3 fix: serializar o objeto completo em base64 para o botão de impressão
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    // Bug 3 fix: serializar campos de texto como JSON para data-attributes
    // evita quebra por aspas simples/duplas/crases dentro dos valores
    const osDataB64 = btoa(unescape(encodeURIComponent(JSON.stringify({
      id:    os.id,
      eqId:  os.equipamento_id  || '',
      colId: os.colaborador_id  || '',
      tipo:  os.tipo_os         || '',
      st:    os.status_os       || '',
      def:   os.descricao_defeito || '',
      laud:  os.laudo_tecnico   || '',
    }))));
    return `<tr>
      <td><strong>OS-AC-${os.id.toString().slice(0,5).toUpperCase()}</strong></td>
      <td>${fmtDate(os.created_at)}</td>
      <td><span class="tag-badge">${escapeHTML(os.equipamentos?.tag)}</span></td>
      <td>${escapeHTML(os.colaboradores?.nome)}</td>
      <td>${escapeHTML(os.tipo_os)}</td>
      <td>${statusBadge(os.status_os)}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="btn-primary" style="padding:4px 10px;font-size:11px;"
          onclick="emitirRelatorioOS(JSON.parse(decodeURIComponent(escape(atob('${b64}')))))">🖨️ Imprimir</button>
        <button class="btn-secondary" style="padding:4px 10px;font-size:11px;"
          onclick="_editarOSFromB64('${osDataB64}')">✏️ Editar</button>
        <button class="btn-excluir" style="padding:4px 10px;font-size:11px;"
          onclick="excluirOS('${os.id}')">✕ Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

// Bug 3 fix: helper que desserializa os dados da OS antes de chamar editarOS
function _editarOSFromB64(b64) {
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(b64))));
    editarOS(d.id, d.eqId, d.colId, d.tipo, d.st, d.def, d.laud);
  } catch(e) { console.error('_editarOSFromB64 falhou:', e); }
}

// ===================== FACILITIES =====================
if ($('btn-salvar-osg')) {
  $('btn-salvar-osg').addEventListener('click', async () => {
    const payload = {
      setor:               $('osg-setor').value,
      servico_requisitado: $('osg-requisitado').value,
      falha_relatada:      $('osg-falha').value,
      status_os:           $('osg-status').value,
    };
    const { error } = await db.from('ordens_servico_geral').insert([payload]);
    if (!error) { resetarFormOSG(); carregarOSGeral(); carregarCentralUnificadaOS(); }
  });
}

async function carregarOSGeral() {
  const tbody = $('tbody-osg'); if (!tbody) return;
  const { data } = await db.from('ordens_servico_geral').select('*').order('created_at', { ascending: false });
  tbody.innerHTML = (data||[]).map(os => `<tr>
    <td><strong>${escapeHTML(os.numero_os||'OSG')}</strong></td>
    <td>${fmtDate(os.created_at)}</td>
    <td>${escapeHTML(os.setor)}</td>
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
  const { data: g  } = await db.from('ordens_servico_geral').select('id,created_at,tipo_manutencao,status_os,servico_requisitado,numero_os').limit(20);
  const linhas = [
    ...(ac||[]).map(d => ({ id:'OS-AC-'+d.id.toString().slice(0,5).toUpperCase(), data:d.created_at, mod:'Refrigeração', cat:d.tipo_os, st:d.status_os })),
    ...(g ||[]).map(d => ({ id:d.numero_os||'OSG', data:d.created_at, mod:'Facilities', cat:d.tipo_manutencao, st:d.status_os })),
  ].sort((a,b) => new Date(b.data)-new Date(a.data));
  tbody.innerHTML = linhas.map(l =>
    `<tr>
      <td><strong>${escapeHTML(l.id)}</strong></td>
      <td>${fmtDate(l.data)}</td>
      <td>${escapeHTML(l.mod)}</td>
      <td>${escapeHTML(l.cat)}</td>
      <td>${statusBadge(l.st)}</td>
    </tr>`
  ).join('');
}

// ===================== GESTÃO DE USUÁRIOS =====================
if ($('btn-admin-salvar-usuario')) {
  $('btn-admin-salvar-usuario').addEventListener('click', async () => {
    const email = $('adm-user-email')?.value.trim();
    const cpf   = $('adm-user-cpf')?.value.trim();
    const role  = $('adm-user-role')?.value;
    const nome  = $('adm-user-nome')?.value.trim();
    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'none';
    if (!email || !nome || !cpf || !validarCPF(cpf)) {
      msgForm('msg-admin-usuario', 'Campos obrigatórios inválidos.', 'red'); return;
    }
    msgForm('msg-admin-usuario', 'Inserindo credenciais no banco público...', 'blue');
    const novoId = crypto.randomUUID();
    const { error } = await db.from('profiles').insert([{ id:novoId, email, nome, role, cpf:cpf.replace(/\D/g,''), status:'pendente' }]);
    if (error) { msgForm('msg-admin-usuario', 'Erro: ' + error.message, 'red'); return; }
    const tokenWhatsApp = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar_direto`;
    if ($('adm-link-gerado'))     $('adm-link-gerado').value     = tokenWhatsApp;
    if ($('wrapper-link-ativacao')) $('wrapper-link-ativacao').style.display = 'block';
    msgForm('msg-admin-usuario', '✓ Pré-cadastro efetuado com sucesso!', 'green');
    $('adm-user-email').value = ''; $('adm-user-cpf').value = ''; $('adm-user-nome').value = '';
    carregarUsuariosSistema();
  });
}

async function carregarUsuariosSistema() {
  const tbody = $('tbody-usuarios-sistema'); if (!tbody) return;
  const { data: { user: userAtual } } = await db.auth.getUser();
  const { data: perfis } = await db.from('profiles').select('*').order('email', { ascending: true });
  let lista = perfis || [];
  const adminNaLista = lista.some(u => u.email === userAtual?.email);
  if (userAtual?.email && !adminNaLista) {
    lista = [{ id:userAtual.id, email:userAtual.email, role:'admin', nome:'Administrador', cpf:null, status:'ativo', _isCurrentUser:true }, ...lista];
  } else if (userAtual?.email) {
    lista = lista.map(u => u.email === userAtual.email ? { ...u, _isCurrentUser:true } : u);
  }
  const roleBadge = {
    admin:   '<span class="tag-badge danger">🛡️ Admin</span>',
    master:  '<span class="tag-badge warning">👨‍💻 Master</span>',
    tecnico: '<span class="tag-badge">🔬 Técnico</span>',
    auditor: '<span class="tag-badge" style="background:#f3e8ff;color:#7c3aed;">👁️ Auditor</span>',
  };
  const statusBadgeUser = {
    ativo:    '<span class="tag-badge success">● Ativo</span>',
    pendente: '<span class="tag-badge warning">⏳ Aguardando</span>',
  };
  tbody.innerHTML = lista.map(u => {
    const isVoce = !!u._isCurrentUser;
    return `<tr${isVoce ? ' style="background:#f0f7ff;"' : ''}>
      <td>
        <strong>${escapeHTML(u.nome||u.email)}</strong>
        ${isVoce ? '<span class="tag-badge" style="background:#dbeafe;color:#1e40af;margin-left:6px;font-size:10px;">Você</span>' : ''}
        <br><small style="color:#a0aec0;">${escapeHTML(u.email)}</small>
      </td>
      <td>${u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
      <td>${roleBadge[u.role]||`<span>${escapeHTML(u.role||'—')}</span>`}</td>
      <td>${statusBadgeUser[u.status]||statusBadgeUser['ativo']}</td>
      <td>${isVoce ? '—' : `<button class="btn-excluir" onclick="excluirPerfil('${u.id}','${escapeHTML(u.email)}')">✕ Revogar</button>${u.status==='pendente'?` <button class="btn-primary" style="padding:3px 8px;font-size:11px;margin-left:4px;background:#d97706;border-color:#d97706;" onclick="reenviarConvite('${escapeHTML(u.email)}')">↺ Link</button>`:''}`}</td>
    </tr>`;
  }).join('');
}

async function excluirPerfil(id, email) {
  if (confirm(`Revogar acesso de "${email}"?`)) { await db.from('profiles').delete().eq('id', id); carregarUsuariosSistema(); }
}
function reenviarConvite(email) {
  if ($('wrapper-link-ativacao') && $('adm-link-gerado')) {
    $('adm-link-gerado').value = `${window.location.origin}/index.html?email=${encodeURIComponent(email)}&token=ativar_direto`;
    $('wrapper-link-ativacao').style.display = 'block';
    $('wrapper-link-ativacao').scrollIntoView({ behavior:'smooth' });
  }
}

// ===================== VALIDAÇÃO CPF =====================
function validarCPF(cpf) {
  const s = cpf.replace(/\D/g,'');
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0; if (r !== parseInt(s[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  r = (soma * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === parseInt(s[10]);
}

// ===================== CONTROLLERS =====================
function alternarSubAbasPMOC(m) {
  if ($('sub-pmoc-form'))      $('sub-pmoc-form').style.display      = m === 'form' ? 'block' : 'none';
  if ($('sub-pmoc-historico')) $('sub-pmoc-historico').style.display = m === 'hist' ? 'block' : 'none';
  if (m === 'hist') carregarHistoricoFichas();
}
function alternarSubAbasOS(m) {
  if ($('sub-os-ac'))      $('sub-os-ac').style.display      = m === 'ac'      ? 'block' : 'none';
  if ($('sub-os-fac'))     $('sub-os-fac').style.display     = m === 'fac'     ? 'block' : 'none';
  if ($('sub-os-central')) $('sub-os-central').style.display = m === 'central' ? 'block' : 'none';
  if (m === 'central') carregarCentralUnificadaOS();
}
function alternarSubAbasRH(m) {
  if ($('sub-rh-usuarios')) $('sub-rh-usuarios').style.display = m === 'usuarios' ? 'block' : 'none';
  if ($('sub-rh-colab'))    $('sub-rh-colab').style.display    = m === 'colab'    ? 'block' : 'none';
  if ($('sub-rh-cargo'))    $('sub-rh-cargo').style.display    = m === 'cargo'    ? 'block' : 'none';
}
function resetarFormOS()  { ['os-defeito','os-laudo','os-id-edicao'].forEach(id => { if ($(id)) $(id).value = ''; }); }
function resetarFormOSG() { ['osg-setor','osg-requisitado','osg-falha'].forEach(id => { if ($(id)) $(id).value = ''; }); }

// ===================== QR CODE =====================
function gerarQrCodeSVG(texto, tamanho = 120) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${tamanho}x${tamanho}&data=${encodeURIComponent(texto)}&format=svg&margin=4`;
  return `<img src="${url}" width="${tamanho}" height="${tamanho}" alt="QR Code de Validação" style="display:block;border:1px solid #e2e8f0;border-radius:4px;background:#fff;">`;
}

function gerarUrlValidacao(id, tipo) {
  const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
  return `${base}/verificar.html?id=${id}&tipo=${tipo}`;
}

async function exibirJanelaQRCode(qrcodeToken, tag, eqId) {
  // Recupera do cache global; se não houver, busca direto do banco
  let eq = globalEquipamentos.find(e => String(e.id) === String(eqId));
  if (!eq) {
    const { data } = await db.from('equipamentos').select('*').eq('id', eqId).single();
    eq = data || {};
  }
  const url = gerarUrlValidacao(qrcodeToken, 'equipamento');
  _abrirJanelaEtiqueta([{ eq, url }]);
}

// Imprime etiquetas de múltiplos equipamentos de uma vez (4 por folha A4)
async function imprimirTodasEtiquetas() {
  // Garante que o cache esteja populado
  if (!globalEquipamentos.length) {
    const { data } = await db.from('equipamentos').select('*').order('tag', { ascending: true });
    globalEquipamentos = data || [];
  }
  const comToken = globalEquipamentos.filter(e => e.qrcode_token);
  if (!comToken.length) { alert('Nenhum ativo com QR Code cadastrado.'); return; }
  const lista = comToken.map(eq => ({ eq, url: gerarUrlValidacao(eq.qrcode_token, 'equipamento') }));
  _abrirJanelaEtiqueta(lista);
}

function _abrirJanelaEtiqueta(lista) {
  const catLabel = {
    AC:'❄️ Ar Condicionado', BEB:'💧 Bebedouro',
    CLIM:'🌀 Climatizador', VEN:'💨 Ventilador/Exaustor', OUT:'🔧 Outros',
  };
  const catTitulo = {
    AC:'AR CONDICIONADO', BEB:'BEBEDOURO',
    CLIM:'CLIMATIZADOR', VEN:'VENTILAÇÃO / EXAUSTÃO', OUT:'EQUIPAMENTO',
  };
  const QR_SIZE = 150;

  const etiquetasHTML = lista.map(({ eq, url }) => {
    const tag      = eq.tag      || '—';
    const catNome  = catLabel[eq.categoria]  || '🔧 Equipamento';
    const titulo   = catTitulo[eq.categoria] || 'EQUIPAMENTO';
    const qrSrc    = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(url)}&format=png&margin=2`;

    return `
    <div class="etiqueta">
      <div class="etq-top">
        <div class="etq-logo"><img src="${LOGO_ETIQUETA}" alt="Logo"></div>
        <div class="etq-titulo">
          MANUTENÇÃO<br>${titulo}
        </div>
      </div>

      <div class="etq-meta">
        <div class="etq-codigo">${tag}</div>
        <div class="etq-categoria">${catNome}</div>
      </div>

      <div class="etq-divider"></div>

      <div class="etq-body">
        <div class="etq-qr">
          <img src="${qrSrc}" width="${QR_SIZE}" height="${QR_SIZE}" alt="QR ${tag}">
        </div>
        <div class="etq-info">
          <div class="etq-info-titulo">INFORMAÇÕES DO ATIVO</div>
          <div class="etq-info-texto">Aponte a câmera do celular para verificar histórico de manutenções, especificações técnicas e dados completos deste equipamento.</div>
          <div class="etq-url">${url}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const isSingle = lista.length === 1;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta${lista.length > 1 ? 's' : ''} — Concredur</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background: #e2e8f0; padding: 24px; color: #1a202c; }

    .toolbar {
      max-width: 960px; margin: 0 auto 20px;
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      background: #fff; padding: 14px 20px; border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
    }
    .toolbar h2 { font-size: 15px; font-weight: 700; flex: 1; }
    .toolbar small { font-size: 11px; color: #718096; display: block; margin-top: 2px; }
    .btn-imp { background: #1e3a5f; color: #fff; border: none; border-radius: 7px;
               padding: 9px 22px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-imp:hover { background: #16304d; }
    .btn-sec { background: #fff; color: #4a5568; border: 1px solid #e2e8f0;
               border-radius: 7px; padding: 8px 18px; font-size: 13px; cursor: pointer; }

    .grade { max-width: 960px; margin: 0 auto;
             display: grid; grid-template-columns: ${isSingle ? '1fr' : 'repeat(2, 1fr)'}; gap: 18px; }

    /* ── Etiqueta no padrão do modelo ── */
    .etiqueta {
      background: #fff;
      border: 2.5px solid #1e3a5f;
      border-radius: 16px;
      overflow: hidden;
      ${isSingle ? 'max-width: 540px; margin: 0 auto;' : ''}
    }

    .etq-top {
      display: flex; align-items: center; gap: 20px;
      background: #1e3a5f;
      padding: 18px 26px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .etq-logo img { height: 40px; width: auto; display: block; }
    .etq-titulo {
      font-size: 20px; font-weight: 800; line-height: 1.15;
      color: #fff; letter-spacing: 0.01em;
    }

    .etq-meta {
      display: flex; align-items: center; justify-content: space-between;
      gap: 14px; padding: 18px 26px 14px; flex-wrap: wrap;
    }
    .etq-codigo {
      font-size: 26px; font-weight: 800; letter-spacing: 0.16em;
      color: #1a202c;
    }
    .etq-categoria {
      border: 1.5px solid #1e3a5f; border-radius: 999px;
      padding: 8px 18px; font-size: 14px; font-weight: 700; color: #1e3a5f;
      white-space: nowrap;
    }

    .etq-divider { border-top: 2px solid #e8edf3; margin: 0 26px 18px; }

    .etq-body { display: flex; gap: 22px; align-items: flex-start; padding: 0 26px 22px; }
    .etq-qr { flex-shrink: 0; }
    .etq-qr img { display: block; }
    .etq-info { flex: 1; min-width: 0; }
    .etq-info-titulo {
      font-size: 16px; font-weight: 800; color: #1e3a5f;
      letter-spacing: 0.03em; margin-bottom: 8px;
    }
    .etq-info-texto { font-size: 13px; line-height: 1.55; color: #4a5568; margin-bottom: 10px; }
    .etq-url { font-size: 10.5px; color: #94a3b8; word-break: break-all; line-height: 1.4; }

    @media print {
      body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none !important; }
      .grade { max-width: 100%; gap: 8mm;
               grid-template-columns: ${isSingle ? '1fr' : 'repeat(2, 1fr)'}; }
      .etiqueta { break-inside: avoid; ${isSingle ? 'max-width: 150mm; margin: 0 auto;' : ''} }
      @page { margin: 10mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <h2>🏷️ Etiqueta${lista.length > 1 ? 's' : ''} de Ativo${lista.length > 1 ? 's' : ''}</h2>
      <small>${lista.length} etiqueta${lista.length > 1 ? 's' : ''} · QR Code de autenticidade</small>
    </div>
    <button class="btn-sec" onclick="window.close()">✕ Fechar</button>
    <button class="btn-imp" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
  </div>
  <div class="grade">
    ${etiquetasHTML}
  </div>
  <script>
    ${isSingle ? `
    const imgs = document.querySelectorAll('img');
    let n = 0;
    imgs.forEach(i => {
      if (i.complete) { if (++n === imgs.length) setTimeout(() => window.print(), 400); }
      else i.addEventListener('load', () => { if (++n === imgs.length) setTimeout(() => window.print(), 400); });
    });` : ''}
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank', `width=${isSingle ? 620 : 1000},height=720`);
  if (!win) { alert('Permita pop-ups neste site para abrir a etiqueta de impressão.'); return; }
  win.document.write(html);
  win.document.close();
}

// ===================== IMPRESSÃO =====================
function imprimir(areaId, html) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Permita pop-ups para imprimir os laudos.'); return; }
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Concredur — Impressão</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}@page{margin:14mm;size:A4 portrait}html,body{font-family:'Inter',Arial,sans-serif;font-size:12px;color:#1a202c;background:#fff}.laudo-wrapper{width:100%}.laudo-header{background:#1a56db;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0}.laudo-header h1{font-size:18px;font-weight:700}.laudo-header p{font-size:11px;margin-top:4px;opacity:.85}.laudo-header-meta{text-align:right;font-size:11px}.laudo-section{border:1px solid #e2e8f0;border-top:none;padding:12px 16px;break-inside:avoid}.laudo-section:last-child{border-radius:0 0 6px 6px}.laudo-section-title{font-size:10px;font-weight:700;color:#1a56db;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}.laudo-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.laudo-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px}.laudo-field{margin-bottom:4px}.laudo-field label{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:.06em;display:block}.laudo-field span{font-size:12px;font-weight:600;color:#1a202c}.laudo-checklist-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px}.laudo-checklist-table th{background:#1a56db;color:#fff;padding:5px 8px;text-align:left;font-size:10px}.laudo-checklist-table td{padding:4px 8px;border-bottom:1px solid #e2e8f0}.laudo-checklist-table tr:nth-child(even) td{background:#f8fafc}.ok{color:#059669;font-weight:700}.nok{color:#dc2626;font-weight:700}.na{color:#a0aec0}.laudo-assinatura-box{text-align:center;min-width:180px}.laudo-assinatura-linha{border-top:1px solid #1a202c;margin-top:8px;padding-top:4px;font-size:10px;color:#4a5568}img{max-width:100%;height:auto;display:block}.tag-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#e2e8f0;color:#2d3748}.tag-badge.success{background:#d1fae5;color:#065f46}.tag-badge.warning{background:#fef3c7;color:#92400e}.tag-badge.danger{background:#fee2e2;color:#991b1b}.tag-badge.andamento{background:#dbeafe;color:#1e40af}</style></head>
  <body>${html}<script>window.addEventListener('load',function(){setTimeout(function(){window.print();window.addEventListener('afterprint',function(){window.close();});},400);});<\/script></body></html>`);
  win.document.close();
}

// ===================== LOGIN =====================
if ($('btn-login')) {
  const paramsUrl = new URLSearchParams(window.location.search);
  let fluxoAtivacaoDireta = false;
  let emailAlvoAtivacao   = '';

  // Modo ativação direta via link (token=ativar_direto na URL)
  if (paramsUrl.get('email') && paramsUrl.get('token') === 'ativar_direto') {
    fluxoAtivacaoDireta = true;
    emailAlvoAtivacao   = decodeURIComponent(paramsUrl.get('email'));
    if ($('email'))              { $('email').value = emailAlvoAtivacao; $('email').readOnly = true; }
    if ($('login-password-group')) $('login-password-group').style.display = 'flex';
    if ($('link-recuperar'))     $('link-recuperar').style.display = 'none';
    if ($('link-voltar'))        $('link-voltar').style.display    = 'inline';
    if ($('login-title'))        $('login-title').textContent  = 'Criar Senha de Acesso';
    if ($('login-desc'))         $('login-desc').textContent   = 'Defina sua senha definitiva para ativar sua conta.';
    if ($('lbl-password'))       $('lbl-password').textContent = 'Nova Senha Definitiva';
    const btnEl = $('btn-login');
    if (btnEl) { btnEl.textContent = '✓ Ativar e Entrar'; }
  }

  $('btn-login').addEventListener('click', async () => {
    const email = $('email')?.value.trim();
    const senha = $('password')?.value;
    const msgEl = $('mensagem');

    if (!email) { if (msgEl) msgEl.textContent = 'Informe o e-mail.'; return; }

    // Modo recuperação de senha
    if (modoRecuperacao) {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/index.html`,
      });
      if (msgEl) msgEl.textContent = error
        ? 'Erro: ' + error.message
        : '✅ Link enviado! Verifique seu e-mail.';
      return;
    }

    // Modo ativação direta
    if (fluxoAtivacaoDireta) {
      if (!senha || senha.length < 6) {
        if (msgEl) msgEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
        return;
      }
      if (msgEl) msgEl.textContent = 'Ativando conta...';

      // Tenta criar — se já existe, faz login direto
      const { error: signUpErr } = await db.auth.signUp({ email: emailAlvoAtivacao, password: senha });
      if (signUpErr && !signUpErr.message.includes('already registered')) {
        if (msgEl) msgEl.textContent = 'Erro: ' + signUpErr.message;
        return;
      }

      const { data: sinData, error: sinErr } = await db.auth.signInWithPassword({
        email: emailAlvoAtivacao, password: senha,
      });
      if (sinErr)        { if (msgEl) msgEl.textContent = 'Erro: ' + sinErr.message; return; }
      if (!sinData?.user){ if (msgEl) msgEl.textContent = '⚠️ E-mail não confirmado no Supabase.'; return; }

      window.location.href = 'dashboard.html';
      return;
    }

    // Modo login normal
    if (msgEl) msgEl.textContent = '';
    const { data, error } = await db.auth.signInWithPassword({ email, password: senha });

    if (error) {
      if (msgEl) msgEl.textContent = 'Credenciais inválidas. Verifique e tente novamente.';
      return;
    }

    if (!data?.user) {
      if (msgEl) msgEl.textContent = '⚠️ E-mail não confirmado. Confirme no painel do Supabase → Authentication → Users.';
      return;
    }

    // Login OK — redireciona imediatamente
    window.location.href = 'dashboard.html';
  });
}

// ===================== DASHBOARD =====================
const CHART_DEFAULTS = { responsive:true, maintainAspectRatio:true, devicePixelRatio:2 };

async function renderizarGraficosDashboard() {
  // ── Tenta views SQL (Fase 4); fallback para queries diretas se views não existirem ──
  let resumo = null;
  const { data: resumoView, error: erroView } = await db.from('vw_dashboard_resumo').select('*').single();

  if (!erroView && resumoView) {
    resumo = resumoView;
  } else {
    try {
      const resultados = await Promise.allSettled([
        db.from('equipamentos').select('*', { count:'exact', head:true }),
        db.from('fichas_pmoc').select('*', { count:'exact', head:true }),
        db.from('ordens_servico').select('*', { count:'exact', head:true }).in('status_os', ['Aberta','Em Andamento']),
        db.from('ordens_servico').select('*', { count:'exact', head:true }).eq('status_os', 'Concluída'),
        db.from('ordens_servico_geral').select('*', { count:'exact', head:true }).in('status_os', ['Aberta','Em Andamento']),
        db.from('ordens_servico_geral').select('*', { count:'exact', head:true }).eq('status_os', 'Concluída'),
      ]);
      const val = (i) => resultados[i].status === 'fulfilled' ? (resultados[i].value?.count ?? 0) : 0;
      resumo = {
        total_ativos:  val(0),
        total_pmocs:   val(1),
        os_pendentes:  val(2) + val(4),
        os_concluidas: val(3) + val(5),
      };
    } catch(e) {
      console.warn('Dashboard fallback falhou:', e.message);
      resumo = { total_ativos:0, total_pmocs:0, os_pendentes:0, os_concluidas:0 };
    }
  }

  const r = resumo || {};
  if ($('dash-txt-ativos'))      $('dash-txt-ativos').textContent      = r.total_ativos  ?? '0';
  if ($('dash-txt-fichas'))      $('dash-txt-fichas').textContent      = r.total_pmocs   ?? '0';
  if ($('dash-txt-os-abertas'))  $('dash-txt-os-abertas').textContent  = r.os_pendentes  ?? '0';
  if ($('dash-txt-os-fechadas')) $('dash-txt-os-fechadas').textContent = r.os_concluidas ?? '0';

  // Gráfico 1 — Volumetria OS (view com fallback)
  let volOS = null;
  const { data: volOSView, error: erroVol } = await db.from('vw_dashboard_volumetria_os').select('*');
  if (!erroVol && volOSView) {
    volOS = volOSView;
  } else {
    try {
      const [r1, r2] = await Promise.allSettled([
        db.from('ordens_servico').select('status_os'),
        db.from('ordens_servico_geral').select('status_os'),
      ]);
      const osAC  = r1.status === 'fulfilled' ? (r1.value?.data || []) : [];
      const osFac = r2.status === 'fulfilled' ? (r2.value?.data || []) : [];
      const map = {};
      [...osAC, ...osFac].forEach(o => { map[o.status_os] = (map[o.status_os]||0)+1; });
      volOS = Object.entries(map).map(([status_os,total]) => ({ status_os, total }));
    } catch(e) { console.warn('Fallback volOS falhou:', e.message); volOS = []; }
  }
  if ($('chartStatusOS') && volOS) {
    const cnt = { Aberta:0, 'Em Andamento':0, Concluida:0 };
    volOS.forEach(row => {
      if (row.status_os === 'Aberta')            cnt.Aberta            += Number(row.total);
      else if (row.status_os === 'Em Andamento') cnt['Em Andamento']   += Number(row.total);
      else if (row.status_os === 'Concluída')    cnt.Concluida         += Number(row.total);
    });
    if (chartOS) chartOS.destroy();
    chartOS = new Chart($('chartStatusOS'), {
      type: 'doughnut',
      data: { labels:['Aberta / Pendente','Em Andamento','Concluída'], datasets:[{ data:[cnt.Aberta,cnt['Em Andamento'],cnt.Concluida], backgroundColor:['#f59e0b','#3b82f6','#10b981'], borderColor:'#fff', borderWidth:3, hoverOffset:8 }] },
      options: { ...CHART_DEFAULTS, cutout:'62%', plugins:{ legend:{ position:'bottom', labels:{ padding:16, font:{ size:13 }, usePointStyle:true } }, tooltip:{ callbacks:{ label: c => ` ${c.label}: ${c.parsed} O.S.` } } } },
    });
  }

  // Gráfico 2 — Criticidade (view com fallback)
  let critData = null;
  const { data: critView, error: erroCrit } = await db.from('vw_dashboard_criticidade').select('*');
  if (!erroCrit && critView) {
    critData = critView;
  } else {
    try {
      const { data: eqCrit } = await db.from('equipamentos').select('criticidade');
      const map = {};
      (eqCrit||[]).forEach(e => { map[e.criticidade||'Média'] = (map[e.criticidade||'Média']||0)+1; });
      critData = Object.entries(map).map(([criticidade,total]) => ({ criticidade, total }));
    } catch(e) { console.warn('Fallback critData falhou:', e.message); critData = []; }
  }
  if ($('chartCriticidade') && critData) {
    const cnt = { Alta:0, Media:0, Baixa:0 };
    critData.forEach(row => {
      if (row.criticidade === 'Alta')       cnt.Alta  += Number(row.total);
      else if (row.criticidade === 'Média') cnt.Media += Number(row.total);
      else if (row.criticidade === 'Baixa') cnt.Baixa += Number(row.total);
    });
    if (chartCrit) chartCrit.destroy();
    chartCrit = new Chart($('chartCriticidade'), {
      type: 'bar',
      data: { labels:['Alta (A)','Média (B)','Baixa (C)'], datasets:[{ data:[cnt.Alta,cnt.Media,cnt.Baixa], backgroundColor:['rgba(239,68,68,.85)','rgba(245,158,11,.85)','rgba(16,185,129,.85)'], borderColor:['#ef4444','#f59e0b','#10b981'], borderWidth:2, borderRadius:6, borderSkipped:false }] },
      options: { ...CHART_DEFAULTS, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: c => ` ${c.parsed.y} ativo(s)` } } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1, font:{ size:12 } }, grid:{ color:'rgba(0,0,0,.05)' } }, x:{ ticks:{ font:{ size:12 } }, grid:{ display:false } } } },
    });
  }

  // Gráfico 3 — Facilities (view com fallback)
  let facData = null;
  const { data: facView, error: erroFac } = await db.from('vw_dashboard_facilities').select('*');
  if (!erroFac && facView) {
    facData = facView;
  } else {
    try {
      const { data: osFac } = await db.from('ordens_servico_geral').select('status_os');
      const map = {};
      (osFac||[]).forEach(o => { map[o.status_os] = (map[o.status_os]||0)+1; });
      facData = Object.entries(map).map(([status_os,total]) => ({ status_os, total }));
    } catch(e) { console.warn('Fallback facData falhou:', e.message); facData = []; }
  }
  if ($('chartStatusOSG') && facData) {
    const cnt = { Aberta:0, 'Em Andamento':0, Concluida:0 };
    facData.forEach(row => {
      if (row.status_os === 'Aberta')            cnt.Aberta          += Number(row.total);
      else if (row.status_os === 'Em Andamento') cnt['Em Andamento'] += Number(row.total);
      else if (row.status_os === 'Concluída')    cnt.Concluida       += Number(row.total);
    });
    if (chartOSG) chartOSG.destroy();
    chartOSG = new Chart($('chartStatusOSG'), {
      type: 'bar',
      data: { labels:['Aberta','Em Andamento','Concluída'], datasets:[{ data:[cnt.Aberta,cnt['Em Andamento'],cnt.Concluida], backgroundColor:['rgba(245,158,11,.85)','rgba(139,92,246,.85)','rgba(16,185,129,.85)'], borderColor:['#f59e0b','#8b5cf6','#10b981'], borderWidth:2, borderRadius:6, borderSkipped:false }] },
      options: { ...CHART_DEFAULTS, indexAxis:'y', plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: c => ` ${c.parsed.x} O.S.` } } }, scales:{ x:{ beginAtZero:true, ticks:{ stepSize:1, font:{ size:12 } }, grid:{ color:'rgba(0,0,0,.05)' } }, y:{ ticks:{ font:{ size:13 } }, grid:{ display:false } } } },
    });
  }

  // Logs recentes (view com fallback)
  let logs = null;
  const { data: logsView, error: erroLogs } = await db.from('vw_dashboard_logs_recentes').select('*').limit(8);
  if (!erroLogs && logsView) {
    logs = logsView;
  } else {
    try {
      const [r1, r2] = await Promise.allSettled([
        db.from('ordens_servico').select('created_at,status_os,tipo_os,equipamentos(tag)').order('created_at',{ascending:false}).limit(5),
        db.from('ordens_servico_geral').select('created_at,status_os,servico_requisitado,setor').order('created_at',{ascending:false}).limit(5),
      ]);
      const logsAC  = r1.status === 'fulfilled' ? (r1.value?.data || []) : [];
      const logsFac = r2.status === 'fulfilled' ? (r2.value?.data || []) : [];
      logs = [
        ...logsAC.map(l =>({ data:l.created_at, status:l.status_os, desc:l.tipo_os||'—', ref:l.equipamentos?.tag||'—', origem:'❄️' })),
        ...logsFac.map(l=>({ data:l.created_at, status:l.status_os, desc:l.servico_requisitado||'—', ref:l.setor||'—', origem:'🏢' })),
      ].sort((a,b)=>new Date(b.data)-new Date(a.data)).slice(0,8);
    } catch(e) { console.warn('Fallback logs falhou:', e.message); logs = []; }
  }
  const el = $('dash-atividades');
  if (el && logs) {
    el.innerHTML = logs.length ? logs.map(l =>
      `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:10px;color:#a0aec0;min-width:70px;">${fmtDate(l.data)}</span>
        <span style="font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHTML(l.origem)}</span>
        <strong style="font-size:13px;">${escapeHTML(l.ref)}</strong>
        <span style="color:#4a5568;font-size:12px;flex:1;">${escapeHTML(l.desc)}</span>
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
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="td-loading">Nenhuma manutenção agendada.</td></tr>'; return;
  }
  const hj = new Date(); hj.setHours(0,0,0,0);
  tbody.innerHTML = data.map(f => {
    const dt   = new Date(f.proxima_manutencao + 'T00:00:00');
    const diff = Math.ceil((dt - hj) / (1000*60*60*24));
    const status = diff < 0
      ? '<span class="tag-badge danger">Vencida</span>'
      : diff <= 7 ? '<span class="tag-badge warning">Urgente</span>'
      : '<span class="tag-badge success">Programada</span>';
    return `<tr>
      <td><span class="tag-badge">${escapeHTML(f.equipamentos?.tag)}</span></td>
      <td>${escapeHTML(f.equipamentos?.bloco)}</td>
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

  const hj   = new Date(); hj.setHours(0,0,0,0);
  const em30 = new Date(hj); em30.setDate(em30.getDate() + 30);

  const [{ data: fichas }, { data: eqsValidade }] = await Promise.all([
    db.from('fichas_pmoc').select('proxima_manutencao, equipamentos(tag,bloco,produto,categoria)')
      .not('proxima_manutencao','is',null)
      .lte('proxima_manutencao', em30.toISOString().split('T')[0])
      .order('proxima_manutencao', { ascending: true }),
    db.from('equipamentos').select('tag,bloco,categoria,produto,validade').not('validade','is',null),
  ]);

  const alertas = [];
  (fichas||[]).forEach(f => {
    const dt   = new Date(f.proxima_manutencao + 'T00:00:00');
    const diff = Math.ceil((dt - hj) / (1000*60*60*24));
    if (diff > 30) return;
    alertas.push({ tipo: diff < 0 ? 'vencida' : diff <= 7 ? 'urgente' : 'proxima', diff, tag: f.equipamentos?.tag||'—', local: f.equipamentos?.bloco||'—', descricao: `Manutenção PMOC — ${f.equipamentos?.produto||f.equipamentos?.categoria||'Equipamento'}`, data: f.proxima_manutencao });
  });
  (eqsValidade||[]).forEach(b => {
    if (!b.validade) return;
    const dt   = new Date(b.validade + 'T00:00:00');
    const diff = Math.ceil((dt - hj) / (1000*60*60*24));
    if (diff > 30) return;
    const cat = b.categoria || '';
    alertas.push({ tipo: diff < 0 ? 'vencida' : diff <= 7 ? 'urgente' : 'proxima', diff, tag: b.tag||'—', local: b.bloco||'—', descricao: cat === 'BEB' ? 'Troca de Filtro/Lacre — Bebedouro' : `Validade de Item — ${b.produto||cat||'Equipamento'}`, data: b.validade });
  });

  if (!alertas.length) { painel.style.display = 'none'; return; }
  alertas.sort((a, b) => a.diff - b.diff);
  badge.textContent = alertas.length + (alertas.length === 1 ? ' alerta' : ' alertas');
  const vencidas = alertas.filter(a => a.diff < 0).length;
  const urgentes = alertas.filter(a => a.diff >= 0 && a.diff <= 7).length;
  sub.textContent = [vencidas ? `${vencidas} vencida(s)` : '', urgentes ? `${urgentes} urgente(s) esta semana` : ''].filter(Boolean).join(' · ') || 'Itens que requerem atenção imediata';

  const corTipo = {
    vencida: { bg:'#fef2f2', borda:'#ef4444', txt:'#991b1b', label:'VENCIDA' },
    urgente: { bg:'#fff7ed', borda:'#f97316', txt:'#c2410c', label:'URGENTE' },
    proxima: { bg:'#fefce8', borda:'#eab308', txt:'#854d0e', label:'ATENÇÃO' },
  };
  lista.innerHTML = alertas.map(a => {
    const c = corTipo[a.tipo];
    const diffTxt = a.diff < 0 ? `Venceu há ${Math.abs(a.diff)} dia(s)` : a.diff === 0 ? 'Vence HOJE' : `Vence em ${a.diff} dia(s)`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${c.bg};border:1px solid ${c.borda};border-radius:8px;flex-wrap:wrap;">
      <span style="background:${c.borda};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;">${c.label}</span>
      <span style="font-size:13px;font-weight:700;color:#1a202c;">${escapeHTML(a.tag)}</span>
      <span style="font-size:12px;color:#4a5568;flex:1;">${escapeHTML(a.descricao)} — ${escapeHTML(a.local)}</span>
      <span style="font-size:12px;color:${c.txt};font-weight:600;white-space:nowrap;">${diffTxt}</span>
      <span style="font-size:11px;color:#a0aec0;">${fmtDate(a.data)}</span>
    </div>`;
  }).join('');
  painel.style.display = 'block';
}

// ===================== EDIÇÃO PMOC =====================
async function editarFichaPMOC(id) {
  const ficha = _fichasCache.find(f => f.id == id);
  if (!ficha) { alert('Ficha não encontrada no cache. Recarregue a página.'); return; }
  const meta    = lerMetaPMOC(ficha);
  const freqMap = { Mensal:'M', Trimestral:'T', Semestral:'S', Anual:'A' };
  if ($('pmoc-equipamento'))  $('pmoc-equipamento').value  = ficha.equipamento_id || '';
  if ($('pmoc-data'))         $('pmoc-data').value         = meta.data_inspecao   || '';
  if ($('pmoc-frequencia'))   $('pmoc-frequencia').value   = freqMap[meta.frequencia] || 'M';
  if ($('pmoc-obs'))          $('pmoc-obs').value          = meta._obsLimpa || ficha.observacoes || '';
  if ($('pmoc-id-edicao'))    $('pmoc-id-edicao').value    = id;
  const titulo = $('titulo-formulario-pmoc') || document.querySelector('#sub-pmoc-form h3');
  if (titulo) titulo.textContent = '✏️ Editando Ficha PMOC — ' + (ficha.equipamentos?.tag || id.toString().slice(0,6).toUpperCase());
  const btnSalvar = $('btn-salvar-ficha');
  if (btnSalvar) { btnSalvar.textContent = '💾 Salvar Alterações'; btnSalvar.style.background = '#d97706'; }
  let btnCancelar = $('btn-cancelar-edicao-pmoc');
  if (!btnCancelar) {
    btnCancelar = document.createElement('button');
    btnCancelar.id = 'btn-cancelar-edicao-pmoc';
    btnCancelar.className = 'btn-secondary';
    btnCancelar.textContent = '✕ Cancelar';
    btnCancelar.onclick = resetarFormPMOC;
    btnSalvar?.parentNode?.appendChild(btnCancelar);
  }
  btnCancelar.style.display = 'inline-block';
  alternarSubAbasPMOC('form');
  document.getElementById('sub-pmoc-form')?.scrollIntoView({ behavior:'smooth' });
}

function resetarFormPMOC() {
  if ($('pmoc-id-edicao')) $('pmoc-id-edicao').value = '';
  if ($('pmoc-obs'))       $('pmoc-obs').value       = '';
  if ($('pmoc-data'))      $('pmoc-data').value       = '';
  const titulo = $('titulo-formulario-pmoc') || document.querySelector('#sub-pmoc-form h3');
  if (titulo) titulo.textContent = '📋 Novo Laudo PMOC';
  const btnSalvar = $('btn-salvar-ficha');
  if (btnSalvar) { btnSalvar.textContent = '✓ Registrar Ficha PMOC'; btnSalvar.style.background = ''; }
  const btnCancelar = $('btn-cancelar-edicao-pmoc');
  if (btnCancelar) btnCancelar.style.display = 'none';
}

async function excluirFichaPMOC(id) {
  const ficha = _fichasCache.find(f => f.id == id);
  const tag   = ficha?.equipamentos?.tag || id.toString().slice(0,6).toUpperCase();
  if (!confirm(`Excluir ficha PMOC do equipamento ${tag}? Esta ação não pode ser desfeita.`)) return;
  const { error } = await db.from('fichas_pmoc').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  carregarHistoricoFichas();
}

// ===================== EDIÇÃO OS =====================
async function editarOS(id, equipId, colabId, tipo, status, defeito, laudo) {
  if ($('os-id-edicao'))   $('os-id-edicao').value   = id;
  if ($('os-equipamento')) $('os-equipamento').value  = equipId;
  if ($('os-tecnico'))     $('os-tecnico').value      = colabId;
  if ($('os-tipo'))        $('os-tipo').value         = tipo;
  if ($('os-status'))      $('os-status').value       = status;
  if ($('os-defeito'))     $('os-defeito').value      = defeito;
  if ($('os-laudo'))       $('os-laudo').value        = laudo;
  const titulo = $('titulo-formulario-os');
  if (titulo) titulo.textContent = '✏️ Editando O.S. — OS-AC-' + id.toString().slice(0,5).toUpperCase();
  const btnSalvar = $('btn-salvar-os');
  if (btnSalvar) { btnSalvar.textContent = '💾 Salvar Alterações'; btnSalvar.style.background = '#d97706'; }
  const btnCancelar = $('btn-cancelar-edicao-os');
  if (btnCancelar) btnCancelar.style.display = 'inline-block';
  document.getElementById('foco-formulario-os')?.scrollIntoView({ behavior:'smooth' });
}

async function excluirOS(id) {
  if (!confirm(`Excluir OS-AC-${id.toString().slice(0,5).toUpperCase()}? Esta ação não pode ser desfeita.`)) return;
  const { error } = await db.from('ordens_servico').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  carregarOrdensServico(); carregarCentralUnificadaOS();
}

if ($('btn-cancelar-edicao-os')) {
  $('btn-cancelar-edicao-os').addEventListener('click', () => {
    resetarFormOS();
    const titulo = $('titulo-formulario-os');
    if (titulo) titulo.textContent = 'Abertura / Atualização de O.S. Técnica';
    const btnSalvar = $('btn-salvar-os');
    if (btnSalvar) { btnSalvar.textContent = '✓ Registrar Ordem de Serviço'; btnSalvar.style.background = ''; }
    const btnCancelar = $('btn-cancelar-edicao-os');
    if (btnCancelar) btnCancelar.style.display = 'none';
  });
}

// ===================== EDIÇÃO OSG =====================
async function editarOSG(id, setor, servico, status) {
  if ($('osg-id-edicao'))   $('osg-id-edicao').value   = id;
  if ($('osg-setor'))       $('osg-setor').value       = setor;
  if ($('osg-requisitado')) $('osg-requisitado').value = servico;
  if ($('osg-status'))      $('osg-status').value      = status;
  const btnSalvar = $('btn-salvar-osg');
  if (btnSalvar) { btnSalvar.textContent = '💾 Salvar Alterações'; btnSalvar.style.background = '#d97706'; }
  const btnCancelar = $('btn-cancelar-edicao-osg');
  if (btnCancelar) btnCancelar.style.display = 'inline-block';
  document.getElementById('foco-formulario-osg')?.scrollIntoView({ behavior:'smooth' });
}

async function excluirOSG(id) {
  if (!confirm('Excluir esta O.S. de Facilities? Esta ação não pode ser desfeita.')) return;
  const { error } = await db.from('ordens_servico_geral').delete().eq('id', id);
  if (error) { alert('Erro ao excluir: ' + error.message); return; }
  carregarOSGeral(); carregarCentralUnificadaOS();
}

if ($('btn-cancelar-edicao-osg')) {
  $('btn-cancelar-edicao-osg').addEventListener('click', () => {
    resetarFormOSG();
    const btnSalvar = $('btn-salvar-osg');
    if (btnSalvar) { btnSalvar.textContent = '✓ Salvar Ordem Facilities'; btnSalvar.style.background = ''; }
    const btnCancelar = $('btn-cancelar-edicao-osg');
    if (btnCancelar) btnCancelar.style.display = 'none';
  });
}
