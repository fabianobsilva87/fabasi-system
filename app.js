// =====================================================================
//  CONCREDUR + COMPRAS PRO — UNIFIED BACKEND LOGIC (app.js)
//  Gerenciamento integrado de Manutenção Preventiva/Corretiva e 
//  módulos relacionais de Cadeia de Suprimentos no Supabase.
// =====================================================================

const _SUPA_URL = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) ? SUPABASE_URL : 'https://mqijbvcnalbfjbhhjjzx.supabase.co';
const _SUPA_KEY = (typeof SUPABASE_ANON_KEY !== 'undefined' && SUPABASE_ANON_KEY) ? SUPABASE_ANON_KEY : '';
const db = supabase.createClient(_SUPA_URL, _SUPA_KEY);

const LOGO_ETIQUETA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA9CAYAAADoByY0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDAyIDc5LjE2NDQ4OCwgMjAyMC8wNy8xMC0yMjowNjo1MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjAgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjM4MEYxMjVBNTg3NDExRUU5QTBGQkI4N0VFOTE2RTJGIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjM4MEYxMjVBNTg3NDExRUU5QTBGQkI4N0VFOTE2RTJGIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MzgwRjEyNTg1ODc0MTFFRTlBMEZCQjg3RUU5MTZFMkYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MzgwRjEyNTk1ODc0MTFFRTlBMEZCQjg3RUU5MTZFMkYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6klSGIAAAP7ElEQVR42uxdCXQV1Rm+7FuAsARkD6tFRLCICsWWahULdQGXWmwtgpalYgvqaenKsT3VtgiW0koVECu1Kq0FpFixFRVQcWkDAgJiVAwhZoEkJCwJJL3fmW9OLo+3zL0z781M8v5zvjNvmZl338z97v9//12mUW1trUhbVGsk0VEiU6IDt+0l2nELtJVoKZHB9y0LXf9nzdXKIp94G14XsTOypRw9dlErh5xyVOEnhdIVElUS5Ryc+Ocv8yfl5KHFGQtmiVoIERBBW2u8Q53HbltrNEFoHXnYiGYrUkSYlEsUSRRCG3B7nNlyiQyJM4kSZI+KyxRE+JbAW9JXrx8+70Amlzb0dIHOCAxCfEx0S+4unSBEkxCVDpB0p8TmIAMZCEaJauu4GwKhJlv4I9EvtIqNo0QdzH/6jwQ4nziHkSyyR6BKScJxlulDPWt+P904z/q4lK7q++tq00zvkzougVW9+o37eMAXjMVtRBXthaietcnuOYxF6J3RK7JHZKvEdCpQkSwysMlhghcZHEMInhFMOR1petz4sS53rw2zVK3F3MuNsWrai4h/m6XBG3ldxCDJ8KSUNoJwkymVhQEw128qEj0YlarJOCxmwI4L2flrg8CWVEAiFH4r8K9vgdqvlBENyE0cTFEpcoGZ5E1peVGGL7eYlL47TsnzJGPkRhWcDXnzFGtkmRTuMlbsCQuED27SN68vESXajtenDb00NPZRsaobcktkm8LvEm71m9IkgXtjhfJIa4OBcIMkPibYkXJB5kC2OLxANEYbpeJ8WGs5WPZV1JlD70Ntm8Z/2I1h6UAWHZFon/SLwirAxbqAiCVuQLbGWukrjA8DzVFHd7FTwj8SuJ2cQf03U2pZ4E92ASNYOJIb3eX2IQcS4x0EWCZTtD7n+RONVBJEh7EgIXbxzjXB0d8IHEDgq2nRRw+2PE+A9LfI+vfyHx83SYlBLDvf27xEqJ25OgkQYwfDufiZnzSaLGmjoGZPkHI4wyPwkCd3m9xDfoKZzEn6fY+rxL5JAYxzR+VyUIbLnEdGaO0pY820rdWM3QKT8Fv9maEchwJnFG8H0TB8dW0av8VVjZt+OpIggu0h0SNzkQ1/m8sLbAyhHue2EjCQJbR6IeS9fjpNgo3kPbHpD4kU9lQdp6GBM0oxjOJ0r7I/W+WlhdBG8kiyBg7XUONQXCo80Uzl5bNIII3sBrhJWaTZu39jeJG5T3RyjCKwJSPni0MRJjGaol0iyLhZXlrHJLkAxehC4GGYiCON6is3Ce2rWtkB4iFkFg7zPcyzO80LjpHTWPOUBSZgr9oSzF1GBdNI9DuPCZxv7QhLpjy8pIhH7UiJFaAEmSJSEmPRIOj/M/xCY6CBIFzSRmSxTx/ZpafRsb49zASoPzXc9jH06wX57EkDi/LTwu1xQeO9/w2B4SVZrHFUu00PhfKwzKNoHHLonxfa5EY8Pr7AQDJGZKLJfYKvGhRIlEqUus5/lL+T+KWNebRStHtAzBGMUNdQ5hy9CD6b4xISnvQQpJHesknA/5QK/51zXPD0+8gd50Sox9+jKz5bW+mEmtCq+FNP5U6t5+LE97l8hQPIgdzSxmnT+rzqgEQRbqIYnXhDX04zO+D6MhundEOE4vZsKyIuX9b81jvsxWNZHdaKA1lvFSzE6w76XMInkxeMP1Ek8IqyMx1dYddRy9/zcKq3f+HnIgyyaIjQ64HAwD-UrwuporRbhN-y-R4XVmRh0-a1Bq5uo8qPDbaTmefcwN-Onwwo718V-RsYJw4bG-XztUdfRCXqlsDoMMUjyJXADFWgCMU1YPdj10eZLLBXOOph8MtyQnZpHQB-Em76r6z1BjEdIPqcVH2Fsf4P-i2NeoZYJku1iw3MtAICuZqqzvhpR9NUOvIFqtghbpJvG1GN9hfv_wPtc-HuoDU8zi2pE492RzN32nPJEGPAHcXcGJZ4_GhDLHNq5xBcaSHtDUEX8emxfgcHXs9NBm6yFBs3y70-lkgxAeFJUZvaHaZsNLAEQNctiqh3_k2ngkVp8SJZZhfgymxl1CH6hiydDMc7nu1xOQwidigaAgfMDRlcADLBg1QqXkPI0fXIrtlO-tvAbeitUtkvBINWEU49kCYKkpT0XCtFz0JYvg3AlQuDO_AEIi7NMOsX4q66alTNV8TmaTN1AS3GJa7KzXPigj7wDMNNzg3OlP_wPtU6vL6VqQJ4tzQM4vcN0Ym_zNA5YIWmKXh4TGGDC_QMLy7iQFBbO9xt3C3Msxcwrs2jlbRNs28P-XpEMsfQ1ZrnUGlSqa hRwM5zWPuVDRJN43jPuFvYQjGdJflRj_auBjfNRH6_R3QRJP8Ikfag5zZUGDiVVGAyoSU740a-1_LMEeXnGN09Cke50V27156skiz0OD88yL0GNZCc9vbjhAtJ00QM8sKUFneZCJhtMa9_IGIbS8SzTCkPRmPneNRea8Q1hin7RGf665NcISeXbUfSnzbaFleFdW8kHSIbQ9sgeb-c4TeaIFHKVoRxvTxsNzRMmG6PeZYRQDWHUsTJNiiudT7k3RujD9bHKdCuTEMr4_sJdedFJYblNg7bcG1GmqEZNizwpp5iY7TkR6fG5mwySM-a2EQYqUJkiLLC3HZkTZNxjx7tx2DiQwZsYwIsutYRpogqTNkhH4d0rJjHv4jHp8TfT_I5GA81DVJKjcyVupw_BLN48-p7wSJN4utrcH53C5ijAzIj0NKkt8LBytwaNhCRdQ30jhus-bv fF3UZUp1vfhFQbhwTtO8Jsu7dPV4dbCiswjLllYmMS5PlmH685NCv4+jmmG-A1YdxBzsKQYNDEIzUY53B2ZsEnUOLs0fwtLkmKlRXWOEnrVYw01gcbZ4RdCjhucO9Z8AqQhh_pEENjvGLYsDVmIucoggOA-GgqCoSwtNY7DZC70yyzUIYmtcECQtxkF6FxzzARVF554iolmmMggiNPCHjI49yQRfVzPdYYh1yEP__djwFok4FSI CIIWeYMHnkUVDVFn5rHLun1aM6JAhQ6YMnZJbNX_zZoZpgdcgJisEJhNtndTfuurEn8zOBcWCivw-L__RViTisI0936hy+Mx1wTPTvmW0Bs1gGP-zNeVJImO2ZmyJw09HhbfGC18eMSeU4JsNzw_xhLlE0fZApss6NqgXGbyvnbnT9R4fCmv1kfVrGK4fguuMKdlTQRAMTcY6WBi4Fm8K6mKfCorRl++m4HfwLLzLhd6i0H5YtcG9QOOGpTzRtzDWwHtEC2+hJ3T6ZpAYmEk9gznpJwJ6fc/j_8ZidutBEMyBuFrU5ZyxPtNEcXYKGJX0iRQX9rRI7eqOCCWxPuvBgJPEHoXr1OzlhHQXeTsV556XsGHVsdkkSg49Sk1Arifq+vWs+7voKBBRFNoapIitJ+LbKyjK8PwErPanrpOKxw7sS2HBfyLxToovFkbPjmJoEVQrI0mcesYtDKNvNkhixMse6or1LIb0dtjsN0mGsY7nkexXsDG5nJw4Q6TDXd4nrCfRgkXnsPXO4fufCmvtI4i8Qyko_FLh3_kpNA6XCf2VDlNpi4Wzx86p8811V5ZMpDOwZO3HmuecK+qGtyBMw0zIUh+u3zbWbdTxrtRFX+L7KlWkRxOsw3lBC5W47H62Rq1Ior1JztTMEv4+nPMQW5J3AkoQpDVXJ9jnY7aMyPJ8R/P8B0T0qbOqofVfoXleTJtV56ZjsQzMNtyQ4utnZ/KKWdfhTc4aa9Y4TuyJAXJYP3WeIlzhQTYJK207Upyd/nNrBYwF7xPBeHIt3CyWqnk9oCRJtFTpIt5LLOigO3rhcYfhj9P9VLsnisdGZDKOXilVDSDqdl/W9agdxon6QSAEH+RJ0ALtIEleph6ZxczIWpcVGhXxZ8J6XvbagFXCMgq2TQEkCLzbqzG+K2Xr3lTEfmRdPM/gNI2b58DTRBoe3TAiyucbqQMGsfLikRDJ6p8axrodN9lh8pRbPA9iKgXfpxTSa4Q1xRKfISN2sUjccWM/6HMNL7DTlOFQob+a+HseiG6sGoghD5HzJ7DW00qGpbqLom0R7qfUYpGG56N8Dv2G0bfdDcQ5wo5VGvvjf4/V/I23NDwzNAKm7HYUesPzYzUcjkcjuH1OOgTWZFZYZCWeU4RtLyJL+VMn6No+JHPt3vWwPL65OUOKyVEI4pchCtgtzuwdr6bXPyjCbW3YIIKAWIhbZ0gQ+lteMEgieEYQ1dpReE2i4EIqeA+FJBhbSZJ0IGH6c7/PM7Oyj+HbTrb2yJp9JII52hblxYDLaQEhiKDGUNO+yA7dFiIiIAwcwGQQpkkMYQg0UOgNjy9nNLKW4r/MbcG8IohqzRiGjRd1a7GauMVqEgfZMqTgPmA4gm2hzzcU/wfzStDxdRNDLz+tFRujLCW+3hFAInShp+uvEGIQYTJSF5UXA2lforfYIjwenZ0MgkRaFoXXWOJcD85ZyTAtlxUjl670AMOKVK2QiJXKt1FH+W2YXDSfwvZKn8qAe92bQHidLayV5rNJCi8WYthF7bqJSOq9TgVBIg0D1kbRy1zKbIbXK1icZAIhj5oH2wK+LlK2RcJ9Orl1QDRUFhuIiQZZpUTeMov3rRu9QDeip/Ia02tbePyfKtgAQdBjuDtWdz+cyovqB0GiiUx0HiFdfCF1yXCRpOHLEVbDjE0JyVLMG2CjTNTNN0B8e5Sw3wdlLJFt3xXW05tqo4S9ELyZbIzaEZnUhfa2I2ETohORiqnJZcwu/Y94m+G1r9c4CASJZdkUbEO5HUwiBekZgycY+0Kk/4bvK5hcsAlUqcTF8DRVEQRNlOdvF1FBW4q6ueTwXs0pcjHLbxUbl2f5eTsSo3mArtlxakuESruZmNnuNtvUEAkSy9v0oY4ZSKFnI9vHilAszGZKemkf8TpgauytPpelmhXeTqzspzfYxzCwJiwVLmwESUQedFb2JYn6RAhGfNde1G+bQ0+W7LnbCDHzqfNs2EmSXGq+mvpwQesTQZxYGwpLCM3uiuDszNdq7O1Fr22qTXdZHdUOU4vZmqyArwuUBEcByXC8oVSYhkYQXbNFaybRntu23LYmMvhZC75uowjjZtQIaqbO1JNB35xW9M8JhjOV1DbHWHlPUPQe4zEV1Dpl3JbTCxzhtkQEY3Bo4Oz/AgwATYSY5UjE8mYAAAAASUVORK5CYII=';

// ===================== UTILS =====================
const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => iso ? new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => new Date().toISOString().split('T')[0];

function escapeHTML(str) {
  if (str === null || str === undefined) return '—';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function statusBadge(status) {
  const m = {
    'Rascunho': 'b-draft', 'Pendente': 'b-pend', 'Aprovada': 'b-aprov', 'Rejeitada': 'b-rej', 'Em Cotação': 'b-cot', 'Concluída': 'b-conc',
    'Aberta': 'b-open', 'Em Análise': 'b-anl', 'Aguard. Aprovação': 'b-pend', 'OC Emitida': 'b-emit', 'Enviada': 'b-anl', 'Confirmada': 'b-aprov', 'Parcial': 'b-pend', 'Recebida': 'b-conc', 'Cancelada': 'b-rej'
  };
  const cls = m[status] || 'b-draft';
  return `<span class="tag-badge ${cls}">${escapeHTML(status)}</span>`;
}

function msgForm(id, texto, cor) {
  const el = $(id); if (!el) return;
  el.style.color = cor === 'red' ? '#dc2626' : cor === 'green' ? '#059669' : '#1a56db';
  el.textContent = texto;
}

// ===================== CANVAS LOGIC =====================
class CanvasAssinatura {
  constructor(canvasId) {
    this.el = document.getElementById(canvasId); if (!this.el) return;
    this.ctx = this.el.getContext('2d'); this.desenhando = false; this._init();
  }
  _aplicarEstilo() { this.ctx.lineWidth = 2.5; this.ctx.strokeStyle = '#1a202c'; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; }
  _sincronizarTamanho() { const rect = this.el.getBoundingClientRect(); if(rect.width===0) return; this.el.width = Math.round(rect.width); this.el.height = Math.round(rect.height); this._aplicarEstilo(); }
  _getPos(e) { const rect = this.el.getBoundingClientRect(); const src = e.touches ? e.touches[0] : e; return { x: (src.clientX - rect.left) * (this.el.width/rect.width), y: (src.clientY - rect.top) * (this.el.height/rect.height) }; }
  _init() {
    this._sincronizarTamanho(); window.addEventListener('resize', () => this._sincronizarTamanho());
    const start = (e) => { this.desenhando = true; this.ctx.beginPath(); const p = this._getPos(e); this.ctx.moveTo(p.x, p.y); };
    const move = (e) => { if (!this.desenhando) return; e.preventDefault(); const p = this._getPos(e); this.ctx.lineTo(p.x, p.y); this.ctx.stroke(); };
    const stop = () => this.desenhando = false;
    this.el.addEventListener('mousedown', start); this.el.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    this.el.addEventListener('touchstart', start, {passive:true}); this.el.addEventListener('touchmove', move, {passive:false}); window.addEventListener('touchend', stop);
  }
  temConteudo() { return this.ctx ? this.ctx.getImageData(0,0,this.el.width,this.el.height).data.some((v,i) => i%4===3 && v>0) : false; }
  limpar() { if(this.ctx) this.ctx.clearRect(0,0,this.el.width,this.el.height); }
  async toBlob() { return new Promise((res) => this.el.toBlob(res, 'image/png')); }
}

// ===================== MODULE 1: COMPRAS SOLICITAÇÕES =====================
let _comprasItensEmEspera = [];
async function carregarComprasSolicitacoes() {
  const tbody = $('tbody-compras-solicitacoes'); if (!tbody) return;
  const { data, error } = await db.from('compras_solicitacoes').select('*').order('created_at', { ascending: false });
  if (error) return;
  tbody.innerHTML = data.length ? data.map(s => `
    <tr>
      <td><strong>${escapeHTML(s.numero)}</strong></td>
      <td><span class="tag-badge">${escapeHTML(s.tipo)}</span></td>
      <td>${escapeHTML(s.descricao)}</td>
      <td><span class="tag-badge" style="background:#f1f5f9;color:#475569;">${escapeHTML(s.setor)}</span></td>
      <td>${escapeHTML(s.prioridade)}</td>
      <td>${statusBadge(s.status)}</td>
      <td>${fmtDate(s.data_necessaria)}</td>
      <td>
        <button class="btn-secondary" style="padding:3px 8px;font-size:11px;" onclick="excluirSolicitacao('${s.id}')">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="8" class="td-loading">Nenhuma solicitação em aberto.</td></tr>';
}

async function salvarComprasSolicitacao(status) {
  const tipo = $('comp-tipo').value; const prioridade = $('comp-prioridade').value;
  const setor = $('comp-setor').value; const data_necessaria = $('comp-data').value;
  const descricao = $('comp-desc').value.trim(); const justificativa = $('comp-just').value.trim();
  if (!descricao || !data_necessaria) { alert('Descrição e Data são obrigatórias.'); return; }
  
  const rows = document.querySelectorAll('#ilist .irow');
  if(!rows.length) { alert('Adicione pelo menos um item à solicitação.'); return; }

  const numero = `${tipo}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: sol, error } = await db.from('compras_solicitacoes').insert([{
    numero, tipo, descricao, justificativa, setor, prioridade, status, data_necessaria, solicitante_nome: 'Operador Logístico'
  }]).select().single();

  if (error) { alert(error.message); return; }

  const itens = [];
  rows.forEach(row => {
    const d = row.querySelector('.item-desc').value.trim();
    const q = parseInt(row.querySelector('.item-qtd').value) || 1;
    const u = row.querySelector('.item-unid').value.trim() || 'UN';
    if(d) itens.push({ solicitacao_id: sol.id, descricao: d, quantidade: q, unidade: u });
  });

  await db.from('compras_solicitacoes_itens').insert(itens);
  alert('✓ Solicitação salva com sucesso!'); location.reload();
}

async function excluirSolicitacao(id) { if(confirm('Excluir esta solicitação permanente?')) { await db.from('compras_solicitacoes').delete().eq('id', id); carregarComprasSolicitacoes(); } }

// ===================== MODULE 2: COMPRAS COTAÇÕES =====================
async function carregarComprasCotacoes() {
  const tbody = $('tbody-compras-cotacoes'); if (!tbody) return;
  const { data } = await db.from('compras_cotacoes').select('*, compras_solicitacoes(numero, descricao)').order('created_at', { ascending: false });
  tbody.innerHTML = (data||[]).length ? data.map(c => `
    <tr>
      <td><strong>${escapeHTML(c.numero)}</strong></td>
      <td><span class="tag-badge">${escapeHTML(c.compras_solicitacoes?.numero)}</span></td>
      <td>${escapeHTML(c.compras_solicitacoes?.descricao)}</td>
      <td>${statusBadge(c.status)}</td>
      <td><span class="tag-badge danger">Alçada N${c.nivel_alcada_requerido}</span></td>
      <td>
        <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="abrirPainelCotacao('${c.id}')">⚖️ Analisar / Fornecedores</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="6" class="td-loading">Nenhuma cotação ativa.</td></tr>';
}

// ===================== GESTÃO DE CANVAS & LOGOUTFallback PRESERVED =====================
if ($('btn-logout')) {
  $('btn-logout').addEventListener('click', async () => { if (confirm('Encerrar sessão?')) { await db.auth.signOut(); window.location.href = 'index.html'; } });
}
