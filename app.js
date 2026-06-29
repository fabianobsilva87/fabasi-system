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
const LOGO_ETIQUETA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA9CAYAAADoByY0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDAyIDc5LjE2NDQ4OCwgMjAyMC8wNy8xMC0yMjowNjo1MyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjAgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjM4MEYxMjVBNTg3NDExRUU5QTBGQkI4N0VFOTE2RTJGIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjM4MEYxMjVCNTg3NDExRUU5QTBGQkI4N0VFOTE2RTJGIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MzgwRjEyNTg1ODc0MTFFRTlBMEZCQjg3RUU5MTZFMkYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MzgwRjEyNTk1ODc0MTFFRTlBMEZCQjg3RUU5MTZFMkYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6klSGIAAAP7ElEQVR42uxdCXQV1Rm+7FuAsARkD6tFRLCICsWWahULdQGXWmwtgpalYgvqaenKsT3VtgiW0koVECu1Kq0FpFixFRVQcWkDAgJiVAwhZoEkJCwJJL3fmW9OLo+3zL0z781M8v5zvjNvmZl338z97v9//12mUW1trUhbVGsk0VEiU6IDt+0l2nELtJVoKZHB9y0kWvOzlnzdXKIp94G14XsTOypRw9dlErh5xyVOEnhdIVElUS5Ryc+Ocv8yfl5KHFGQtmiVoIERBBW2u8Q53HbltrNEFoHXnYiGYrUkSYlEsUSRRCG3B7nNlyiQyJM4kSZI+KyxRE+JbAW9JXrx8+70Amlzb0dIHOCAxCfEx0S+4unSBEkxCVDpB0p8TmIAMZCEaJauu4GwKhJlv4I9EvtIqNo0QdzH/6jwQ4nziHkSyyR6BKScJxlulDPWt+P904z/q4lK7q++tq00zvkzougVW9+o37eMAXjMVtRBXthaietcnuOYxF6J3RK7JHZKvEdCpQkSwysMlhghcZHEMInhFMOR1petz4sS53rw2zVK3F3MuNsWrai4h/m6XBG3ldxCDJ8KSUNoJwkymVhQEw128qEj0YlarJOCxmwI4L2flrg8CWVEAiFH4r8K9vgdqvlBENyE0cTFEpcoGZ5E1peVGGL7eYlL47TsnzJGPkRhWcDXnzFGtkmRTuMlbsCQuED27SN68vESXajtenDb00NPZRsaobcktkm8LvEm71m9IkgXtjhfJIa4OBcIMkPibYkXJB5kC2OLxANEYbpeJ8WGs5WPZV1JlD70Ntm8Z/2I1h6UAWHZFon/SLwirAxbqAiCVuQLbGWukrjA8DzVFHd7FTwj8SuJ2cQf03U2pZ4E92ASNYOJIb3eX2IQcS4x0EWCZTtD7n+RONVBJEh7EgIXbxzjXB0d8IHEDgq2nRRw+2PE+A9LfI+vfyHx83SYlBLDvf27xEqJ25OgkQYwfDufiZnzSaLGmjoGZPkHI4wyPwkCd3m9xDfoKZzEn6fY+rxL5JAYxzR+VyUIbLnEdGaO0pY820rdWM3QKT8Fv9maEchwJnFG8H0TB8dW0av8VVjZt+OpIggu0h0SNzkQ1/m8sLbAyhHue2EjCQJbR6IeS9fjpNgo3kPbHpD4kU9lQdp6GBM0oxjOJ0r7I/W+WlhdBG8kiyBg7XUONQXCo80Uzl5bNIII3sBrhJWaTZu39jeJG5T3RyjCKwJSPni0MRJjGaol0iyLhZXlrHJLkAxehC4GGYiCON6is3Ce2rWtkB4iFkFg7zPcyzO80LjpHTWPOUBSZgr9oSzF1GBdNI9DuPCZxv7QhLpjy8pIhH7UiJFaAEmSJSEmPRIOj/M/xCY6CBIFzSRmSxTx/ZpafRsb49zASoPzXc9jH06wX57EkDi/LTwu1xQeO9/w2B4SVZrHFUu00PhfKwzKNoHHLonxfa5EY8Pr7AQDJGZKLJfYKvGhRIlEqUus5/lL+T+KWNebRStHtAzBGMUNdQ5hy9CD6b4xISnvQQpJHesknA/5QK/51zXPD0+8gd50Sox9+jKz5bW+mEmtCq+FNP5U6t5+LE97l8hQPIgdzSxmnT+rzqgEQRbqIYnXhDX04zO+D6Mh1NkoMTEk5TW5ztMd7neLQXi8UFipc3TKtomz3z0e/X+MvbtNIpekGJaCa34Jf+chhu+DWfcXqBlZmyAYe/OyxFxu0TJgmPi9IY4xW1Fc3hmCsiLV/W/NY77MVjWR3WGg9VaxksxOsO+lzCK5MXjD9RJPCKsjMdXXHXUcvf83Cqt3/h5yIMsmiE0OuBwMA/mKsDpaqkX4Df/vUWF1JgbdfmvQ6iaq/OhwG6l53iVMrtzqsMLOdfGfkXHCsKHxPl971HV0gl4prA5KDJJ8CdxABZpATBNWD3Z9tPkSS4WzDia/DDdkp+Yx0Afxpu/qek8Q4xGSz2nFRxjb3+D/4phXqGWCZLvY8FwLgCArmaqs74aYfTVDryBarYEW6SbxtRjfYX78NzXPh7qA1PM4tqROPdkczd9pzyRAjwDXF3BieWPRsAyt3Yu8QUG0p4Q1JF/HpsX4HB17HTQJushQfN8u9PpZIMQHhSVGb2h2mbDSwD0DWLYqod/5Np4JFafEiWWYX4MpsRdQh+oYsmQzHO57tcTkMInYhmgIHzA0ZXAAywYNUKl5DyNH1yK7pTvrbwG3pplLZLwSDVhFOPZAmCpKU9FwrRc9CWL4NwJULgzvwBCIuzTDrF+KuumpUzV/E5mkzdQEtxiWuys1z4o4+8AzDTc4NzpT/8D7VOry+lakCeLc0DOL3DdGJv8zQOWCFpil4eExhgxj0DC8u4kBQWzvcbdwtzLMXJK7No5W0bWNvD/l6RDLH0NWa51BpUqmoUf5Oc1j7lQ0STeN4z7hb2EIxnSX5UY/2rgY3zUR+v0d0EST/CJH2oOc2VBg4lVRgMqElO+NGvtfyzBHV5xjdPQpHudFdu9eerJIu9Dg/PMi9BjWQnPb244QLSdNEDPLClBZ3mQiYbTGvfyBiN0vEs0wpH0Zj53jUbmvENYYp+0Rn+uuTXCEnl21H0p822X5XhXWvJF0iFUPbIHm/nOE3miBRylaEcb08bDc0TJhuj3mW0UA1h1LEyTYhrnU+5N0bow/WhynQrsxDK+P7CXXnRSWG5TYO23BtRpqhGTYs8KaeYmO05EenxuZsLsjPmthEGKlCZIiywtx2ZE2TcY8e7cdg4kMGbGMCLLrWEaaIKkzZIR+HdKyYx7+Ix6fE30/yORgPNQ1SSo3MlbqcPwSzePPqe8EiTeLra3B+dwuYowMyI9DSpLfCwcrcGjYQkXUN9I4brPm73xf1GVKdb34RUG48E7TvCbLu3T1uHXworMIy5ZWJjGuT5Zh+vOTQr+PI5phvgNWHcRc7CkGjQxCs1EO90dmbBL1zi7N38KSpFhpUZ2jhF71WENNoHFm+EWQowbnjjWfAGnIoT4RBPY7hi1LQxZiLvKIIDgPhoJgKEtLjeMwmQv9Mss1CGJrHBDkbUYBOtccM0HVBSeeIqJZZjII4rSwhwzOPUlEH9dznWGIdcjD//2YsBYJOBUigqAF3uCBJ1pFYtyleexybp/WjCiQIUOmDJ2SWzV/82aGaYHXICYrJGaT7d2U3/qqxJ8MzoWF0go8/u9/EdakojDNvV/o8njMNcGzU74l9EYN4Jg/83UlSaJjdqbsSUOPh8U3RgsfHrHnlCDbDc+PsUT5xFG2gCZrbe0QyVnBfR1JezwkBLGzT8KwkbHnm+vOGMRgRjXVvEzzeGTKBrHBLDEo+w30PsdE3SOsI/GJnwR5T7hbSh5exM3DU15LcqW7Svg4YlTTFhge9zgr5wSh//i6xyLebxN6C0zY89bhfdyk26GZYy0I1y5ZBIG77Z1gPzxaYK2PleKZJJ8fE6ew5EtxCAhi94DrGLyvnbnT9R4fCmv1kViaxKlNEXWrGL4fguuMKdlTQRAMTcY6WBi4Fm8K6mKfCorRl++m4HfwLLzLhd6i0H5YtcG9QOOGpTzRtzDWwHtEC2+hJ3T6ZpAYmEk9gznpJwJ6fc/jf8ZidutBEMyBuFrU5ZyxPtNEcXYKGJX0iRQX9rRI7eqOCCWxPuvBgJPEHoXr1OzlhHQXeTsV556XsGHVsdkkSg49Sk1Arifq+vWs+7voKBBRFNoapIitJ+LbKyjK8PwErPanrpOKxw7sS2HBfyLxToovFkbPjmJoEVQrI0mcesYtDKNvNkhixMse6or1LIb0dtjsN0mGsY7nkexXsDG5nJw4Q6TDXd4nrCfRgkXnsPXO4fufCmvtI4i8Qyko/FLh3/gpNA6XCf2VDlNpi4Wzx86p8811V5ZMpDOwZO3HmuecK+qGtyBMw0zIUh+u3zbWbdTxrtRFX+L7KlWkRxOsw3lBC5W47H62Rq1Ior1JztTMEv4+nPMQW5J3AkoQpDVXJ9jnY7aMyPJ8R/P8B0T0qbOqofVfoXleTJtV56ZjsQzMNtyQ4utnZ/KKWdfhTc4aa9Y4TuyJAXJYP3WeIlzhQTYJK207Upyd/nNrBYwF7xPBeHIt3CyWqnk9oCRJtFTpIt5LLOigO3rhcYfhj9P9VLsnisdGZDKOXilVDSDqdl/W9agdxon6QSAEH+RJ0ALtIEleph6ZxczIWpcVGhXxZ8J6XvbagFXCMgq2TQEkCLzbqzG+K2Xr3lTEfmRdPM/gNI2b58DTRBoe3TAiyucbqQMGsfLikRDJ6p8axrodN9lh8pRbPA9iKgXfpxTSa4Q1xRKfISN2sUjccWM/6HMNL7DTlOFQob+a+HseiG6sGoghD5HzJ7DW00qGpbqLom0R7qfUYpGG56N8Dv2G0bfdDcQ5wo5VGvvjf4/V/I23NDwzNAKm7HYUesPzYzUcjkcjuH1OOgTWZFZYZCWeU4RtLyJL+VMn6No+JHPt3vWwPL65OUOKyVEI4pchCtgtzuwdr6bXPyjCbW3YIIKAWIhbZ0gQ+lteMEgieEYQ1dpReE2i4EIqeA+FJBhbSZJ0IGH6c7/PM7Oyj+HbTrb2yJp9JII52hblxYDLaQEhiKDGUNO+yA7dFiIiIAwcwGQQpkkMYQg0UOgNjy9nNLKW4r/MbcG8IohqzRiGjRd1a7GauMVqEgfZMqTgPmA4gm2hzzcU/wfzStDxdRNDLz+tFRujLCW+3hFAInShp+uvEGIQYTJSF5UXA2lforfYIjwenZ0MgkRaFoXXWOJcD85ZyTAtlxUjl670AMOKVK2QiJXKt1FH+W2YXDSfwvZKn8qAe92bQHidLayV5rNJCi8WYthF7bqJSOq9TgVBIg0D1kbRy1zKbIbXK1icZAIhj5oH2wK+LlK2RcJ9Orl1QDRUFhuIiQZZpUTeMov3rRu9QDeip/Ia02tbePyfKtgAQdBjuDtWdz+cyovqB0GiiUx0HiFdfCF1yXCRpOHLEVbDjE0JyVLMG2CjTNTNN0B8e5Sw3wdlLJFt3xXW05tqo4S9ELyZbIzaEZnUhfa2I2ETohORiqnJZcwu/Y94m+G1r9c4CASJZdkUbEO5HUwiBekZgycY+0Kk/4bvK5hcsAlUqcTF8DRVEQRNlOdvF1FBW4q6ueTwXs0pcjHLbxUbl2f5eTsSo3mArtlxakuESruZmNnuNtvUEAkSy9v0oY4ZSKFnI9vHilAszGZKemkf8TpgauytPpelmhXeTqzspzfYxzCwJiwVLmwESUQedFb2JYn6RAhGfNde1G+bQ0+W7LnbCDHzqfNs2EmSXGq+mvpwQesTQZxYGwpLCM3uiuDszNdq7O1Fr22qTXdZHdUOU4vZmqyArwuUBEcByXC8oVSYhkYQXbNFaybRntu23LYmMvhZC75uowjjZtQIaqbO1JNB35xW9M8JhjOV1DbHWHlPUPQe4zEV1Dpl3JbTCxzhtkQEY3Bo4Oz/AgwATYSY5UjE8mYAAAAASUVORK5CYII=';

// ===================== ESTADO GLOBAL =====================
let globalEquipamentos     = [];
let paginaAtualEquipamento = 0;
let itensPorPagina         = 20;
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
  const sufixo  = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nomeArq = `${pasta}/foto_${sufixo}.jpg`;
  const { error } = await db.storage
    .from('fotos-pmoc')
    .upload(nomeArq, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) return null;
  const { data: { publicUrl } } = db.storage.from('fotos-pmoc').getPublicUrl(nomeArq);
  return publicUrl;
}

// ===================== MÚLTIPLAS FOTOS (laudo PMOC / OS) =====================
// Faz upload de várias imagens e retorna um array de URLs públicas.
async function uploadFotos(fileList, pasta, msgId) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return [];
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    if (msgId) msgForm(msgId, `📤 Enviando imagem ${i + 1} de ${files.length}...`, 'blue');
    const url = await uploadFoto(files[i], pasta, null);
    if (url) urls.push(url);
  }
  return urls;
}

// Lê fotos_urls e normaliza para [{url, tipo}], onde tipo ∈ 'antes'|'depois'|'geral'.
// Compatível com: array de objetos {url,tipo} (novo), array de strings (versão anterior)
// e foto_url único (legado) — esses dois últimos viram tipo 'geral'.
function lerFotos(obj) {
  if (!obj) return [];
  let arr = obj.fotos_urls;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = []; } }
  if (Array.isArray(arr) && arr.length) {
    return arr.map(it => typeof it === 'string'
      ? { url: it, tipo: 'geral' }
      : { url: it.url, tipo: it.tipo || 'geral' }
    ).filter(it => it.url);
  }
  return obj.foto_url ? [{ url: obj.foto_url, tipo: 'geral' }] : [];
}

// Renderiza um grupo de imagens (mini-galeria) sob um rótulo.
function _grupoFotosHTML(rotulo, fotos) {
  if (!fotos.length) return '';
  const imgs = fotos.map(f =>
    `<img src="${f.url}" style="max-width:48%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;object-fit:cover;">`
  ).join('');
  return `<div style="flex:1;min-width:240px;">` +
         `<div style="font-size:11px;font-weight:600;color:#4a5568;text-transform:uppercase;margin-bottom:4px;">${rotulo}</div>` +
         `<div style="display:flex;flex-wrap:wrap;gap:8px;">${imgs}</div></div>`;
}

// Galeria de evidências fotográficas para os laudos impressos (Antes / Depois).
function galeriaFotosHTML(obj, titulo = 'Evidências Fotográficas') {
  const fotos  = lerFotos(obj);
  if (!fotos.length) return '';
  const antes  = fotos.filter(f => f.tipo === 'antes');
  const depois = fotos.filter(f => f.tipo === 'depois');
  const geral  = fotos.filter(f => f.tipo !== 'antes' && f.tipo !== 'depois');
  const corpo  = (antes.length || depois.length)
    ? `<div style="display:flex;flex-wrap:wrap;gap:16px;">${_grupoFotosHTML('Antes', antes)}${_grupoFotosHTML('Depois', depois)}</div>`
      + (geral.length ? `<div style="margin-top:10px;">${_grupoFotosHTML('Outras', geral)}</div>` : '')
    : `<div style="display:flex;flex-wrap:wrap;gap:8px;">${
        geral.map(f => `<img src="${f.url}" style="max-width:48%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;object-fit:cover;">`).join('')
      }</div>`;
  return `<div class="laudo-section"><div class="laudo-section-title">${titulo}</div>${corpo}</div>`;
}

// Preview ao vivo das imagens selecionadas, antes de salvar.
function montarPreviewFotos(inputId, previewId) {
  const input = $(inputId), prev = $(previewId);
  if (!input || !prev) return;
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    prev.innerHTML = !files.length ? '' :
      `<div style="font-size:12px;color:#4a5568;margin-bottom:6px;">${files.length} imagem(ns) selecionada(s)</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:6px;">${
        files.map(f => `<img src="${URL.createObjectURL(f)}" style="width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid #cbd5e0;">`).join('')
      }</div>`;
  });
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
  AC:   ['eq-ciclo','eq-tensao','eq-gas','eq-gas-qtd','eq-tec-compressor','eq-instalacao-ac','eq-validade'],
  BEB:  ['eq-cap-beb','eq-tipo-beb','eq-filtro-beb','eq-validade-filtro-beb','eq-lacre-beb','eq-validade-lacre-beb'],
  CLIM: ['eq-vazao-clim','eq-tipo-clim','eq-painel-clim','eq-validade-painel-clim','eq-tensao-clim','eq-consumo-clim'],
  VEN:  ['eq-potencia-ven','eq-tipo-ven','eq-diametro-ven','eq-tensao-ven'],
  OUT:  [],
};
const EQ_CATEGORIA_LABEL = {
  AC:'❄️ Ar Condicionado', BEB:'💧 Bebedouro',
  CLIM:'🌀 Climatizador Evaporativo', VEN:'💨 Ventilador/Exaustor', OUT:'🔧 Outros',
};

// ── Capacidade (BTU/h) — select de opções padrão + campo "Outro" para valores não listados ──
function lerCapacidadeBTU() {
  const sel = $('eq-btu'); if (!sel) return '';
  if (sel.value === '__outro__') return ($('eq-btu-outro')?.value || '').trim();
  return sel.value || '';
}
function definirCapacidadeBTU(valor) {
  const sel = $('eq-btu'); const outroInput = $('eq-btu-outro');
  if (!sel) return;
  if (!valor) {
    sel.value = '';
    if (outroInput) { outroInput.value = ''; outroInput.style.display = 'none'; }
    return;
  }
  const existeNaLista = Array.from(sel.options).some(o => o.value === valor);
  if (existeNaLista) {
    sel.value = valor;
    if (outroInput) { outroInput.value = ''; outroInput.style.display = 'none'; }
  } else {
    sel.value = '__outro__';
    if (outroInput) { outroInput.value = valor; outroInput.style.display = 'block'; }
  }
}
function onChangeCapacidadeBTU() {
  const sel = $('eq-btu'); const outroInput = $('eq-btu-outro');
  if (!sel || !outroInput) return;
  outroInput.style.display = sel.value === '__outro__' ? 'block' : 'none';
  if (sel.value !== '__outro__') outroInput.value = '';
}

function toggleCamposEquipamento() {
  const cat = $('eq-categoria')?.value || '';
  document.querySelectorAll('.eq-campo-condicional').forEach(el => el.style.display = 'none');
  Object.values(EQ_CAMPOS_EXTRAS).flat().forEach(id => { if ($(id)) $(id).value = ''; });
  definirCapacidadeBTU(''); // limpa também o select de Capacidade (BTU/h) e o campo "Outro"
  if (!cat) return;
  document.querySelectorAll(`.eq-campo-${cat}`).forEach(el => el.style.display = 'block');
  document.querySelectorAll('.eq-campo-localizacao, .eq-campo-criticidade').forEach(el => el.style.display = 'block');
}


if ($('btn-salvar')) {
  $('btn-salvar').addEventListener('click', async () => {
    const tag = $('eq-tag')?.value.trim(); const cat = $('eq-categoria')?.value;
    if (!tag || !cat) { msgForm('msg-equipamento', 'TAG e Categoria são obrigatórias.', 'red'); return; }
    msgForm('msg-equipamento', 'Salvando...', 'blue');
    // Localização agora vem de catálogos (instituicoes / blocos) selecionados, não mais texto livre.
    // bloco/instituicao (texto) são mantidos em sincronia automaticamente para compatibilidade
    // com laudos, QR público, dashboard e filtros já existentes.
    const instId  = $('eq-instituicao-id')?.value || '';
    const blocoId = $('eq-bloco-id')?.value       || '';
    const payload = {
      tag, categoria: cat,
      marca:      $('eq-marca')?.value.trim()      || null,
      produto:    $('eq-produto')?.value.trim()    || null,
      nr_serie:   $('eq-serie')?.value.trim()      || null,
      patrimonio: $('eq-patrimonio')?.value.trim() || null,
      setor:      $('eq-setor')?.value.trim()      || null,
      sala:       $('eq-sala')?.value.trim()       || null,
      instituicao_id: instId  || null,
      bloco_id:       blocoId || null,
      instituicao: instId  ? $('eq-instituicao-id').selectedOptions[0].textContent : null,
      bloco:       blocoId ? $('eq-bloco-id').selectedOptions[0].textContent       : null,
      criticidade: calcularCriticidadeFluxograma(),
    };
    const extras = {};
    (EQ_CAMPOS_EXTRAS[cat] || []).forEach(id => {
      const el = $(id); if (!el || !el.value.trim()) return;
      extras[id.replace('eq-','')] = el.value.trim();
    });
    if (Object.keys(extras).length) payload.extras_tecnico = extras;
    // Capacidade (BTU/h) do AC vem do select + campo "Outro"; demais categorias usam eq-potencia normalmente
    if (cat === 'AC') {
      const btu = lerCapacidadeBTU();
      if (btu) payload.potencia = btu;
    } else if ($('eq-potencia')?.value) {
      payload.potencia = $('eq-potencia').value.trim();
    }
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
  if ($('eq-instituicao-id')) $('eq-instituicao-id').value = eq.instituicao_id || '';
  if ($('eq-setor'))       $('eq-setor').value       = eq.setor       || '';
  if ($('eq-sala'))        $('eq-sala').value        = eq.sala        || '';
  if ($('eq-bloco-id')) {
    await popularSelectBlocos(eq.instituicao_id || '', 'eq-bloco-id');
    $('eq-bloco-id').value = eq.bloco_id || '';
  }
  if (eq.categoria === 'AC') {
    definirCapacidadeBTU(eq.potencia || '');
  } else if ($('eq-potencia') && eq.potencia) {
    $('eq-potencia').value = eq.potencia;
  }
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

function obterEquipamentosFiltrados() {
  const termo = ($('search-eq-termo')?.value || '').toLowerCase();
  const crit  = $('search-eq-criticidade')?.value || '';
  const bloco = ($('search-eq-bloco')?.value || '').toLowerCase();
  return globalEquipamentos.filter(e =>
    (!termo || e.tag.toLowerCase().includes(termo) || (e.produto||'').toLowerCase().includes(termo)) &&
    (!crit  || (e.criticidade||'') === crit) &&
    (!bloco || (e.bloco||'').toLowerCase().includes(bloco))
  );
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
function alterarItensPorPagina(v) { itensPorPagina = parseInt(v) || 20; filtrarEquipamentos(0); }

// Exporta os ativos (respeitando os filtros aplicados na tela) para um arquivo .xlsx
// Emite um relatório geral (impressão/PDF), em formato paisagem, com todos os ativos
// cadastrados — respeita os mesmos filtros aplicados na tela (TAG/nome, criticidade, bloco).
function emitirRelatorioGeralAtivos() {
  const items = obterEquipamentosFiltrados();
  if (!items.length) { alert('Nenhum ativo encontrado para gerar o relatório com os filtros atuais.'); return; }

  const linhas = items.map(eq => {
    const local   = [eq.instituicao, eq.bloco, eq.setor, eq.sala].filter(Boolean).join(' / ') || '—';
    const crit    = eq.criticidade || 'Média';
    const critCls = crit === 'Alta' ? 'danger' : crit === 'Baixa' ? 'success' : 'warning';
    return `<tr>
      <td>${escapeHTML(eq.tag || '')}</td>
      <td>${escapeHTML(EQ_CATEGORIA_LABEL[eq.categoria] || eq.categoria || '')}</td>
      <td>${escapeHTML(eq.produto || '')}<br><small style="color:#718096;">${escapeHTML(eq.marca || '')}</small></td>
      <td>${escapeHTML(local)}</td>
      <td>${escapeHTML(eq.nr_serie || '—')}</td>
      <td>${escapeHTML(eq.patrimonio || '—')}</td>
      <td style="text-align:center;"><span class="tag-badge ${critCls}">${escapeHTML(crit)}</span></td>
    </tr>`;
  }).join('');

  const html = `
  <style>@page{size:A4 landscape;margin:12mm;}</style>
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div style="display:flex;align-items:center;gap:14px;"><img src="${LOGO_ETIQUETA}" alt="Logo" style="height:40px;width:auto;display:block;"><div><h1 style="font-size:16px;">Relatório Geral de Ativos</h1><p>Inventário de equipamentos cadastrados</p></div></div>
      <div class="laudo-header-meta">
        <strong>Total de Ativos: ${items.length}</strong><br>
        Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}<br>
        Emitido às ${new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
    <div class="laudo-section">
      <table class="laudo-checklist-table">
        <thead>
          <tr>
            <th>TAG</th><th>Categoria</th><th>Equipamento / Marca</th><th>Localização</th>
            <th>Nº Série</th><th>Patrimônio</th><th style="text-align:center;">Criticidade</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#a0aec0;">
        Documento gerado pelo Sistema de Gestão Univag · ${new Date().toLocaleString('pt-BR')}
      </div>
    </div>
  </div>`;
  imprimir('area-relatorio-ativos', html);
}

const EQ_CATEGORIA_LABEL_PLANO = {
  AC:'Ar Condicionado', BEB:'Bebedouro',
  CLIM:'Climatizador Evaporativo', VEN:'Ventilador/Exaustor', OUT:'Outros',
};
const EQ_CLASSE_LETRA = { Alta:'A', Média:'B', Baixa:'C' };

// Exporta os ativos (respeitando os filtros aplicados na tela) para um arquivo .xlsx,
// no formato de Inventário de Ativos (aba "Inventário" + aba "Resumo" com totais por criticidade)
function exportarEquipamentosXLS() {
  if (typeof XLSX === 'undefined') {
    alert('Biblioteca de exportação (XLSX) não carregada. Recarregue a página e tente novamente.');
    return;
  }
  const items = obterEquipamentosFiltrados();
  if (!items.length) { alert('Nenhum ativo encontrado para exportar com os filtros atuais.'); return; }

  // ----- Aba 1: Inventário -----
  const linhas = items.map(eq => {
    const extras = eq.extras_tecnico || {};
    const crit    = eq.criticidade || 'Média';
    const isAC    = eq.categoria === 'AC';
    return {
      'TAG':                       eq.tag         || '',
      'Categoria':                 EQ_CATEGORIA_LABEL_PLANO[eq.categoria] || eq.categoria || '',
      'Produto / Modelo':          eq.produto     || '',
      'Marca':                     eq.marca       || '',
      'Nº de Série':               eq.nr_serie    || '',
      'Patrimônio':                eq.patrimonio  || '',
      'Instituição / Unidade':     eq.instituicao || '',
      'Bloco / Edificação':        eq.bloco       || '',
      'Setor Interno':             eq.setor       || '',
      'Sala / Identificação':      eq.sala        || '',
      'Criticidade':               'Classe ' + crit,
      'Classe (A/B/C)':            EQ_CLASSE_LETRA[crit] || '',
      'Potência Geral':            eq.potencia    || '',
      'Validade Geral':            eq.validade ? fmtDate(eq.validade) : '',
      'Gás Refrigerante':          extras.gas     || '',
      'Ciclo':                     extras.ciclo   || '',
      'Tensão (V)':                extras.tensao  || '',
      'Quantidade de Gás (KG)':    extras['gas-qtd'] || '',
      'Potência (BTU/h)':          isAC ? (eq.potencia || '') : '',
      'Tecnologia do Compressor':  extras['tec-compressor']  || '',
      'Tipo de Instalação':        extras['instalacao-ac']   || '',
      'Possui QR Code':            eq.qrcode_token ? 'Sim' : 'Não',
      'ID do Registro':            eq.id          || '',
      'Data de Cadastro':          eq.created_at ? fmtDate(eq.created_at) : '',
    };
  });
  const wsInv = XLSX.utils.json_to_sheet(linhas);
  wsInv['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 10 },
    { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 38 }, { wch: 16 },
  ];

  // ----- Aba 2: Resumo -----
  const qtdAlta  = items.filter(e => (e.criticidade || 'Média') === 'Alta').length;
  const qtdMedia = items.filter(e => (e.criticidade || 'Média') === 'Média').length;
  const qtdBaixa = items.filter(e => (e.criticidade || 'Média') === 'Baixa').length;
  const dataExportacao = new Date().toLocaleDateString('pt-BR');

  const resumoAOA = [
    ['Resumo do Inventário de Ativos — Univag'],
    [],
    ['Classe de Criticidade', 'Quantidade', '% do Total'],
    ['Classe Alta (A)',  qtdAlta,  0],
    ['Classe Média (B)', qtdMedia, 0],
    ['Classe Baixa (C)', qtdBaixa, 0],
    ['TOTAL', 0],
    [],
    ['Data de exportação', dataExportacao],
    ['Total de registros', items.length],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoAOA);
  // Fórmulas reais do Excel (recalculadas automaticamente se os números forem editados)
  wsResumo['C4'] = { t: 'n', f: 'B4/B7', z: '0.0%' };
  wsResumo['C5'] = { t: 'n', f: 'B5/B7', z: '0.0%' };
  wsResumo['C6'] = { t: 'n', f: 'B6/B7', z: '0.0%' };
  wsResumo['B7'] = { t: 'n', f: 'SUM(B4:B6)' };
  wsResumo['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsInv,    'Inventário');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  const dataHoje = hoje();
  XLSX.writeFile(wb, `Univag_Inventario_Ativos_${dataHoje}.xlsx`);
}
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
  const { data } = await db.from('equipamentos').select('id, tag, produto, categoria').order('tag', { ascending: true });
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
  const { data } = await db.from('colaboradores').select('id, nome, assinatura_url, assinatura_digital, registro_classe');
  ['pmoc-tecnico','os-tecnico','osg-tecnico'].map($).filter(Boolean).forEach(sel => {
    sel.innerHTML = '<option value="">-- Selecione o Colaborador --</option>';
    (data || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      opt.dataset.assinatura = lerAssinaturaURL(c, 'assinatura_url', 'assinatura_digital') || '';
      sel.appendChild(opt);
    });
  });

  // Select do Responsável Técnico (RT) — apenas colaboradores com registro de classe
  const selRT = $('pmoc-rt');
  if (selRT) {
    selRT.innerHTML = '<option value="">-- Nenhum (laudo sem RT) --</option>';
    (data || []).filter(c => c.registro_classe).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nome} — ${c.registro_classe}`;
      selRT.appendChild(opt);
    });
  }
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
      <td>${c.registro_classe ? `<span class="tag-badge andamento">${escapeHTML(c.registro_classe)}</span>` : '<span style="color:#a0aec0;font-size:11px;">—</span>'}</td>
      <td>${badgeAssinatura}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarColaborador('${c.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirColaborador('${c.id}')">✕</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="7" class="td-loading">Sem registros.</td></tr>';
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

// ===================== LOCAIS: INSTITUIÇÕES & BLOCOS (catálogo de localização dos ativos) =====================
// Substitui os antigos campos de texto livre "Bloco/Edificação" e "Instituição/Unidade"
// em equipamentos.html por seleção a partir de um cadastro centralizado (locais.html).
// Bloco é sempre vinculado em cascata a uma Instituição (instituicao_id).

// Popula um <select> de Instituições/Unidades. comTodasOpcao=true usa "Todas as Instituições"
// como placeholder (uso em filtros); caso contrário usa "— Selecione —" (uso em formulários).
async function popularSelectInstituicoes(selectId, comTodasOpcao) {
  const sel = $(selectId); if (!sel) return;
  const valorAtual = sel.value;
  const { data } = await db.from('instituicoes').select('id, nome').order('nome', { ascending: true });
  sel.innerHTML = (comTodasOpcao ? '<option value="">Todas as Instituições</option>' : '<option value="">— Selecione —</option>')
    + (data || []).map(i => `<option value="${i.id}">${escapeHTML(i.nome)}</option>`).join('');
  if (valorAtual) sel.value = valorAtual;
}

// Popula um <select> de Blocos/Edificações filtrado pela Instituição escolhida (cascata).
// Sem instituicaoId, o select fica vazio e desabilitado.
async function popularSelectBlocos(instituicaoId, selectId) {
  const sel = $(selectId); if (!sel) return;
  if (!instituicaoId) {
    sel.innerHTML = '<option value="">— Selecione a instituição primeiro —</option>';
    sel.disabled = true;
    return;
  }
  const { data } = await db.from('blocos').select('id, nome').eq('instituicao_id', instituicaoId).order('nome', { ascending: true });
  sel.disabled = false;
  sel.innerHTML = '<option value="">— Selecione —</option>'
    + (data || []).map(b => `<option value="${b.id}">${escapeHTML(b.nome)}</option>`).join('');
}

// Disparado pelo onchange do select de Instituição em equipamentos.html
async function atualizarSelectBlocosCascata(manterValor) {
  const instId = $('eq-instituicao-id')?.value || '';
  const blocoAnterior = manterValor ? $('eq-bloco-id')?.value : '';
  await popularSelectBlocos(instId, 'eq-bloco-id');
  if (blocoAnterior) $('eq-bloco-id').value = blocoAnterior;
}

// ----- CRUD: Instituições / Unidades -----
let _instituicoesCache = [];

async function carregarInstituicoes() {
  const tbody = $('tbody-instituicoes'); if (!tbody) return;
  const { data: instituicoes } = await db.from('instituicoes').select('*').order('nome', { ascending: true });
  const { data: blocosTodos }  = await db.from('blocos').select('instituicao_id');
  _instituicoesCache = instituicoes || [];
  const countMap = {};
  (blocosTodos || []).forEach(b => { countMap[b.instituicao_id] = (countMap[b.instituicao_id] || 0) + 1; });
  tbody.innerHTML = _instituicoesCache.length ? _instituicoesCache.map(i => `<tr>
      <td><strong>${escapeHTML(i.nome)}</strong></td>
      <td style="text-align:center;"><span class="tag-badge">${countMap[i.id] || 0}</span></td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarInstituicao('${i.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirInstituicao('${i.id}')">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="3" class="td-loading">Sem registros.</td></tr>';
}

function editarInstituicao(id) {
  const i = _instituicoesCache.find(x => x.id === id); if (!i) return;
  $('inst-id-edicao').value = i.id;
  $('inst-nome').value = i.nome || '';
  $('btn-salvar-instituicao').textContent = '💾 Atualizar Instituição';
  $('btn-cancelar-instituicao').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetarFormInstituicao() {
  $('inst-id-edicao').value = '';
  $('inst-nome').value = '';
  $('btn-salvar-instituicao').textContent = '💾 Salvar Instituição';
  $('btn-cancelar-instituicao').style.display = 'none';
}

async function excluirInstituicao(id) {
  if (!confirm('Remover esta Instituição/Unidade? Só será possível se não houver Blocos ou Ativos vinculados a ela.')) return;
  const { error } = await db.from('instituicoes').delete().eq('id', id);
  if (error) { alert('Não foi possível remover: ' + error.message); return; }
  carregarInstituicoes();
  popularSelectInstituicoes('bloco-instituicao');
  popularSelectInstituicoes('filtro-bloco-instituicao', true);
}

if ($('btn-salvar-instituicao')) {
  $('btn-salvar-instituicao').addEventListener('click', async () => {
    const nome = $('inst-nome')?.value.trim();
    if (!nome) { msgForm('msg-instituicao', 'Informe o nome da Instituição/Unidade.', 'red'); return; }
    msgForm('msg-instituicao', 'Salvando...', 'blue');
    const idEd = $('inst-id-edicao')?.value;
    const { error } = idEd
      ? await db.from('instituicoes').update({ nome }).eq('id', idEd)
      : await db.from('instituicoes').insert([{ nome }]);
    if (error) { msgForm('msg-instituicao', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-instituicao', idEd ? '✓ Instituição atualizada!' : '✓ Instituição salva!', 'green');
    resetarFormInstituicao();
    carregarInstituicoes();
    popularSelectInstituicoes('bloco-instituicao');
    popularSelectInstituicoes('filtro-bloco-instituicao', true);
  });
}

// ----- CRUD: Blocos / Edificações -----
let _blocosCache = [];

async function carregarBlocos() {
  const tbody = $('tbody-blocos'); if (!tbody) return;
  const filtroInst = $('filtro-bloco-instituicao')?.value || '';
  let query = db.from('blocos').select('*, instituicoes(nome)').order('nome', { ascending: true });
  if (filtroInst) query = query.eq('instituicao_id', filtroInst);
  const { data: blocos } = await query;
  const { data: eqs } = await db.from('equipamentos').select('bloco_id');
  _blocosCache = blocos || [];
  const countMap = {};
  (eqs || []).forEach(e => { if (e.bloco_id) countMap[e.bloco_id] = (countMap[e.bloco_id] || 0) + 1; });
  tbody.innerHTML = _blocosCache.length ? _blocosCache.map(b => `<tr>
      <td><strong>${escapeHTML(b.nome)}</strong></td>
      <td>${escapeHTML(b.instituicoes?.nome)}</td>
      <td style="text-align:center;"><span class="tag-badge">${countMap[b.id] || 0}</span></td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarBloco('${b.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirBloco('${b.id}')">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4" class="td-loading">Sem registros.</td></tr>';
}

function editarBloco(id) {
  const b = _blocosCache.find(x => x.id === id); if (!b) return;
  $('bloco-id-edicao').value = b.id;
  $('bloco-instituicao').value = b.instituicao_id || '';
  $('bloco-nome').value = b.nome || '';
  $('btn-salvar-bloco').textContent = '💾 Atualizar Bloco';
  $('btn-cancelar-bloco').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetarFormBloco() {
  $('bloco-id-edicao').value = '';
  $('bloco-instituicao').value = '';
  $('bloco-nome').value = '';
  $('btn-salvar-bloco').textContent = '💾 Salvar Bloco';
  $('btn-cancelar-bloco').style.display = 'none';
}

async function excluirBloco(id) {
  if (!confirm('Remover este Bloco/Edificação? Só será possível se não houver Ativos vinculados a ele.')) return;
  const { error } = await db.from('blocos').delete().eq('id', id);
  if (error) { alert('Não foi possível remover: ' + error.message); return; }
  carregarBlocos();
}

if ($('btn-salvar-bloco')) {
  $('btn-salvar-bloco').addEventListener('click', async () => {
    const instituicao_id = $('bloco-instituicao')?.value;
    const nome = $('bloco-nome')?.value.trim();
    if (!instituicao_id || !nome) { msgForm('msg-bloco', 'Selecione a Instituição e informe o nome do Bloco.', 'red'); return; }
    msgForm('msg-bloco', 'Salvando...', 'blue');
    const idEd = $('bloco-id-edicao')?.value;
    const { error } = idEd
      ? await db.from('blocos').update({ instituicao_id, nome }).eq('id', idEd)
      : await db.from('blocos').insert([{ instituicao_id, nome }]);
    if (error) { msgForm('msg-bloco', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-bloco', idEd ? '✓ Bloco atualizado!' : '✓ Bloco salvo!', 'green');
    resetarFormBloco();
    carregarBlocos();
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

    const fAntes  = await uploadFotos($('pmoc-foto-antes')?.files,  'pmoc', 'msg-ficha');
    const fDepois = await uploadFotos($('pmoc-foto-depois')?.files, 'pmoc', 'msg-ficha');
    const fotos_urls = [
      ...fAntes.map(url  => ({ url, tipo: 'antes'  })),
      ...fDepois.map(url => ({ url, tipo: 'depois' })),
    ];
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
    if (fotos_urls.length) payload.fotos_urls = fotos_urls;

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

// ===================== CHECKLISTS PMOC — definições completas por categoria/periodicidade =====================
// Espelha exatamente os itens cadastrados no formulário (pmoc.html), para reconstruir o laudo
// agrupado por periodicidade (Mensal/Trimestral/Semestral/Anual), igual ao modelo de referência.
const CHECKLIST_PMOC_DEFS = {
  AC: {
    mensal: [
      ['bio_01', '[BIO-01] Bandeja de Condensados — Limpeza e Sanitizante'],
      ['bio_02', '[BIO-02] Rede de Drenagem — Desobstrução e Teste de Escoamento'],
      ['fil_01', '[FIL-01] Filtros de Ar (G4/F7/F9) — Higienização ou Substituição'],
      ['mec_01', '[MEC-01] Conjunto Ventilação — Ruídos, Coxins e Fixadores'],
    ],
    trimestral: [
      ['amb_01', '[AMB-01] Ambiente Climatizado — Verificação de Sujidade, Odores Desagradáveis e Fontes de Ruído'],
      ['amb_02', '[AMB-02] Verificação de Infiltrações e Armazenagem Inadequada de Produtos Químicos no Ambiente'],
      ['amb_03', '[AMB-03] Verificação de Fontes de Radiação e Demais Riscos à Qualidade do Ar Interior'],
      ['amb_04', '[AMB-04] Avaliação Geral das Condições de Limpeza e Conservação do Ambiente Climatizado'],
      ['bio_03', '[BIO-03] Serpentinas — Limpeza Química com Produto Específico por Pressão'],
      ['ele_01', '[ELE-01] Medição de Corrente/Tensão dos Compressores e Motores'],
      ['ele_02', '[ELE-02] Reaperto Geral dos Bornes de Comando e Potência'],
      ['fil_02', '[FIL-02] Diferencial de Pressão de Filtros — Medição com Manômetro'],
      ['mec_02', '[MEC-02] Lubrificação de Rolamentos e Buchas do Motoventilador'],
    ],
    semestral: [
      ['bio_04', '[BIO-04] Coleta de Amostra de Água para Análise Microbiológica'],
      ['dut_01', '[DUT-01] Dutos e Caixa de Plenum — Verificação de Sujeira (Interna/Externa), Danos e Corrosão'],
      ['dut_02', '[DUT-02] Verificação da Vedação das Portas de Inspeção e das Conexões dos Dutos'],
      ['dut_03', '[DUT-03] Verificação e Eliminação de Danos no Isolamento Térmico dos Dutos'],
      ['dut_04', '[DUT-04] Bocas de Ar (Insuflamento/Retorno) — Verificação de Sujeira, Fixação e Medição de Vazão'],
      ['dut_05', '[DUT-05] Registros de Ar (Dampers) e Tomada de Ar Externo — Funcionamento, Bloqueio e Balanceamento'],
      ['ele_03', '[ELE-03] Medição de Isolamento Elétrico (Megôhmetro) dos Motores'],
      ['ele_04', '[ELE-04] Teste dos Dispositivos de Proteção (Pressostatos e Termostatos)'],
      ['ins_01', '[INS-01] Inspeção Estrutural — Suportes, Fixações e Isolamento Térmico das Linhas'],
      ['mec_03', '[MEC-03] Inspeção e Substituição de Correias e Polias (se aplicável)'],
      ['ref_01', '[REF-01] Verificação de Carga de Gás Refrigerante (Pressão de Alta/Baixa)'],
      ['ref_02', '[REF-02] Verificação de Vazamentos no Circuito Frigorífico (Detector de Gás)'],
    ],
    anual: [
      ['bio_05', '[BIO-05] Higienização Completa e Laudos Microbiológicos do Sistema de Ar'],
      ['ele_05', '[ELE-05] Revisão de Capacitores e Contatores com Desgaste Visível'],
      ['ele_06', '[ELE-06] Termografia Elétrica do Painel de Comando e Cabos de Alimentação'],
      ['ins_02', '[INS-02] Revisão Geral do PMOC — Atualização de Documentação e ART'],
      ['ins_03', '[INS-03] Análise de Desempenho — Delta T Evaporador, COP e Eficiência do Sistema'],
      ['mec_04', '[MEC-04] Substituição de Rolamentos, Buchas e Selos Mecânicos Desgastados'],
      ['mec_05', '[MEC-05] Limpeza e Inspeção do Compressor — Verificação de Óleo e Visor'],
      ['ref_03', '[REF-03] Substituição de Gás Refrigerante (se necessário) e Registro ART/Boletim'],
    ],
  },
  BEB: {
    mensal: [
      ['beb_01', '[BEB-01] Limpeza Externa — Gabinete, Torneiras e Bica (produto neutro)'],
      ['beb_02', '[BEB-02] Verificação do Funcionamento do Sistema de Refrigeração (temperatura adequada)'],
      ['beb_03', '[BEB-03] Inspeção Visual de Vazamentos nas Conexões e Tubulações'],
      ['beb_04', '[BEB-04] Verificação e Higienização da Bandeja Coletora'],
    ],
    trimestral: [
      ['beb_05', '[BEB-05] Higienização Interna Completa com Solução Sanitizante (hipoclorito)'],
      ['beb_06', '[BEB-06] Limpeza e Verificação do Reservatório Interno de Água'],
      ['beb_07', '[BEB-07] Verificação de Carga de Gás / Funcionamento do Compressor'],
      ['beb_08', '[BEB-08] Verificação de Validade e Condição do Elemento Filtrante'],
    ],
    semestral: [
      ['beb_09', '[BEB-09] Substituição do Elemento Filtrante (carvão ativado / sedimentos)'],
      ['beb_10', '[BEB-10] Análise Microbiológica da Água (coleta para laudo laboratorial)'],
      ['beb_11', '[BEB-11] Verificação e Regulagem da Temperatura de Saída da Água'],
      ['beb_12', '[BEB-12] Aplicação de Lacre e Registro de Sanitização com Número de Protocolo'],
    ],
    anual: [
      ['beb_13', '[BEB-13] Revisão Completa do Sistema de Refrigeração (compressor, termostato, serpentina)'],
      ['beb_14', '[BEB-14] Substituição de Vedações, O-rings e Torneiras com Desgaste Aparente'],
      ['beb_15', '[BEB-15] Laudo Sanitário Anual — Documentação e Registro em Livro de Controle ANVISA'],
    ],
  },
  CLIM: {
    mensal: [
      ['clm_01', '[CLM-01] Limpeza do Reservatório de Água — Remoção de Lodo e Calcário'],
      ['clm_02', '[CLM-02] Limpeza e Inspeção do Painel Evaporativo (sem danificar as células)'],
      ['clm_03', '[CLM-03] Verificação do Nível e Funcionamento da Boia de Controle de Água'],
      ['clm_04', '[CLM-04] Verificação da Bomba d\'Água — Funcionamento e Fluxo de Distribuição'],
      ['clm_05', '[CLM-05] Inspeção do Ventilador Axial — Ruídos, Vibração e Fixação da Hélice'],
    ],
    trimestral: [
      ['clm_06', '[CLM-06] Limpeza Química do Reservatório — Descalcificação com Produto Específico'],
      ['clm_07', '[CLM-07] Verificação e Limpeza dos Distribuidores de Água (chuveiros/aspersores)'],
      ['clm_08', '[CLM-08] Medição de Corrente do Motor do Ventilador e da Bomba (amperagem)'],
      ['clm_09', '[CLM-09] Lubrificação de Rolamentos do Motor e da Bomba'],
    ],
    semestral: [
      ['clm_10', '[CLM-10] Inspeção do Estado do Painel Evaporativo — Avaliação para Substituição'],
      ['clm_11', '[CLM-11] Análise Microbiológica da Água do Reservatório (Controle de Legionela)'],
      ['clm_12', '[CLM-12] Verificação do Sistema Elétrico — Quadro, Contactores e Proteções'],
      ['clm_13', '[CLM-13] Tratamento Biocida da Água — Aplicação de Produto Antiincrustante'],
    ],
    anual: [
      ['clm_14', '[CLM-14] Substituição do Painel Evaporativo (celulose ou polipropileno)'],
      ['clm_15', '[CLM-15] Revisão Geral da Bomba — Impelidor, Eixo e Vedação Mecânica'],
      ['clm_16', '[CLM-16] Laudo e Documentação Técnica Anual — Relatório de Controle de Qualidade da Água'],
    ],
  },
  VEN: {
    mensal: [
      ['ven_01', '[VEN-01] Limpeza das Pás / Hélice e Grelha de Proteção (remoção de poeira acumulada)'],
      ['ven_02', '[VEN-02] Verificação de Ruídos Anormais, Vibração Excessiva e Folgas Mecânicas'],
      ['ven_03', '[VEN-03] Verificação de Fixação — Parafusos, Bucins e Suportes'],
    ],
    trimestral: [
      ['ven_04', '[VEN-04] Lubrificação dos Rolamentos / Buchas com Graxa Adequada'],
      ['ven_05', '[VEN-05] Medição de Corrente do Motor (amperagem nominal x real)'],
      ['ven_06', '[VEN-06] Verificação e Reaperto das Conexões Elétricas no Quadro de Comando'],
    ],
    semestral: [
      ['ven_07', '[VEN-07] Medição de Isolamento Elétrico (Megôhmetro) do Motor'],
      ['ven_08', '[VEN-08] Análise de Vibração com Acelerômetro — Verificação de Desbalanceamento'],
    ],
    anual: [
      ['ven_09', '[VEN-09] Substituição de Rolamentos e Buchas com Desgaste Aparente'],
      ['ven_10', '[VEN-10] Balanceamento Dinâmico das Pás / Hélice (se aplicável)'],
    ],
  },
  OUT: {
    mensal: [
      ['ger_01', '[GER-01] Inspeção Visual Geral do Equipamento — Estado de Conservação e Integridade'],
      ['ger_02', '[GER-02] Limpeza Geral — Remoção de Poeira, Oxidação e Sujidades'],
      ['ger_03', '[GER-03] Verificação de Fixação — Suportes, Parafusos e Estrutura'],
      ['ger_04', '[GER-04] Verificação Elétrica — Conexões, Chave Geral e Proteções'],
      ['ger_05', '[GER-05] Teste de Funcionamento e Verificação de Parâmetros Operacionais'],
    ],
    trimestral: [], semestral: [], anual: [],
  },
};
const CHECKLIST_PERIODICIDADE_INFO = [
  { key: 'mensal',     freqLetra: 'M', titulo: '🔧 Rotinas Mensais'     },
  { key: 'trimestral', freqLetra: 'T', titulo: '📅 Rotinas Trimestrais' },
  { key: 'semestral',  freqLetra: 'S', titulo: '📆 Rotinas Semestrais'  },
  { key: 'anual',      freqLetra: 'A', titulo: '📋 Rotinas Anuais'      },
];
const CHECKLIST_STATUS_LABEL = {
  C:  '<span class="ok">✓ Conforme</span>',
  NC: '<span class="nok">✗ Não Conforme</span>',
  NA: '<span class="na">N/A</span>',
};

// Monta as tabelas do checklist agrupadas por periodicidade, de forma cumulativa conforme a
// frequência do PMOC (Mensal ⊂ Trimestral ⊂ Semestral ⊂ Anual) — mesma regra usada no formulário.
function montarSecoesChecklistPMOC(categoria, frequenciaPalavra, checklist) {
  const freqMapInverso = { Mensal: 'M', Trimestral: 'T', Semestral: 'S', Anual: 'A' };
  const freqLetra = freqMapInverso[frequenciaPalavra] || 'M';
  const ativas    = FREQ_HIERARQUIA[freqLetra] || ['M'];
  const defs      = CHECKLIST_PMOC_DEFS[categoria] || CHECKLIST_PMOC_DEFS.OUT;

  return CHECKLIST_PERIODICIDADE_INFO
    .filter(p => ativas.includes(p.freqLetra) && (defs[p.key] || []).length)
    .map(p => {
      const linhas = defs[p.key].map(([codigo, label]) => {
        const status = checklist[codigo];
        return `<tr><td>${escapeHTML(label)}</td><td style="text-align:center;width:110px;">${CHECKLIST_STATUS_LABEL[status] || CHECKLIST_STATUS_LABEL.NA}</td></tr>`;
      }).join('');
      return `
        <div style="font-size:10px;font-weight:700;color:#1a56db;margin:12px 0 4px;break-after:avoid;page-break-after:avoid;">${p.titulo}</div>
        <table class="laudo-checklist-table">
          <thead><tr><th>Item Verificado</th><th style="text-align:center;width:110px;">Status</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>`;
    }).join('');
}

// Monta o checklist unificado com 12 colunas de mês.
// Cada grupo de periodicidade só ativa as colunas dos meses em que é executado.
// Colunas inativas ficam com fundo cinza (não se aplica naquele mês).
// Resultado: uma única tabela compacta por equipamento, ideal para impressão A4 paisagem.
// Checklist compacto para impressão em branco — máxima compacidade, mínimo de folhas.
// Estrutura por periodicidade: uma tabela com colunas = meses ativos daquela periodicidade.
// Cada célula de mês: C/NC/NA + data + tec (ultra-compacto).
// Rodapé de cada bloco: linha de visto do técnico e do fiscal por visita.
function montarChecklistEmBrancoHTML(categoria) {
  const defs = CHECKLIST_PMOC_DEFS[categoria] || CHECKLIST_PMOC_DEFS.OUT;

  const CFG = {
    mensal:     { meses:[0,1,2,3,4,5,6,7,8,9,10,11], bg:'#1e3a5f', badge:'M', label:'Mensal — 12 visitas/ano'                       },
    trimestral: { meses:[0,3,6,9],                    bg:'#5b21b6', badge:'T', label:'Trimestral — 4 visitas/ano (Jan·Abr·Jul·Out)'  },
    semestral:  { meses:[0,6],                        bg:'#0e7490', badge:'S', label:'Semestral — 2 visitas/ano (Jan·Jul)'            },
    anual:      { meses:[0],                          bg:'#065f46', badge:'A', label:'Anual — 1 visita/ano (Janeiro)'                 },
  };

  // Célula de mês: C/NC/NA em 3 checkboxes microscópicos + linha data + linha tec
  function _celMes(nomeMes) {
    return `<th style="width:52px;min-width:44px;text-align:center;padding:2px 1px;
                       border-left:1px solid rgba(255,255,255,.2);font-size:8px;font-weight:600;
                       color:#fff;white-space:nowrap;">${nomeMes}</th>`;
  }
  function _celDado() {
    return `<td style="width:52px;border:1px solid #dde3ea;padding:1px 2px;vertical-align:top;text-align:center;">
      <div style="font-size:7px;color:#374151;white-space:nowrap;line-height:1.5;">☐C ☐NC ☐NA</div>
      <div style="font-size:6.5px;color:#9ca3af;border-top:1px dotted #d1d5db;margin-top:1px;padding-top:1px;text-align:left;">Data:___________</div>
      <div style="font-size:6.5px;color:#9ca3af;border-top:1px dotted #d1d5db;margin-top:1px;padding-top:1px;text-align:left;">Tec.:____________</div>
    </td>`;
  }
  // Rodapé: visto técnico + fiscal por coluna de mês
  function _rodape(n) {
    const cels = Array.from({length: n}, () =>
      `<td style="border:1px solid #dde3ea;padding:1px 2px;vertical-align:top;text-align:center;width:52px;">
        <div style="font-size:6.5px;color:#9ca3af;text-align:left;">V.Tec:___________</div>
        <div style="font-size:6.5px;color:#9ca3af;border-top:1px dotted #d1d5db;margin-top:1px;padding-top:1px;text-align:left;">V.Fis:____________</div>
      </td>`
    ).join('');
    return `<tr>
      <td style="border:1px solid #dde3ea;padding:2px 6px;font-size:7px;font-weight:700;
                 color:#374151;background:#f9fafb;white-space:nowrap;">Visto / Assinatura</td>
      ${cels}
    </tr>`;
  }

  return CHECKLIST_PERIODICIDADE_INFO
    .filter(p => (defs[p.key] || []).length)
    .map(p => {
      const cfg   = CFG[p.key];
      const itens = defs[p.key];
      const nMes  = cfg.meses.length;

      const thMeses = cfg.meses.map(m => _celMes(MESES_ABREV[m])).join('');
      const linhas  = itens.map(([, label]) =>
        `<tr>
          <td style="font-size:8px;padding:2px 6px;border:1px solid #dde3ea;line-height:1.25;">${escapeHTML(label)}</td>
          ${Array.from({length: nMes}, _celDado).join('')}
        </tr>`
      ).join('');

      return `<div style="margin-top:6px;break-inside:avoid;page-break-inside:avoid;">
        <div style="background:${cfg.bg};color:#fff;padding:3px 7px;font-size:8px;font-weight:700;
                    display:flex;align-items:center;gap:6px;">
          <span style="background:rgba(255,255,255,.22);padding:0 5px;border-radius:2px;font-weight:800;">${cfg.badge}</span>
          ${cfg.label}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8px;table-layout:fixed;">
          <thead>
            <tr style="background:${cfg.bg}dd;">
              <th style="text-align:left;padding:2px 6px;font-size:8px;font-weight:700;color:#fff;
                         border:1px solid rgba(255,255,255,.2);">Item Verificado</th>
              ${thMeses}
            </tr>
          </thead>
          <tbody>
            ${linhas}
            ${_rodape(nMes)}
          </tbody>
        </table>
      </div>`;
    }).join('');
}

// ===================== LAUDO PMOC ANUAL AGRUPADO =====================
// Gera um documento de planejamento anual por ativo, com:
//  • Capa de identificação do ativo
//  • Programação mensal (grade 12 meses) com campo de assinatura/data por visita
//  • Tabelas de itens agrupadas por periodicidade (Mensal / Trimestral / Semestral / Anual)
//    com colunas de execução para cada visita prevista no ano
// Mantém a função legada montarLaudoEmBrancoHTML por compatibilidade interna.

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Retorna quais meses (índices 0-11) uma periodicidade deve ser executada.
// Convenção: mês 0 = Janeiro. Adota o primeiro mês como âncora.
function _mesesDaPeriodidade(key) {
  switch (key) {
    case 'mensal':     return [0,1,2,3,4,5,6,7,8,9,10,11];
    case 'trimestral': return [0,3,6,9];
    case 'semestral':  return [0,6];
    case 'anual':      return [0];
    default:           return [];
  }
}

// Cabeçalho de visitas (colunas de meses ativos para uma periodicidade).
function _cabecalhoVisitas(meses) {
  return meses.map(m =>
    `<th style="text-align:center;min-width:38px;font-size:9px;padding:4px 2px;">${MESES_ABREV[m]}</th>`
  ).join('');
}

// Célula de execução: campo para data + iniciais do técnico.
function _celulaExecucao() {
  return `<td style="text-align:center;border-left:1px solid #e2e8f0;padding:3px 2px;min-width:38px;">
    <div style="font-size:7px;color:#a0aec0;border-bottom:1px dotted #cbd5e0;margin-bottom:2px;">Data</div>
    <div style="font-size:7px;color:#a0aec0;margin-top:2px;">Tec.</div>
  </td>`;
}

// Tabela de checklist de uma periodicidade com colunas de execução mensais.
function _tabelaChecklistAnual(titulo, itens, meses, corTitulo) {
  if (!itens || !itens.length) return '';
  const thVisitas  = _cabecalhoVisitas(meses);
  const numColunas = meses.length;
  const linhas = itens.map(([codigo, label]) => {
    const cels = Array.from({ length: numColunas }, () => _celulaExecucao()).join('');
    return `<tr>
      <td style="font-size:10px;padding:4px 6px;line-height:1.3;">${escapeHTML(label)}</td>
      ${cels}
    </tr>`;
  }).join('');

  return `
  <div style="margin-top:14px;break-inside:avoid;page-break-inside:avoid;">
    <div style="font-size:10px;font-weight:700;color:${corTitulo};background:${corTitulo}18;
                padding:5px 8px;border-left:3px solid ${corTitulo};margin-bottom:0;
                break-after:avoid;page-break-after:avoid;">
      ${titulo} &nbsp;·&nbsp; ${numColunas} visita${numColunas > 1 ? 's' : ''}/ano
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="text-align:left;padding:4px 6px;font-size:9px;font-weight:700;color:#4a5568;border-bottom:2px solid #e2e8f0;">Item Verificado</th>
          ${thVisitas}
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  </div>`;
}

// Grade de visitas mensais (12 meses) com campos de data, técnico e assinatura.
function _gradeVisitasMensais() {
  const celulas = MESES_ABREV.map(m => `
    <td style="border:1px solid #e2e8f0;padding:6px 4px;vertical-align:top;min-width:60px;">
      <div style="font-size:9px;font-weight:700;color:#1a56db;text-align:center;margin-bottom:4px;">${m}</div>
      <div style="font-size:8px;color:#a0aec0;border-bottom:1px dotted #cbd5e0;padding-bottom:10px;margin-bottom:4px;">Data:</div>
      <div style="font-size:8px;color:#a0aec0;border-bottom:1px dotted #cbd5e0;padding-bottom:10px;margin-bottom:4px;">Técnico:</div>
      <div style="font-size:8px;color:#a0aec0;padding-bottom:14px;">Assin.:</div>
    </td>`).join('');
  return `
  <table style="width:100%;border-collapse:collapse;margin-top:6px;table-layout:fixed;">
    <tbody><tr>${celulas}</tr></tbody>
  </table>`;
}

// Monta o laudo PMOC anual agrupado de um único ativo.
// Estrutura: capa de ID → dados da inspeção em branco → checklist Status+Observação (formato XLSX).
function montarLaudoAnualAgrupadoHTML(eq, ultimoDaLista) {
  const categoria = eq.categoria || 'OUT';
  const classeQ   = ultimoDaLista ? '' : ' laudo-pagebreak';
  const anoAtual  = new Date().getFullYear();
  const checklistHTML = montarChecklistEmBrancoHTML(categoria);

  // Checkboxes de frequência para o cabeçalho (igual ao XLSX)
  const freqChecks = `
    <div style="font-size:9px;color:#fff;text-align:right;line-height:1.8;">
      Frequência:&nbsp;
      <label style="margin-right:8px;">☐ Mensal</label>
      <label style="margin-right:8px;">☐ Trimestral</label>
      <label style="margin-right:8px;">☐ Semestral</label>
      <label>☐ Anual</label>
    </div>`;

  return `
  <div class="laudo-wrapper${classeQ}">

    <!-- CABEÇALHO compacto -->
    <div style="background:#1e3a5f;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;align-items:center;border-radius:4px 4px 0 0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${LOGO_ETIQUETA}" alt="Logo" style="height:26px;width:auto;display:block;filter:brightness(0) invert(1);">
        <div>
          <div style="font-size:11px;font-weight:700;line-height:1.2;">Plano de Manutenção, Operação e Controle (PMOC)</div>
          <div style="font-size:8.5px;opacity:.8;margin-top:1px;">Laudo para Preenchimento em Campo — ${anoAtual} &nbsp;·&nbsp; TAG: <strong>${escapeHTML(eq.tag)}</strong></div>
        </div>
      </div>
      <div style="font-size:8px;opacity:.9;white-space:nowrap;">
        ☐ Mensal &nbsp;☐ Trimestral &nbsp;☐ Semestral &nbsp;☐ Anual
      </div>
    </div>

    <!-- IDENTIFICAÇÃO DO ATIVO — compacto em 2 linhas -->
    <div style="border:1px solid #e2e8f0;border-top:3px solid #1e3a5f;padding:5px 10px;background:#fafbfc;">
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px 14px;">
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">TAG</div><div style="font-size:10px;font-weight:700;color:#1e3a5f;">${escapeHTML(eq.tag)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Equipamento</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.produto || categoria)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Marca</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.marca)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Nº Série</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.nr_serie)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Patrimônio</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.patrimonio)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Potência</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.potencia || '—')}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Bloco</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.bloco)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Setor</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.setor)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Sala/Local</div><div style="font-size:9.5px;font-weight:600;">${escapeHTML(eq.sala)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Técnico</div><div style="font-size:9px;border-bottom:1px solid #cbd5e0;min-height:16px;"></div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Data da Inspeção</div><div style="font-size:9px;border-bottom:1px solid #cbd5e0;min-height:16px;"></div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Fiscal/Validador</div><div style="font-size:9px;border-bottom:1px solid #cbd5e0;min-height:16px;"></div></div>
      </div>
    </div>

    <!-- CHECKLIST compacto -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:4px 10px 6px;">
      <div style="font-size:7.5px;font-weight:700;color:#1e3a5f;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;padding-bottom:2px;border-bottom:1px solid #e2e8f0;">Checklist de Manutenção · Marque C / NC / NA · Registre Data e Técnico</div>
      ${checklistHTML}
    </div>

    <!-- OBSERVAÇÕES + ASSINATURAS compactos em bloco único -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:4px 10px;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="flex:2;">
          <div style="font-size:7px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Observações Técnicas</div>
          <div style="border:1px solid #e2e8f0;height:32px;border-radius:2px;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:30px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:7.5px;color:#4a5568;margin-top:2px;">Técnico Executor</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:30px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:7.5px;color:#4a5568;margin-top:2px;">Fiscal / Validador</div>
        </div>
        <div style="flex:1.4;text-align:center;">
          <div style="height:30px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:7.5px;color:#4a5568;margin-top:2px;">Resp. Técnico — CREA / ART nº ________</div>
        </div>
      </div>
    </div>

  </div>`;
}

// Mantém a versão legada (laudo por visita individual) para compatibilidade interna.
function montarLaudoEmBrancoHTML(eq, ultimoDaLista) {
  return montarLaudoAnualAgrupadoHTML(eq, ultimoDaLista);
}

// Emite, em um único documento de impressão, o laudo PMOC anual agrupado de cada ativo
// cadastrado (respeita os filtros aplicados na tela de Gerenciamento de Ativos).
// Cada ativo ocupa seu próprio bloco; a grade de 12 meses e os checklists por periodicidade
// ficam consolidados em uma única página/documento por ativo.
function emitirLaudosEmBrancoPMOC() {
  const items = obterEquipamentosFiltrados();
  if (!items.length) { alert('Nenhum ativo encontrado para gerar laudos em branco com os filtros atuais.'); return; }
  const html = items.map((eq, i) => montarLaudoAnualAgrupadoHTML(eq, i === items.length - 1)).join('');
  imprimir('area-laudos-em-branco', html);
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
    // ── Climatização (AC) — Rotinas Mensais ──
    fil_01: '[FIL-01] Filtros de Ar (G4/F7/F9) — Higienização ou Substituição',
    bio_01: '[BIO-01] Bandeja de Condensados — Limpeza e Pastilha Sanitizante',
    bio_02: '[BIO-02] Rede de Drenagem — Desobstrução e Teste de Escoamento',
    mec_01: '[MEC-01] Conjunto Ventilação — Ruídos, Coxins e Fixadores',
    // ── Trimestrais ──
    fil_02: '[FIL-02] Diferencial de Pressão de Filtros — Medição com Manômetro',
    bio_03: '[BIO-03] Serpentinas — Limpeza Química com Produto Específico por Pressão',
    ele_01: '[ELE-01] Medição de Corrente/Tensão dos Compressores e Motores',
    ele_02: '[ELE-02] Reaperto Geral dos Bornes de Comando e Potência',
    mec_02: '[MEC-02] Lubrificação de Rolamentos e Buchas do Motoventilador',
    // ── Semestrais ──
    ref_01: '[REF-01] Verificação de Carga de Gás Refrigerante (Pressão de Alta/Baixa)',
    ref_02: '[REF-02] Verificação de Vazamentos no Circuito Frigorífico (Detector de Gás)',
    ele_03: '[ELE-03] Medição de Isolamento Elétrico (Megôhmetro) dos Motores',
    ele_04: '[ELE-04] Teste dos Dispositivos de Proteção (Pressostatos e Termostatos)',
    mec_03: '[MEC-03] Inspeção e Substituição de Correias e Polias (se aplicável)',
    bio_04: '[BIO-04] Coleta de Amostra de Água para Análise Microbiológica',
    ins_01: '[INS-01] Inspeção Estrutural — Suportes, Fixações e Isolamento Térmico das Linhas',
    // ── Anuais ──
    ref_03: '[REF-03] Substituição de Gás Refrigerante (se necessário) e Registro ART/Boletim',
    mec_04: '[MEC-04] Substituição de Rolamentos, Buchas e Selos Mecânicos Desgastados',
    mec_05: '[MEC-05] Limpeza e Inspeção do Compressor — Verificação de Óleo e Visor',
    ele_05: '[ELE-05] Revisão de Capacitores e Contatores com Desgaste Visível',
    ele_06: '[ELE-06] Termografia Elétrica do Painel de Comando e Cabos de Alimentação',
    bio_05: '[BIO-05] Higienização Completa e Laudos Microbiológicos do Sistema de Ar',
    ins_02: '[INS-02] Revisão Geral do PMOC — Atualização de Documentação e ART',
    ins_03: '[INS-03] Análise de Desempenho — Delta T Evaporador, COP e Eficiência do Sistema',

    // ── Bebedouros / Purificadores (BEB) ──
    beb_01: '[BEB-01] Limpeza Externa — Gabinete, Torneiras e Bica (produto neutro)',
    beb_02: '[BEB-02] Verificação do Funcionamento do Sistema de Refrigeração (temperatura adequada)',
    beb_03: '[BEB-03] Inspeção Visual de Vazamentos nas Conexões e Tubulações',
    beb_04: '[BEB-04] Verificação e Higienização da Bandeja Coletora',
    beb_05: '[BEB-05] Higienização Interna Completa com Solução Sanitizante (hipoclorito)',
    beb_06: '[BEB-06] Limpeza e Verificação do Reservatório Interno de Água',
    beb_07: '[BEB-07] Verificação de Carga de Gás / Funcionamento do Compressor',
    beb_08: '[BEB-08] Verificação de Validade e Condição do Elemento Filtrante',
    beb_09: '[BEB-09] Substituição do Elemento Filtrante (carvão ativado / sedimentos)',
    beb_10: '[BEB-10] Análise Microbiológica da Água (coleta para laudo laboratorial)',
    beb_11: '[BEB-11] Verificação e Regulagem da Temperatura de Saída da Água',
    beb_12: '[BEB-12] Aplicação de Lacre e Registro de Sanitização com Número de Protocolo',
    beb_13: '[BEB-13] Revisão Completa do Sistema de Refrigeração (compressor, termostato, serpentina)',
    beb_14: '[BEB-14] Substituição de Vedações, O-rings e Torneiras com Desgaste Aparente',
    beb_15: '[BEB-15] Laudo Sanitário Anual — Documentação e Registro em Livro de Controle ANVISA',

    // ── Climatizadores Evaporativos (CLIM) ──
    clm_01: "[CLM-01] Limpeza do Reservatório de Água — Remoção de Lodo e Calcário",
    clm_02: '[CLM-02] Limpeza e Inspeção do Painel Evaporativo (sem danificar as células)',
    clm_03: '[CLM-03] Verificação do Nível e Funcionamento da Boia de Controle de Água',
    clm_04: "[CLM-04] Verificação da Bomba d'Água — Funcionamento e Fluxo de Distribuição",
    clm_05: '[CLM-05] Inspeção do Ventilador Axial — Ruídos, Vibração e Fixação da Hélice',
    clm_06: '[CLM-06] Limpeza Química do Reservatório — Descalcificação com Produto Específico',
    clm_07: '[CLM-07] Verificação e Limpeza dos Distribuidores de Água (chuveiros/aspersores)',
    clm_08: '[CLM-08] Medição de Corrente do Motor do Ventilador e da Bomba (amperagem)',
    clm_09: '[CLM-09] Lubrificação de Rolamentos do Motor e da Bomba',
    clm_10: '[CLM-10] Inspeção do Estado do Painel Evaporativo — Avaliação para Substituição',
    clm_11: '[CLM-11] Análise Microbiológica da Água do Reservatório (Controle de Legionela)',
    clm_12: '[CLM-12] Verificação do Sistema Elétrico — Quadro, Contactores e Proteções',
    clm_13: '[CLM-13] Tratamento Biocida da Água — Aplicação de Produto Antiincrustante',
    clm_14: '[CLM-14] Substituição do Painel Evaporativo (celulose ou polipropileno)',
    clm_15: '[CLM-15] Revisão Geral da Bomba — Impelidor, Eixo e Vedação Mecânica',
    clm_16: '[CLM-16] Laudo e Documentação Técnica Anual — Relatório de Controle de Qualidade da Água',

    // ── Ventiladores / Exaustores (VEN) ──
    ven_01: '[VEN-01] Limpeza das Pás / Hélice e Grelha de Proteção (remoção de poeira acumulada)',
    ven_02: '[VEN-02] Verificação de Ruídos Anormais, Vibração Excessiva e Folgas Mecânicas',
    ven_03: '[VEN-03] Verificação de Fixação — Parafusos, Bucins e Suportes',
    ven_04: '[VEN-04] Lubrificação dos Rolamentos / Buchas com Graxa Adequada',
    ven_05: '[VEN-05] Medição de Corrente do Motor (amperagem nominal x real)',
    ven_06: '[VEN-06] Verificação e Reaperto das Conexões Elétricas no Quadro de Comando',
    ven_07: '[VEN-07] Medição de Isolamento Elétrico (Megôhmetro) do Motor',
    ven_08: '[VEN-08] Análise de Vibração com Acelerômetro — Verificação de Desbalanceamento',
    ven_09: '[VEN-09] Substituição de Rolamentos e Buchas com Desgaste Aparente',
    ven_10: '[VEN-10] Balanceamento Dinâmico das Pás / Hélice (se aplicável)',

    // ── Outros Equipamentos (GER) ──
    ger_01: '[GER-01] Inspeção Visual Geral do Equipamento — Estado de Conservação e Integridade',
    ger_02: '[GER-02] Limpeza Geral — Remoção de Poeira, Oxidação e Sujidades',
    ger_03: '[GER-03] Verificação de Fixação — Suportes, Parafusos e Estrutura',
    ger_04: '[GER-04] Verificação Elétrica — Conexões, Chave Geral e Proteções',
    ger_05: '[GER-05] Teste de Funcionamento e Verificação de Parâmetros Operacionais',

    // ── Compatibilidade com chaves antigas (registros legados) ──
    'limpeza-filtro': 'Limpeza de Filtro', 'limpeza-evaporadora': 'Limpeza Evaporadora',
    'limpeza-condensadora': 'Limpeza Condensadora', 'verificacao-dreno': 'Verificação de Dreno',
    'verificacao-eletrica': 'Verificação Elétrica', 'verificacao-fluido': 'Verificação de Fluido',
    'teste-operacao': 'Teste de Operação', 'verificacao-ruidos': 'Verificação de Ruídos', 'limpeza-geral': 'Limpeza Geral',
  };
  // ── Periodicidade de cada item do checklist (para agrupar no laudo) ──
  const PERIODO_CHK = {
    fil_01:'M', bio_01:'M', bio_02:'M', mec_01:'M', ger_01:'M', ger_02:'M', ger_03:'M', ger_04:'M', ger_05:'M',
    beb_01:'M', beb_02:'M', beb_03:'M', beb_04:'M', clm_01:'M', clm_02:'M', clm_03:'M', clm_04:'M', clm_05:'M',
    ven_01:'M', ven_02:'M', ven_03:'M',
    fil_02:'T', bio_03:'T', ele_01:'T', ele_02:'T', mec_02:'T',
    beb_05:'T', beb_06:'T', beb_07:'T', beb_08:'T', clm_06:'T', clm_07:'T', clm_08:'T', clm_09:'T',
    ven_04:'T', ven_05:'T', ven_06:'T',
    ref_01:'S', ref_02:'S', ele_03:'S', ele_04:'S', mec_03:'S', bio_04:'S', ins_01:'S',
    beb_09:'S', beb_10:'S', beb_11:'S', beb_12:'S', clm_10:'S', clm_11:'S', clm_12:'S', clm_13:'S',
    ven_07:'S', ven_08:'S',
    ref_03:'A', mec_04:'A', mec_05:'A', ele_05:'A', ele_06:'A', bio_05:'A', ins_02:'A', ins_03:'A',
    beb_13:'A', beb_14:'A', beb_15:'A', clm_14:'A', clm_15:'A', clm_16:'A', ven_09:'A', ven_10:'A',
  };
  const LABEL_PERIODO = { M:'🔧 Rotinas Mensais', T:'📅 Rotinas Trimestrais', S:'📆 Rotinas Semestrais', A:'📋 Rotinas Anuais' };

  const statusChk = {
    C:  '<span class="ok">✓ Conforme</span>',
    NC: '<span class="nok">✗ Não Conforme</span>',
    NA: '<span class="na">N/A</span>',
    // Compatibilidade com registros legados
    OK:  '<span class="ok">✓ OK</span>',
    NOK: '<span class="nok">✗ NOK</span>',
  };

  // Agrupa os itens respondidos por periodicidade, na ordem M → T → S → A
  const gruposChk = { M: [], T: [], S: [], A: [] };
  Object.entries(checklist).forEach(([k,v]) => {
    const periodo = PERIODO_CHK[k] || 'M'; // chaves legadas caem em "Mensal"
    gruposChk[periodo].push(`<tr><td>${labelChk[k]||k}</td><td style="text-align:center;">${statusChk[v]||v}</td></tr>`);
  });

  const chkBlocos = ['M','T','S','A'].map(periodo => {
    if (!gruposChk[periodo].length) return '';
    return `
      <div class="laudo-chk-bloco" style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:#1a56db;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;">${LABEL_PERIODO[periodo]}</div>
        <table class="laudo-checklist-table">
          <thead><tr><th>Item Verificado</th><th style="text-align:center;width:80px;">Status</th></tr></thead>
          <tbody>${gruposChk[periodo].join('')}</tbody>
        </table>
      </div>`;
  }).join('');
  const chkRows = Object.values(gruposChk).some(g => g.length) ? chkBlocos : '';

  const assinaturaTecnicoHTML = _assinaturaImg(lerAssinaturaURL(f,'assinatura_tecnico_url','assinatura_digital'),'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');
  const assinaturaFiscalHTML  = _assinaturaImg(lerAssinaturaURL(f,'assinatura_fiscal_url','assinatura_fiscal'), 'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');

  // ── Responsável Técnico (RT) — opcional ──
  const rtNome     = f.rt_nome     || meta.rt_nome     || null;
  const rtRegistro = f.rt_registro || meta.rt_registro || null;
  const assinaturaRtHTML = rtNome
    ? _assinaturaImg(f.assinatura_rt_url, 'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;')
    : '';
  const urlValidacao = gerarUrlValidacao(f.id, 'pmoc');
  const qrCodeHTML   = gerarQrCodeSVG(urlValidacao, 100);
  const codigoLaudo  = `L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}`;
  const fotoHTML     = (f.foto_antes_url || f.foto_depois_url) ? `
    <div class="laudo-section laudo-section-nobreak">
      <div class="laudo-section-title">Evidência Fotográfica — Antes / Depois</div>
      <div class="laudo-grid">
        <div style="text-align:center;">
          <p style="font-size:10px;font-weight:700;color:#718096;text-transform:uppercase;margin-bottom:4px;">Antes</p>
          ${f.foto_antes_url ? `<img src="${f.foto_antes_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;">` : '<p style="font-size:11px;color:#a0aec0;">Não registrada</p>'}
        </div>
        <div style="text-align:center;">
          <p style="font-size:10px;font-weight:700;color:#718096;text-transform:uppercase;margin-bottom:4px;">Depois</p>
          ${f.foto_depois_url ? `<img src="${f.foto_depois_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;">` : '<p style="font-size:11px;color:#a0aec0;">Não registrada</p>'}
        </div>
      </div>
    </div>` : (f.foto_url
    ? `<div class="laudo-section laudo-section-nobreak"><div class="laudo-section-title">Evidência Fotográfica</div><img src="${f.foto_url}" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid #e2e8f0;"></div>`
    : '');

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
    <div class="laudo-section laudo-section-nobreak">
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
    <div class="laudo-section laudo-section-nobreak">
      <div class="laudo-section-title">Dados da Inspeção</div>
      <div class="laudo-grid">
        <div class="laudo-field"><label>Técnico Responsável</label><span>${escapeHTML(f.tecnico_nome)}</span></div>
        <div class="laudo-field"><label>Data da Inspeção</label><span>${escapeHTML(dataInsp)}</span></div>
      </div>
    </div>
    ${chkRows ? `
    <div class="laudo-section">
      <div class="laudo-section-title">Checklist de Manutenção — por Periodicidade</div>
      ${chkRows}
    </div>` : ''}
    ${obsLimpa ? `
    <div class="laudo-section">
      <div class="laudo-section-title">Observações Técnicas</div>
      <p style="font-size:12px;line-height:1.6;">${escapeHTML(obsLimpa)}</p>
    </div>` : ''}
    ${fotoHTML}
    <div class="laudo-section laudo-section-nobreak">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;">
        <div style="display:flex;gap:24px;align-items:flex-end;flex:1;flex-wrap:wrap;">
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaTecnicoHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(f.tecnico_nome)}<br>Técnico Executor</div>
          </div>
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaFiscalHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(fiscalNome)}<br>Fiscal / Validador do Serviço</div>
          </div>
          ${rtNome ? `
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaRtHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(rtNome)}<br>Responsável Técnico${rtRegistro ? ' — ' + escapeHTML(rtRegistro) : ''}</div>
          </div>` : ''}
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
      <div style="display:flex;align-items:center;gap:14px;"><img src="${LOGO_ETIQUETA}" alt="Logo" style="height:40px;width:auto;display:block;"><div><h1 style="font-size:16px;">Ordem de Serviço</h1><p>Registro Técnico de Manutenção</p></div></div>
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
    ${galeriaFotosHTML(os)}
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
        Sistema de Gestão Univag · ${new Date().toLocaleString('pt-BR')} · Verificação: ${urlValidacao}
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
    const fAntes  = await uploadFotos($('os-foto-antes')?.files,  'os', 'msg-os');
    const fDepois = await uploadFotos($('os-foto-depois')?.files, 'os', 'msg-os');
    const fotos_urls = [
      ...fAntes.map(url  => ({ url, tipo: 'antes'  })),
      ...fDepois.map(url => ({ url, tipo: 'depois' })),
    ];
    if (fotos_urls.length) payload.fotos_urls = fotos_urls;

    const idEd = $('os-id-edicao').value;
    const { error } = idEd
      ? await db.from('ordens_servico').update(payload).eq('id', idEd)
      : await db.from('ordens_servico').insert([payload]);
    if (error) { msgForm('msg-os', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-os', idEd ? '✓ OS atualizada!' : '✓ OS registrada!', 'green');
    resetarFormOS(); carregarOrdensServico(); carregarCentralUnificadaOS();
  });
}

// Ativa o preview das imagens selecionadas nos formulários PMOC e OS.
montarPreviewFotos('pmoc-foto-antes',  'pmoc-foto-antes-preview');
montarPreviewFotos('pmoc-foto-depois', 'pmoc-foto-depois-preview');
montarPreviewFotos('os-foto-antes',    'os-foto-antes-preview');
montarPreviewFotos('os-foto-depois',   'os-foto-depois-preview');

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
        <button class="btn-refresh" style="padding:4px 10px;font-size:11px;background:#7c3aed;border-color:#7c3aed;color:#fff;"
          onclick="abrirPreDemandaOS('OS-AC','${os.id}','OS-AC-${os.id.toString().slice(0,5).toUpperCase()}','${escapeHTML(os.equipamentos?.bloco||'')} ${escapeHTML(os.equipamentos?.setor||'')}')">📦 Pré-Demanda</button>
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
  const { data } = await db.from('ordens_servico_geral')
    .select('*')
    .order('created_at', { ascending: false });
  tbody.innerHTML = (data||[]).map(os => {
    const miniatura = (url, label) => url
      ? `<a href="${url}" target="_blank" title="${label}"><img src="${url}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;"></a>`
      : `<span style="font-size:10px;color:var(--gray-400);">${label[0]}—</span>`;
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(os))));
    return `<tr>
    <td><strong>${escapeHTML(os.numero_os||'OSG')}</strong></td>
    <td>${fmtDate(os.created_at)}</td>
    <td>${escapeHTML(os.setor)}</td>
    <td>${statusBadge(os.status_os)}</td>
    <td style="display:flex;gap:4px;align-items:center;">${miniatura(os.foto_antes_url,'Antes')} ${miniatura(os.foto_depois_url,'Depois')}</td>
    <td style="display:flex;gap:4px;flex-wrap:wrap;">
      <button class="btn-primary" style="padding:4px 10px;font-size:11px;" onclick="emitirRelatorioOSG(JSON.parse(decodeURIComponent(escape(atob('${b64}')))))">🖨️ Imprimir</button>
      <button class="btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="editarOSG('${os.id}','${(os.setor||'').replace(/'/g,'')}','${(os.servico_requisitado||'').replace(/'/g,'')}','${os.status_os}')">✏️ Editar</button>
      <button class="btn-refresh" style="padding:4px 10px;font-size:11px;background:#7c3aed;border-color:#7c3aed;color:#fff;" onclick="abrirPreDemandaOS('OS-FAC','${os.id}','OSG-${os.id.toString().slice(0,5).toUpperCase()}','${escapeHTML(os.setor||'')}')">📦 Pré-Demanda</button>
      <button class="btn-excluir" style="padding:4px 10px;font-size:11px;" onclick="excluirOSG('${os.id}')">✕ Excluir</button>
    </td>
  </tr>`;
  }).join('');
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
function resetarFormOS()  {
  ['os-defeito','os-laudo','os-id-edicao'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['os-foto-antes','os-foto-depois'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['os-foto-antes-preview','os-foto-depois-preview'].forEach(id => { if ($(id)) $(id).innerHTML = ''; });
}
function resetarFormOSG() {
  ['osg-setor','osg-requisitado','osg-falha'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('osg-foto-antes'))  $('osg-foto-antes').value  = '';
  if ($('osg-foto-depois')) $('osg-foto-depois').value = '';
}

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
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Univag — Impressão</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}@page{margin:6mm 8mm;size:A4 landscape}html,body{font-family:'Inter',Arial,sans-serif;font-size:12px;color:#1a202c;background:#fff}.laudo-wrapper{width:100%}.laudo-header{background:#1a56db;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0}.laudo-header h1{font-size:18px;font-weight:700}.laudo-header p{font-size:11px;margin-top:4px;opacity:.85}.laudo-header-meta{text-align:right;font-size:11px}.laudo-section{border:1px solid #e2e8f0;border-top:none;padding:12px 16px;break-inside:avoid;page-break-inside:avoid}.laudo-section:last-child{border-radius:0 0 6px 6px}.laudo-section-title{font-size:10px;font-weight:700;color:#1a56db;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;break-after:avoid;page-break-after:avoid}.laudo-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.laudo-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px}.laudo-field{margin-bottom:4px}.laudo-field label{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:.06em;display:block}.laudo-field span{font-size:12px;font-weight:600;color:#1a202c}.laudo-checklist-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px;break-inside:avoid;page-break-inside:avoid}.laudo-checklist-table th{background:#1a56db;color:#fff;padding:5px 8px;text-align:left;font-size:10px}.laudo-checklist-table td{padding:4px 8px;border-bottom:1px solid #e2e8f0}.laudo-checklist-table tr{break-inside:avoid;page-break-inside:avoid}.laudo-checklist-table tr:nth-child(even) td{background:#f8fafc}.ok{color:#059669;font-weight:700}.nok{color:#dc2626;font-weight:700}.na{color:#a0aec0}.laudo-assinatura-box{text-align:center;min-width:180px;break-inside:avoid;page-break-inside:avoid}.laudo-assinatura-linha{border-top:1px solid #1a202c;margin-top:8px;padding-top:4px;font-size:10px;color:#4a5568}img{max-width:100%;height:auto;display:block}.tag-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:#e2e8f0;color:#2d3748}.tag-badge.success{background:#d1fae5;color:#065f46}.tag-badge.warning{background:#fef3c7;color:#92400e}.tag-badge.danger{background:#fee2e2;color:#991b1b}.tag-badge.andamento{background:#dbeafe;color:#1e40af}.laudo-field-em-branco{font-size:9px;color:#a0aec0;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px dotted #cbd5e0;padding-bottom:20px;}.laudo-pagebreak{break-after:page;page-break-after:always;}.laudo-checkbox-status{white-space:nowrap;font-size:11px;color:#4a5568;}.laudo-section-checklist{break-inside:auto !important;page-break-inside:auto !important;padding:6px 10px !important;}.exec-label{font-size:6.5px;color:#b0b8c4;display:block;line-height:1.4;border-bottom:1px dotted #cbd5e0;padding-bottom:8px;margin-bottom:1px;}
.laudo-section{padding:6px 10px !important;}
.laudo-grid-3{gap:3px 12px !important;}
.laudo-field{margin-bottom:2px !important;}
.laudo-field label{font-size:7.5px !important;}
.laudo-field span{font-size:10px !important;}
.laudo-section-title{font-size:8.5px !important;margin-bottom:4px !important;padding-bottom:2px !important;}
p{margin:0 0 2px !important;font-size:8px !important;}
table td,table th{font-size:8px;}
table.chk-anual{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px;}
table.chk-anual th,table.chk-anual td{border:1px solid #e2e8f0;overflow:hidden;}
table.chk-anual th:first-child,table.chk-anual td:first-child{width:auto;text-align:left;}
table.chk-anual th:not(:first-child),table.chk-anual td:not(:first-child){width:36px;min-width:28px;text-align:center;}
</style></head>
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

// ===================== DASHBOARD — KPIs EXTRAS (Filtros a Vencer / PMOC Vencidos) =====================
async function carregarKPIsExtras() {
  const elFiltros = $('dash-txt-filtros-vencer');
  const elPmoc    = $('dash-txt-pmoc-vencidos');
  if (!elFiltros && !elPmoc) return;

  const hj    = new Date(); hj.setHours(0,0,0,0);
  const em30  = new Date(hj); em30.setDate(em30.getDate() + 30);
  const hjStr = hj.toISOString().split('T')[0];
  const e30Str = em30.toISOString().split('T')[0];

  const [{ data: bebs }, { data: pmocs }] = await Promise.all([
    db.from('equipamentos').select('validade').eq('categoria','BEB').not('validade','is',null).lte('validade', e30Str),
    db.from('fichas_pmoc').select('proxima_manutencao').not('proxima_manutencao','is',null).lt('proxima_manutencao', hjStr),
  ]);

  if (elFiltros) elFiltros.textContent = (bebs||[]).length;
  if (elPmoc)    elPmoc.textContent    = (pmocs||[]).length;
}

// ===================== DASHBOARD — INVENTÁRIO DE GÁS REFRIGERANTE =====================
async function carregarInventarioGas() {
  const el    = $('dash-inv-gas');
  const elTot = $('dash-gas-total');
  if (!el) return;

  const { data: eqs } = await db.from('equipamentos').select('extras_tecnico').eq('categoria','AC');
  const mapa = {};
  let totalKg = 0;

  (eqs||[]).forEach(e => {
    const extras = (typeof e.extras_tecnico === 'string')
      ? (() => { try { return JSON.parse(e.extras_tecnico); } catch(x) { return {}; } })()
      : (e.extras_tecnico || {});
    const tipo = extras['gas'] || null;
    const qtd  = parseFloat((extras['gas-qtd'] || '0').toString().replace(',','.')) || 0;
    if (tipo) {
      mapa[tipo] = (mapa[tipo] || { qtd: 0, count: 0 });
      mapa[tipo].qtd   += qtd;
      mapa[tipo].count += 1;
    }
    totalKg += qtd;
  });

  const cores = ['#1e3a5f','#4169e1','#0ea5e9','#7c3aed','#059669','#f59e0b'];
  const tipos = Object.entries(mapa).sort((a,b) => b[1].qtd - a[1].qtd);

  if (!tipos.length) {
    el.innerHTML = '<span style="color:#a0aec0;">Nenhum equipamento com gás cadastrado.</span>';
    if (elTot) elTot.textContent = '— kg';
    return;
  }

  el.innerHTML = tipos.map(([tipo, v], i) => {
    const cor = cores[i % cores.length];
    const pct = totalKg > 0 ? Math.round((v.qtd / totalKg) * 100) : 0;
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:#2d3748;">${tipo}</span>
          <span style="font-size:12px;color:#718096;">${v.qtd.toFixed(2)} kg · ${v.count} equip.</span>
        </div>
        <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;background:${cor};height:100%;border-radius:4px;transition:width .4s;"></div>
        </div>
      </div>`;
  }).join('');

  if (elTot) elTot.textContent = totalKg > 0 ? `${totalKg.toFixed(2)} kg` : '— kg';
}

// ===================== DASHBOARD — DISTRIBUIÇÃO POR CATEGORIA =====================
async function carregarDistribuicaoCategoria() {
  const el       = $('dash-dist-cat');
  const elCrit   = $('dash-cat-criticos');
  if (!el) return;

  const { data: eqs } = await db.from('equipamentos').select('categoria,criticidade');
  const mapa  = {};
  let criticos = 0;

  (eqs||[]).forEach(e => {
    const cat = e.categoria || 'OUT';
    mapa[cat] = (mapa[cat] || 0) + 1;
    if (e.criticidade === 'Alta') criticos++;
  });

  const LABEL = { AC:'❄️ Ar Condicionado', BEB:'💧 Bebedouro', CLIM:'🌀 Climatizador', VEN:'💨 Ventilador/Exaustor', OUT:'🔧 Outros' };
  const total = (eqs||[]).length;
  const ordem = ['AC','BEB','CLIM','VEN','OUT'];
  const cores  = { AC:'#4169e1', BEB:'#0ea5e9', CLIM:'#7c3aed', VEN:'#059669', OUT:'#a0aec0' };

  if (!total) {
    el.innerHTML = '<span style="color:#a0aec0;">Nenhum ativo cadastrado.</span>';
    return;
  }

  el.innerHTML = ordem.filter(c => mapa[c]).map(cat => {
    const n   = mapa[cat] || 0;
    const pct = Math.round((n / total) * 100);
    const cor = cores[cat] || '#a0aec0';
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:#2d3748;">${LABEL[cat] || cat}</span>
          <span style="font-size:12px;color:#718096;">${n} · ${pct}%</span>
        </div>
        <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;background:${cor};height:100%;border-radius:4px;"></div>
        </div>
      </div>`;
  }).join('');

  if (elCrit) elCrit.textContent = `${criticos} ativo${criticos !== 1 ? 's' : ''}`;
}

// ===================== DASHBOARD — CONFORMIDADE DE FILTROS (Bebedouros) =====================
async function carregarConformidadeFiltros() {
  const el = $('dash-conf-filtros');
  if (!el) return;

  const hj = new Date(); hj.setHours(0,0,0,0);
  const { data: bebs } = await db.from('equipamentos').select('tag,validade,bloco').eq('categoria','BEB');

  if (!bebs || !bebs.length) {
    el.innerHTML = '<span style="color:#a0aec0;">Nenhum bebedouro cadastrado.</span>';
    return;
  }

  let ok = 0, vencer = 0, vencido = 0, semData = 0;
  bebs.forEach(b => {
    if (!b.validade) { semData++; return; }
    const dt   = new Date(b.validade + 'T00:00:00');
    const diff = Math.ceil((dt - hj) / (1000*60*60*24));
    if (diff < 0)      vencido++;
    else if (diff <= 30) vencer++;
    else                 ok++;
  });

  const total = bebs.length;
  const pctOk = Math.round((ok / total) * 100);

  el.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:700;color:#059669;">✅ No prazo</span>
        <span style="font-size:13px;font-weight:700;color:#059669;">${ok}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:600;color:#f59e0b;">⚠️ Vence em 30 dias</span>
        <span style="font-size:13px;font-weight:700;color:#f59e0b;">${vencer}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:600;color:#ef4444;">🚨 Vencido</span>
        <span style="font-size:13px;font-weight:700;color:#ef4444;">${vencido}</span>
      </div>
      ${semData ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:12px;color:#a0aec0;">Sem data cadastrada</span><span style="font-size:12px;color:#a0aec0;">${semData}</span></div>` : ''}
    </div>
    <div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden;margin-top:8px;">
      <div style="width:${pctOk}%;background:#10b981;height:100%;border-radius:6px;transition:width .4s;"></div>
    </div>
    <p style="font-size:11px;color:#718096;margin:6px 0 0;text-align:right;">${pctOk}% em conformidade (${total} bebedouros)</p>`;
}

// ===================== DASHBOARD — COBERTURA PMOC POR CATEGORIA =====================
async function carregarCoberturaPMOC() {
  const el = $('dash-cob-pmoc');
  if (!el) return;

  const [{ data: eqs }, { data: fichas }] = await Promise.all([
    db.from('equipamentos').select('id,categoria'),
    db.from('fichas_pmoc').select('equipamento_id'),
  ]);

  if (!eqs || !eqs.length) {
    el.innerHTML = '<span style="color:#a0aec0;">Nenhum ativo cadastrado.</span>';
    return;
  }

  const comFicha = new Set((fichas||[]).map(f => String(f.equipamento_id)));
  const LABEL = { AC:'❄️ AC', BEB:'💧 BEB', CLIM:'🌀 CLM', VEN:'💨 VEN', OUT:'🔧 OUT' };
  const cores  = { AC:'#4169e1', BEB:'#0ea5e9', CLIM:'#7c3aed', VEN:'#059669', OUT:'#a0aec0' };
  const mapa   = {};

  eqs.forEach(e => {
    const cat = e.categoria || 'OUT';
    if (!mapa[cat]) mapa[cat] = { total: 0, com: 0 };
    mapa[cat].total++;
    if (comFicha.has(String(e.id))) mapa[cat].com++;
  });

  const totalGeral = eqs.length;
  const comGeral   = eqs.filter(e => comFicha.has(String(e.id))).length;
  const pctGeral   = Math.round((comGeral / totalGeral) * 100);

  el.innerHTML = `
    <div style="text-align:center;margin-bottom:14px;">
      <span style="font-size:28px;font-weight:800;color:#1e3a5f;">${pctGeral}%</span>
      <p style="font-size:11px;color:#718096;margin:2px 0 0;">cobertura geral (${comGeral}/${totalGeral})</p>
    </div>
    ${Object.entries(mapa).sort((a,b) => b[1].total - a[1].total).map(([cat, v]) => {
      const pct = Math.round((v.com / v.total) * 100);
      const cor = cores[cat] || '#a0aec0';
      return `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:600;color:#4a5568;">${LABEL[cat]||cat}</span>
            <span style="font-size:11px;color:#718096;">${v.com}/${v.total} · ${pct}%</span>
          </div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden;">
            <div style="width:${pct}%;background:${cor};height:100%;border-radius:4px;"></div>
          </div>
        </div>`;
    }).join('')}`;
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
  ['pmoc-foto-antes','pmoc-foto-depois'].forEach(id => { if ($(id)) $(id).value = ''; });
  ['pmoc-foto-antes-preview','pmoc-foto-depois-preview'].forEach(id => { if ($(id)) $(id).innerHTML = ''; });
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

// ===================== BRANDING — Logo Univag no lugar de "Concredur" =====================
// Roda em toda página que tenha a sidebar padrão; troca o emoji/título "🏗️ Concredur" pela
// logo institucional (mesma imagem usada em laudos, OS e etiquetas), sem precisar editar
// o HTML de cada página individualmente.
document.addEventListener('DOMContentLoaded', () => {
  const logoEl = document.querySelector('.sidebar-logo');
  if (logoEl) {
    logoEl.outerHTML = `<img src="${LOGO_ETIQUETA}" alt="Univag" style="height:30px;width:auto;display:block;margin-bottom:6px;">`;
  }
  const nomeEl = document.querySelector('.sidebar-header h3');
  if (nomeEl) nomeEl.remove();
});


// =====================================================================
//  MÓDULOS SUPRIMENTOS + CATÁLOGO
// =====================================================================

let _scCache    = [];
let _scItemSeq  = 0;

// ── Autocomplete: busca no catálogo enquanto o usuário digita ────────
async function _buscarCatalogo(termo) {
  if (!termo || termo.length < 1) return [];
  const { data } = await db.from('compras_catalogo_itens')
    .select('id, codigo, descricao, grupo, unidade_id, compras_unidades_medida(sigla)')
    .eq('ativo', true)
    .ilike('descricao', `%${termo}%`)
    .order('descricao')
    .limit(12);
  return data || [];
}

// ── Mostra dropdown de resultados abaixo do input ───────────────────
function _mostrarDropdownCatalogo(inputEl, resultados, onSelect) {
  // Reutiliza ou cria o container do dropdown — ancorado no <td> pai
  const tdPai = inputEl.closest('td') || inputEl.parentElement;
  const ddId  = 'cat-dd-' + inputEl.id;
  let dd = document.getElementById(ddId);
  if (!dd) {
    dd = document.createElement('div');
    dd.id = ddId;
    dd.style.cssText = [
      'position:absolute;top:100%;left:0;right:0;z-index:9999;',
      'background:#fff;border:1px solid #cbd5e0;border-radius:6px;',
      'box-shadow:0 4px 16px rgba(0,0,0,.14);max-height:240px;overflow-y:auto;',
      'min-width:280px;'
    ].join('');
    tdPai.style.position = 'relative';
    tdPai.appendChild(dd);
  }

  // Caso sem resultados
  if (!resultados.length || (resultados.length === 1 && resultados[0]._vazio)) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:#718096;">Nenhum item encontrado no catálogo.</div>';
    dd.style.display = 'block';
    return;
  }

  dd.style.display = 'block';
  dd.innerHTML = resultados
    .filter(r => !r._vazio)
    .map(r => {
      const sigla = r.compras_unidades_medida?.sigla || '';
      return `<div class="cat-dd-item"
        data-id="${r.id}"
        data-desc="${escapeHTML(r.descricao)}"
        data-unid="${r.unidade_id || ''}"
        data-sigla="${escapeHTML(sigla)}"
        style="padding:8px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px;"
        onmousedown="event.preventDefault()">
        <span>
          <strong style="font-family:monospace;font-size:11px;color:#4a5568;">${escapeHTML(r.codigo)}</strong>
          <span style="margin-left:8px;">${escapeHTML(r.descricao)}</span>
        </span>
        <span style="flex-shrink:0;font-size:11px;color:#718096;background:#f7fafc;padding:2px 6px;border-radius:4px;">
          ${escapeHTML(sigla)} · ${escapeHTML(r.grupo)}
        </span>
      </div>`;
    }).join('');

  dd.querySelectorAll('.cat-dd-item').forEach(el => {
    el.addEventListener('click', () => {
      onSelect({
        id:         el.dataset.id,
        descricao:  el.dataset.desc,
        unidade_id: el.dataset.unid,
        sigla:      el.dataset.sigla,
      });
      dd.style.display = 'none';
    });
    el.addEventListener('mouseover', () => el.style.background = '#f0f4ff');
    el.addEventListener('mouseout',  () => el.style.background = '');
  });
}

function _fecharDropdownsCatalogo() {
  document.querySelectorAll('[id^="cat-dd-"]').forEach(d => { d.style.display = 'none'; });
}
document.addEventListener('click', _fecharDropdownsCatalogo);

// ── Função central de bind do autocomplete (usada por SC e PD) ───────
// prefixo: 'sc' para Solicitações, 'pd' para Pré-Demandas
function _bindAutocompleteCatalogo(inp, tr, prefixo) {
  // Prefixo determina as classes dos hidden inputs
  const clsCatId  = prefixo === 'pd' ? '.pd-item-cat-id'  : '.sc-item-cat-id';
  const clsUnidId = prefixo === 'pd' ? '.pd-item-unid-id' : '.sc-item-unid-id';
  const clsSigla  = prefixo === 'pd' ? '.pd-item-sigla'   : '.sc-item-sigla';

  let _debounce = null;

  inp.addEventListener('input', () => {
    // Ao digitar, remove vínculo anterior
    const catEl  = tr.querySelector(clsCatId);
    const unidEl = tr.querySelector(clsUnidId);
    const siglaEl = tr.querySelector(clsSigla);
    if (catEl)  catEl.value  = '';
    if (unidEl) unidEl.value = '';
    if (siglaEl) siglaEl.value = '';
    inp.style.borderColor = '';
    inp.style.background  = '';
    tr.querySelectorAll('small.cat-aviso').forEach(s => s.remove());

    clearTimeout(_debounce);
    const termo = inp.value.trim();
    if (termo.length < 1) {
      _fecharDropdownsCatalogo();
      return;
    }
    _debounce = setTimeout(async () => {
      const resultados = await _buscarCatalogo(termo);
      if (!resultados.length) {
        // Mostra mensagem de "nenhum resultado" no dropdown
        _mostrarDropdownCatalogo(inp, [{ _vazio: true }], () => {});
        return;
      }
      _mostrarDropdownCatalogo(inp, resultados, (item) => {
        inp.value = item.descricao;
        if (catEl)  catEl.value  = item.id;
        if (unidEl) unidEl.value = item.unidade_id;
        if (siglaEl) siglaEl.value = item.sigla;
        inp.style.borderColor = '#48bb78';
        inp.style.background  = '#f0fff4';
        tr.querySelectorAll('small.cat-aviso').forEach(s => s.remove());
      });
    }, 280);
  });

  inp.addEventListener('focus', () => {
    const termo = inp.value.trim();
    if (termo.length >= 1) inp.dispatchEvent(new Event('input'));
  });

  inp.addEventListener('blur', () => {
    setTimeout(_fecharDropdownsCatalogo, 150);
  });
}

// ── Linhas dinâmicas de itens no formulário (com catálogo obrigatório) ──
function adicionarItemSC(desc = '', qtd = 1, unidade = '', catalogoId = '', catalogoDesc = '') {
  const tbody = $('sc-itens-tbody');
  if (!tbody) return;
  const rid   = 'sc-item-' + (++_scItemSeq);
  const inpId = 'sc-desc-' + _scItemSeq;
  const tr    = document.createElement('tr');
  tr.id = rid;
  // Se viemos de edição, desc já é o texto salvo; catalogoId é o UUID do catálogo
  const descDisplay = desc || catalogoDesc || '';
  const unidDisplay = unidade || '';
  const catIdVal    = catalogoId || '';
  tr.innerHTML = `
    <td style="position:relative;min-width:240px;">
      <input type="hidden" class="sc-item-cat-id" value="${escapeHTML(catIdVal)}">
      <input type="hidden" class="sc-item-unid-id" value="">
      <input type="text" id="${inpId}" name="sc-busca-${_scItemSeq}" class="form-input-style sc-item-desc" value="${escapeHTML(descDisplay)}"
             placeholder="Digite para buscar no catálogo..."
             autocomplete="new-password" data-form-type="other" role="combobox" aria-autocomplete="list" aria-expanded="false"
             style="${catIdVal ? 'border-color:#48bb78;background:#f0fff4;' : ''}">
      ${catIdVal ? '' : '<small class="cat-aviso" style="color:#e53e3e;font-size:10px;">⚠ Selecione um item do catálogo</small>'}
    </td>
    <td><input type="number" class="form-input-style sc-item-qtd" value="${Number(qtd) || 1}" min="0.001" step="any" style="width:90px;"></td>
    <td><input type="text" class="sc-item-sigla" value="${escapeHTML(unidDisplay)}" readonly
               style="width:70px;background:#f7fafc;color:#718096;border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;font-size:13px;"></td>
    <td><button type="button" class="btn-excluir" onclick="document.getElementById('${rid}').remove()">✕</button></td>`;
  tbody.appendChild(tr);

  // requestAnimationFrame — garante que o tr está no DOM antes do bind
  requestAnimationFrame(() => {
    const inp = tr.querySelector('.sc-item-desc');
    if (!inp) return;
    // Se não há catalogoId (linha nova), garantir que o browser não preencheu o campo com autofill
    if (!catIdVal && inp.value && inp.value !== descDisplay) inp.value = descDisplay;
    _bindAutocompleteCatalogo(inp, tr);
  });
}

function coletarItensSC() {
  const linhas = [...document.querySelectorAll('#sc-itens-tbody tr')];
  return linhas.map(tr => ({
    catalogo_id:  tr.querySelector('.sc-item-cat-id')?.value  || null,
    unidade_id:   tr.querySelector('.sc-item-unid-id')?.value || null,
    descricao:    tr.querySelector('.sc-item-desc')?.value.trim() || '',
    quantidade:   parseFloat(tr.querySelector('.sc-item-qtd')?.value) || 1,
    unidade:      tr.querySelector('.sc-item-sigla')?.value.trim() || '',
  })).filter(i => i.descricao && i.catalogo_id);
}

// ── Valida que todos os itens têm vínculo com o catálogo ─────────────
function _validarItensSC(itens, msgId) {
  const linhas = [...document.querySelectorAll('#sc-itens-tbody tr')];
  const semCat = linhas.filter(tr => !tr.querySelector('.sc-item-cat-id')?.value);
  if (semCat.length) {
    semCat.forEach(tr => {
      const inp = tr.querySelector('.sc-item-desc');
      if (inp) { inp.style.borderColor = '#e53e3e'; inp.style.background = '#fff5f5'; }
    });
    msgForm(msgId, '⛔ Todos os itens devem ser selecionados do catálogo. Campos marcados em vermelho precisam de seleção.', 'red');
    return false;
  }
  if (!itens.length) {
    msgForm(msgId, '⚠️ Adicione ao menos um item do catálogo.', 'red');
    return false;
  }
  return true;
}

// ── Geração do número sequencial (SC-AAAA-NNN / SS-AAAA-NNN) ────────
async function gerarNumeroSolicitacao(tipo) {
  const ano = new Date().getFullYear();
  const prefixo = `${tipo}-${ano}-`;
  const { data } = await db
    .from('compras_solicitacoes')
    .select('numero')
    .like('numero', prefixo + '%');
  let max = 0;
  (data || []).forEach(r => {
    const seq = parseInt(String(r.numero).split('-').pop(), 10);
    if (!isNaN(seq) && seq > max) max = seq;
  });
  return prefixo + String(max + 1).padStart(3, '0');
}

// ── Salvar (criar ou atualizar) ──────────────────────────────────────
async function salvarSolicitacaoCompra() {
  const idEdicao   = $('sc-id-edicao').value;
  const tipo       = $('sc-tipo').value;
  const setor      = $('sc-setor').value.trim();
  const descricao  = $('sc-descricao').value.trim();
  const prioridade = $('sc-prioridade').value;
  const status     = $('sc-status').value;
  const data       = $('sc-data').value || hoje();
  const justifica  = $('sc-justificativa').value.trim();
  const itens      = coletarItensSC();

  if (!setor || !descricao) {
    msgForm('msg-sc', '⚠️ Preencha Setor e Descrição.', 'red');
    return;
  }
  if (!_validarItensSC(itens, 'msg-sc')) return;

  msgForm('msg-sc', '⏳ Salvando...', 'blue');

  const { data: { user } } = await db.auth.getUser();

  const payload = {
    tipo,
    descricao,
    setor,
    prioridade,
    status,
    justificativa: justifica || null,
    data_necessaria: data,
    solicitante_id: user?.id || null,
  };

  let solicitacaoId = idEdicao;

  if (idEdicao) {
    const { error } = await db.from('compras_solicitacoes').update(payload).eq('id', idEdicao);
    if (error) { msgForm('msg-sc', '❌ Erro ao atualizar: ' + error.message, 'red'); return; }
    // Remove itens antigos e recria (forma mais simples e segura)
    await db.from('compras_solicitacoes_itens').delete().eq('solicitacao_id', idEdicao);
  } else {
    payload.numero = await gerarNumeroSolicitacao(tipo);
    const { data: nova, error } = await db.from('compras_solicitacoes').insert(payload).select('id').single();
    if (error) { msgForm('msg-sc', '❌ Erro ao registrar: ' + error.message, 'red'); return; }
    solicitacaoId = nova.id;
  }

  const itensPayload = itens.map(i => ({ ...i, solicitacao_id: solicitacaoId }));
  const { error: errItens } = await db.from('compras_solicitacoes_itens').insert(itensPayload);
  if (errItens) { msgForm('msg-sc', '⚠️ Solicitação salva, mas houve erro nos itens: ' + errItens.message, 'red'); }
  else { msgForm('msg-sc', idEdicao ? '✅ Solicitação atualizada com sucesso!' : '✅ Solicitação registrada com sucesso!', 'green'); }

  resetarFormSC();
  await carregarSolicitacoesCompra();
}

function resetarFormSC() {
  $('sc-id-edicao').value = '';
  $('sc-tipo').value = 'SC';
  $('sc-setor').value = '';
  $('sc-descricao').value = '';
  $('sc-justificativa').value = '';
  $('sc-prioridade').value = 'Normal';
  $('sc-status').value = 'Rascunho';
  $('sc-data').value = hoje();
  $('sc-itens-tbody').innerHTML = '';
  adicionarItemSC();
  $('sc-form-titulo').textContent = '📝 Nova Solicitação de Compra / Serviço';
  $('btn-salvar-sc').textContent = '💾 Registrar Solicitação';
  $('btn-salvar-sc').style.background = '';
  $('btn-cancelar-sc').style.display = 'none';
}

function editarSolicitacaoCompra(id) {
  const s = _scCache.find(x => x.id === id);
  if (!s) return;

  $('sc-id-edicao').value = s.id;
  $('sc-tipo').value = s.tipo;
  $('sc-setor').value = s.setor || '';
  $('sc-descricao').value = s.descricao || '';
  $('sc-justificativa').value = s.justificativa || '';
  $('sc-prioridade').value = s.prioridade || 'Normal';
  $('sc-status').value = s.status || 'Rascunho';
  $('sc-data').value = s.data_necessaria || hoje();

  $('sc-itens-tbody').innerHTML = '';
  (s.compras_solicitacoes_itens || []).forEach(i => adicionarItemSC(i.descricao, i.quantidade, i.unidade, i.catalogo_id || '', i.descricao));
  if (!(s.compras_solicitacoes_itens || []).length) adicionarItemSC();

  $('sc-form-titulo').textContent = `✏️ Editando ${s.numero}`;
  $('btn-salvar-sc').textContent = '💾 Salvar Alterações';
  $('btn-salvar-sc').style.background = '#d97706';
  $('btn-cancelar-sc').style.display = 'inline-block';

  document.getElementById('sc-form-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function excluirSolicitacaoCompra(id, numero) {
  if (!confirm(`Excluir a solicitação ${numero}? Esta ação não pode ser desfeita.`)) return;
  await db.from('compras_solicitacoes_itens').delete().eq('solicitacao_id', id);
  await db.from('compras_solicitacoes').delete().eq('id', id);
  await carregarSolicitacoesCompra();
}

// ── Badges ────────────────────────────────────────────────────────────
function _badgeStatusSC(status) {
  const map = {
    'Rascunho':   'tag-badge',
    'Pendente':   'tag-badge warning',
    'Em Cotação': 'tag-badge andamento',
    'Aprovada':   'tag-badge success',
    'Rejeitada':  'tag-badge danger',
    'Concluída':  'tag-badge semestral',
  };
  return `<span class="${map[status] || 'tag-badge'}">${escapeHTML(status)}</span>`;
}

function _badgePrioridadeSC(p) {
  const map = { 'Normal': 'tag-badge', 'Alta': 'tag-badge warning', 'Urgente': 'tag-badge danger' };
  return `<span class="${map[p] || 'tag-badge'}">${escapeHTML(p)}</span>`;
}

// ── Carregamento e renderização ──────────────────────────────────────
async function carregarSolicitacoesCompra() {
  const tbody = $('tbody-solicitacoes-compra');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="td-loading">Carregando...</td></tr>';

  const { data, error } = await db
    .from('compras_solicitacoes')
    .select('*, compras_solicitacoes_itens(*), profiles(nome, email)')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="td-loading">Erro ao carregar: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  _scCache = data || [];
  _renderStatsSC();
  filtrarSolicitacoesCompra();
}

function _renderStatsSC() {
  $('sc-stat-total').textContent      = _scCache.length;
  $('sc-stat-pendentes').textContent  = _scCache.filter(s => s.status === 'Pendente').length;
  $('sc-stat-cotacao').textContent    = _scCache.filter(s => s.status === 'Em Cotação').length;
  $('sc-stat-aprovadas').textContent  = _scCache.filter(s => s.status === 'Aprovada').length;
}

function filtrarSolicitacoesCompra() {
  const tbody = $('tbody-solicitacoes-compra');
  if (!tbody) return;

  const termo  = ($('sc-filtro-texto')?.value || '').toLowerCase().trim();
  const tipo   = $('sc-filtro-tipo')?.value || '';
  const status = $('sc-filtro-status')?.value || '';

  let dados = [..._scCache];
  if (tipo)   dados = dados.filter(s => s.tipo === tipo);
  if (status) dados = dados.filter(s => s.status === status);
  if (termo) {
    dados = dados.filter(s => {
      const nomeSolicitante = s.profiles?.nome || '';
      return `${s.numero} ${s.descricao} ${s.setor} ${nomeSolicitante}`.toLowerCase().includes(termo);
    });
  }

  tbody.innerHTML = dados.length ? dados.map(s => `
    <tr>
      <td><strong>${escapeHTML(s.numero)}</strong></td>
      <td><span class="tag-badge ${s.tipo === 'SS' ? 'andamento' : ''}">${escapeHTML(s.tipo)}</span></td>
      <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHTML(s.descricao)}">${escapeHTML(s.descricao)}</td>
      <td>${escapeHTML(s.setor)}</td>
      <td style="color:var(--gray-500);">${escapeHTML(s.profiles?.nome || '—')}</td>
      <td>${_badgePrioridadeSC(s.prioridade)}</td>
      <td>${_badgeStatusSC(s.status)}</td>
      <td>${fmtDate(s.data_necessaria)}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarSolicitacaoCompra('${s.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirSolicitacaoCompra('${s.id}','${escapeHTML(s.numero)}')">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="9" class="td-loading">Nenhuma solicitação encontrada.</td></tr>';
}

if ($('btn-salvar-sc')) {
  $('btn-salvar-sc').addEventListener('click', salvarSolicitacaoCompra);
}

// =====================================================================
//  MÓDULO DE COMPRAS — Cotações (COT)
//  Tabelas: compras_cotacoes, compras_cotacoes_fornecedores,
//           compras_cotacoes_precos, compras_cotacoes_aprovacoes
// =====================================================================

const COMPRAS_ALCADA_N1 = 5000;
const COMPRAS_ALCADA_N2 = 25000;

function fmtMoney(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function nivelAlcadaCOT(total) {
  if (total === null || total === undefined || isNaN(total) || total <= 0) return 1;
  if (total <= COMPRAS_ALCADA_N1) return 1;
  if (total <= COMPRAS_ALCADA_N2) return 2;
  return 3;
}

function labelAlcadaCOT(nivel) {
  return {
    1: `Nível 1 (até ${fmtMoney(COMPRAS_ALCADA_N1)})`,
    2: `Nível 2 (até ${fmtMoney(COMPRAS_ALCADA_N2)})`,
    3: `Nível 3 (acima de ${fmtMoney(COMPRAS_ALCADA_N2)})`,
  }[nivel] || '—';
}

let _cotCache = [];
let _cotItensRef = [];
let _cotFornecedoresForm = [];
let _cotAprovacoesAtuais = [];

// ── Geração de número COT-AAAA-NNN ──────────────────────────────────
async function gerarNumeroCotacao() {
  const ano = new Date().getFullYear();
  const prefixo = `COT-${ano}-`;
  const { data } = await db.from('compras_cotacoes').select('numero').like('numero', prefixo + '%');
  let max = 0;
  (data || []).forEach(r => {
    const seq = parseInt(String(r.numero).split('-').pop(), 10);
    if (!isNaN(seq) && seq > max) max = seq;
  });
  return prefixo + String(max + 1).padStart(3, '0');
}

// ── Select de solicitações de origem ────────────────────────────────
async function carregarSelectSolicitacoesCOT() {
  const sel = $('cot-solicitacao'); if (!sel) return;
  const idSolAtual = sel.dataset.solicitacaoAtual || '';

  const { data } = await db.from('compras_solicitacoes')
    .select('id, numero, descricao, status')
    .order('created_at', { ascending: false });

  sel.innerHTML = '<option value="">-- Selecione a Solicitação --</option>';
  (data || []).forEach(s => {
    if (!['Pendente', 'Em Cotação'].includes(s.status) && s.id !== idSolAtual) return;
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.numero} — ${s.descricao}`;
    sel.appendChild(opt);
  });
  if (idSolAtual) sel.value = idSolAtual;
}

// ── Itens de referência da solicitação selecionada ──────────────────
async function onSelecionarSolicitacaoCOT(manterFornecedores = false) {
  const solId = $('cot-solicitacao').value;
  const ref = $('cot-itens-referencia');
  _cotItensRef = [];

  if (!solId) {
    ref.innerHTML = '';
    _cotFornecedoresForm = [];
    renderFornecedoresCOT();
    return;
  }

  const { data } = await db.from('compras_solicitacoes_itens')
    .select('id, descricao, quantidade, unidade')
    .eq('solicitacao_id', solId);

  _cotItensRef = data || [];

  ref.innerHTML = _cotItensRef.length ? `
    <div class="table-wrap" style="margin:10px 0;">
      <table>
        <thead><tr><th>Item de Referência</th><th>Quantidade</th><th>Unidade</th></tr></thead>
        <tbody>${_cotItensRef.map(i => `<tr><td>${escapeHTML(i.descricao)}</td><td>${i.quantidade}</td><td>${escapeHTML(i.unidade)}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : '<p style="font-size:12px;color:var(--gray-400);margin:8px 0;">Esta solicitação não possui itens cadastrados.</p>';

  if (!manterFornecedores) {
    _cotFornecedoresForm = [];
    adicionarFornecedorCOT();
  }
  renderFornecedoresCOT();
}

// ── Fornecedores dinâmicos no formulário ────────────────────────────
function adicionarFornecedorCOT(prefill = {}) {
  const precos = {};
  _cotItensRef.forEach(i => { precos[i.id] = prefill.precos?.[i.id] ?? ''; });
  _cotFornecedoresForm.push({
    id: prefill.id || null,
    nome: prefill.nome || '',
    cnpj: prefill.cnpj || '',
    email: prefill.email || '',
    contato_nome: prefill.contato_nome || '',
    link_site: prefill.link_site || '',
    precos,
  });
  renderFornecedoresCOT();
}

function removerFornecedorCOT(idx) {
  _cotFornecedoresForm.splice(idx, 1);
  renderFornecedoresCOT();
}

function atualizarCampoFornecedorCOT(idx, campo, valor) {
  _cotFornecedoresForm[idx][campo] = valor;
  atualizarResumoVencedorCOT();
}

function atualizarPrecoFornecedorCOT(idx, itemId, valor) {
  _cotFornecedoresForm[idx].precos[itemId] = valor;
  renderFornecedoresCOT();
}

function calcularTotalFornecedorCOT(forn) {
  return _cotItensRef.reduce((acc, item) => {
    const v = parseFloat(forn.precos[item.id]);
    return acc + (isNaN(v) ? 0 : v * item.quantidade);
  }, 0);
}

function renderFornecedoresCOT() {
  const cont = $('cot-fornecedores-container');
  if (!cont) return;

  if (!_cotFornecedoresForm.length) {
    cont.innerHTML = '<p style="font-size:12px;color:var(--gray-400);">Selecione uma solicitação e adicione ao menos um fornecedor.</p>';
    atualizarResumoVencedorCOT();
    return;
  }

  cont.innerHTML = _cotFornecedoresForm.map((f, idx) => {
    const total = calcularTotalFornecedorCOT(f);
    const linhasPrecos = _cotItensRef.map(item => `
      <tr>
        <td>${escapeHTML(item.descricao)}</td>
        <td>${item.quantidade} ${escapeHTML(item.unidade)}</td>
        <td><input type="number" min="0" step="0.01" class="form-input-style" style="width:120px;"
              value="${f.precos[item.id] ?? ''}" placeholder="0,00"
              onchange="atualizarPrecoFornecedorCOT(${idx}, '${item.id}', this.value)"></td>
      </tr>`).join('');

    return `
      <div class="card" style="background:var(--gray-50);margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <h4 style="margin:0 0 10px;">Fornecedor ${idx + 1}</h4>
          <button type="button" class="btn-excluir" onclick="removerFornecedorCOT(${idx})">✕ Remover</button>
        </div>
        <div class="form-grid thirds">
          <div class="form-group"><label>Nome / Razão Social *</label>
            <input type="text" class="form-input-style" value="${escapeHTML(f.nome)}" oninput="atualizarCampoFornecedorCOT(${idx},'nome',this.value)"></div>
          <div class="form-group"><label>CNPJ</label>
            <input type="text" class="form-input-style" value="${escapeHTML(f.cnpj)}" oninput="atualizarCampoFornecedorCOT(${idx},'cnpj',this.value)"></div>
          <div class="form-group"><label>E-mail</label>
            <input type="email" class="form-input-style" value="${escapeHTML(f.email)}" oninput="atualizarCampoFornecedorCOT(${idx},'email',this.value)"></div>
        </div>
        <div class="form-grid">
          <div class="form-group"><label>Contato</label>
            <input type="text" class="form-input-style" value="${escapeHTML(f.contato_nome)}" oninput="atualizarCampoFornecedorCOT(${idx},'contato_nome',this.value)"></div>
          <div class="form-group"><label>Link do Site / Catálogo</label>
            <input type="text" class="form-input-style" value="${escapeHTML(f.link_site)}" oninput="atualizarCampoFornecedorCOT(${idx},'link_site',this.value)"></div>
        </div>
        ${_cotItensRef.length ? `
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead><tr><th>Item</th><th>Qtd.</th><th>Valor Unitário (R$)</th></tr></thead>
            <tbody>${linhasPrecos}</tbody>
          </table>
        </div>
        <p style="text-align:right;font-weight:700;margin-top:6px;">Total: ${fmtMoney(total)}</p>` : ''}
      </div>`;
  }).join('');

  atualizarResumoVencedorCOT();
}

// ── Vencedor sugerido e nível de alçada ─────────────────────────────
function atualizarResumoVencedorCOT() {
  const sel = $('cot-vencedor');
  if (!sel) return;
  const valorAtual = sel.value;

  if (!_cotFornecedoresForm.length) {
    sel.innerHTML = '<option value="">—</option>';
    if ($('cot-nivel-alcada')) $('cot-nivel-alcada').textContent = '—';
    return;
  }

  let menorIdx = 0, menorTotal = Infinity;
  _cotFornecedoresForm.forEach((f, idx) => {
    const total = calcularTotalFornecedorCOT(f);
    if (total > 0 && total < menorTotal) { menorTotal = total; menorIdx = idx; }
  });

  sel.innerHTML = _cotFornecedoresForm.map((f, idx) => {
    const total = calcularTotalFornecedorCOT(f);
    const nome = f.nome || `Fornecedor ${idx + 1}`;
    return `<option value="${idx}">${escapeHTML(nome)} — ${fmtMoney(total)}</option>`;
  }).join('');

  if (valorAtual !== '' && _cotFornecedoresForm[valorAtual] !== undefined) sel.value = valorAtual;
  else sel.value = isFinite(menorTotal) ? menorIdx : 0;

  atualizarNivelAlcadaCOT();
}

function atualizarNivelAlcadaCOT() {
  const sel = $('cot-vencedor');
  const idx = parseInt(sel.value, 10);
  const forn = _cotFornecedoresForm[idx];
  const total = forn ? calcularTotalFornecedorCOT(forn) : 0;
  const nivel = nivelAlcadaCOT(total);
  if ($('cot-nivel-alcada')) $('cot-nivel-alcada').textContent = `${fmtMoney(total)} → ${labelAlcadaCOT(nivel)}`;
}

// ── Salvar (criar ou atualizar) ──────────────────────────────────────
async function salvarCotacao() {
  const idEdicao = $('cot-id-edicao').value;
  const solicitacaoId = $('cot-solicitacao').value;
  const prazo = $('cot-prazo').value || null;
  const condPgto = $('cot-pagamento').value.trim();
  const frete = $('cot-frete').value.trim();
  const obs = $('cot-observacoes').value.trim();
  const status = $('cot-status').value;

  if (!solicitacaoId) { msgForm('msg-cot', '⚠️ Selecione a solicitação de origem.', 'red'); return; }
  if (!_cotFornecedoresForm.length || _cotFornecedoresForm.some(f => !f.nome.trim())) {
    msgForm('msg-cot', '⚠️ Cadastre ao menos um fornecedor com nome preenchido.', 'red');
    return;
  }

  msgForm('msg-cot', '⏳ Salvando...', 'blue');

  const vencedorIdx = parseInt($('cot-vencedor').value, 10) || 0;
  const totalVencedor = calcularTotalFornecedorCOT(_cotFornecedoresForm[vencedorIdx]);
  const nivel = nivelAlcadaCOT(totalVencedor);

  const payloadCot = {
    solicitacao_id: solicitacaoId,
    prazo_retorno: prazo,
    condicao_pagamento: condPgto || null,
    frete: frete || null,
    observacoes: obs || null,
    status,
    nivel_alcada_requerido: nivel,
  };

  let cotacaoId = idEdicao;

  if (idEdicao) {
    const { error } = await db.from('compras_cotacoes').update(payloadCot).eq('id', idEdicao);
    if (error) { msgForm('msg-cot', '❌ Erro ao atualizar: ' + error.message, 'red'); return; }

    const { data: fornAntigos } = await db.from('compras_cotacoes_fornecedores').select('id').eq('cotacao_id', idEdicao);
    const idsAntigos = (fornAntigos || []).map(f => f.id);
    if (idsAntigos.length) await db.from('compras_cotacoes_precos').delete().in('fornecedor_id', idsAntigos);
    await db.from('compras_cotacoes_fornecedores').delete().eq('cotacao_id', idEdicao);
  } else {
    payloadCot.numero = await gerarNumeroCotacao();
    const { data: nova, error } = await db.from('compras_cotacoes').insert(payloadCot).select('id').single();
    if (error) { msgForm('msg-cot', '❌ Erro ao registrar: ' + error.message, 'red'); return; }
    cotacaoId = nova.id;
  }

  const fornPayload = _cotFornecedoresForm.map(f => ({
    cotacao_id: cotacaoId,
    nome: f.nome.trim(),
    cnpj: f.cnpj.trim() || null,
    email: f.email.trim() || null,
    contato_nome: f.contato_nome.trim() || null,
    link_site: f.link_site.trim() || null,
  }));
  const { data: fornInseridos, error: errForn } = await db.from('compras_cotacoes_fornecedores').insert(fornPayload).select('id');
  if (errForn) { msgForm('msg-cot', '⚠️ Cotação salva, mas houve erro nos fornecedores: ' + errForn.message, 'red'); return; }

  const precosPayload = [];
  fornInseridos.forEach((row, idx) => {
    const forn = _cotFornecedoresForm[idx];
    _cotItensRef.forEach(item => {
      const valor = parseFloat(forn.precos[item.id]);
      if (!isNaN(valor)) precosPayload.push({ fornecedor_id: row.id, solicitacao_item_id: item.id, valor_unitario: valor });
    });
  });
  if (precosPayload.length) {
    const { error: errPrecos } = await db.from('compras_cotacoes_precos').insert(precosPayload);
    if (errPrecos) msgForm('msg-cot', '⚠️ Cotação salva, mas houve erro nos preços: ' + errPrecos.message, 'red');
  }

  const vencedorId = fornInseridos[vencedorIdx]?.id || null;
  await db.from('compras_cotacoes').update({ vencedor_fornecedor_id: vencedorId }).eq('id', cotacaoId);

  await garantirAprovacoesCOT(cotacaoId, nivel);

  await db.from('compras_solicitacoes').update({ status: 'Em Cotação' }).eq('id', solicitacaoId).eq('status', 'Pendente');

  msgForm('msg-cot', idEdicao ? '✅ Cotação atualizada com sucesso!' : '✅ Cotação registrada com sucesso!', 'green');
  resetarFormCOT();
  await carregarCotacoes();
}

// ── Garante linhas de aprovação para os níveis 1..nivel ──────────────
async function garantirAprovacoesCOT(cotacaoId, nivel) {
  const { data: existentes } = await db.from('compras_cotacoes_aprovacoes').select('nivel').eq('cotacao_id', cotacaoId);
  const niveisExistentes = new Set((existentes || []).map(a => a.nivel));
  const novas = [];
  for (let n = 1; n <= nivel; n++) {
    if (!niveisExistentes.has(n)) novas.push({ cotacao_id: cotacaoId, nivel: n, aprovador_nome: '—', status: 'Aguardando' });
  }
  if (novas.length) await db.from('compras_cotacoes_aprovacoes').insert(novas);
}

// ── Reset / edição ────────────────────────────────────────────────────
function resetarFormCOT() {
  $('cot-id-edicao').value = '';
  $('cot-solicitacao').dataset.solicitacaoAtual = '';
  $('cot-solicitacao').value = '';
  $('cot-prazo').value = '';
  $('cot-pagamento').value = '';
  $('cot-frete').value = '';
  $('cot-observacoes').value = '';
  $('cot-status').value = 'Aberta';
  _cotItensRef = [];
  _cotFornecedoresForm = [];
  _cotAprovacoesAtuais = [];
  $('cot-itens-referencia').innerHTML = '';
  renderFornecedoresCOT();
  $('cot-aprovacoes-container').innerHTML = '';
  $('cot-form-titulo').textContent = '📝 Nova Cotação';
  $('btn-salvar-cot').textContent = '💾 Registrar Cotação';
  $('btn-salvar-cot').style.background = '';
  $('btn-cancelar-cot').style.display = 'none';
  carregarSelectSolicitacoesCOT();
}

async function editarCotacao(id) {
  const c = _cotCache.find(x => x.id === id);
  if (!c) return;

  $('cot-id-edicao').value = c.id;
  $('cot-prazo').value = c.prazo_retorno || '';
  $('cot-pagamento').value = c.condicao_pagamento || '';
  $('cot-frete').value = c.frete || '';
  $('cot-observacoes').value = c.observacoes || '';
  $('cot-status').value = c.status || 'Aberta';

  $('cot-solicitacao').dataset.solicitacaoAtual = c.solicitacao_id || '';
  await carregarSelectSolicitacoesCOT();
  $('cot-solicitacao').value = c.solicitacao_id || '';
  await onSelecionarSolicitacaoCOT(true);

  const { data: fornecedores } = await db.from('compras_cotacoes_fornecedores').select('*').eq('cotacao_id', id);
  const idsForn = (fornecedores || []).map(f => f.id);
  const { data: precos } = idsForn.length
    ? await db.from('compras_cotacoes_precos').select('*').in('fornecedor_id', idsForn)
    : { data: [] };

  _cotFornecedoresForm = (fornecedores || []).map(f => {
    const precosObj = {};
    (precos || []).filter(p => p.fornecedor_id === f.id).forEach(p => { precosObj[p.solicitacao_item_id] = p.valor_unitario; });
    return {
      id: f.id, nome: f.nome || '', cnpj: f.cnpj || '', email: f.email || '',
      contato_nome: f.contato_nome || '', link_site: f.link_site || '', precos: precosObj,
    };
  });
  if (!_cotFornecedoresForm.length) adicionarFornecedorCOT();
  renderFornecedoresCOT();

  const idxVencedor = _cotFornecedoresForm.findIndex(f => f.id === c.vencedor_fornecedor_id);
  if (idxVencedor >= 0) $('cot-vencedor').value = idxVencedor;
  atualizarNivelAlcadaCOT();

  await renderAprovacoesCOT(id);

  $('cot-form-titulo').textContent = `✏️ Editando ${c.numero}`;
  $('btn-salvar-cot').textContent = '💾 Salvar Alterações';
  $('btn-salvar-cot').style.background = '#d97706';
  $('btn-cancelar-cot').style.display = 'inline-block';
  document.getElementById('cot-form-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function excluirCotacao(id, numero) {
  if (!confirm(`Excluir a cotação ${numero}? Esta ação não pode ser desfeita.`)) return;
  const { data: fornecedores } = await db.from('compras_cotacoes_fornecedores').select('id').eq('cotacao_id', id);
  const idsForn = (fornecedores || []).map(f => f.id);
  if (idsForn.length) await db.from('compras_cotacoes_precos').delete().in('fornecedor_id', idsForn);
  await db.from('compras_cotacoes_fornecedores').delete().eq('cotacao_id', id);
  await db.from('compras_cotacoes_aprovacoes').delete().eq('cotacao_id', id);
  await db.from('compras_cotacoes').delete().eq('id', id);
  await carregarCotacoes();
}

// ── Aprovações ────────────────────────────────────────────────────────
async function renderAprovacoesCOT(cotacaoId) {
  const cont = $('cot-aprovacoes-container');
  const cot = _cotCache.find(c => c.id === cotacaoId);
  const nivelReq = cot?.nivel_alcada_requerido || 1;

  const { data } = await db.from('compras_cotacoes_aprovacoes').select('*').eq('cotacao_id', cotacaoId).order('nivel');
  _cotAprovacoesAtuais = data || [];

  if (!_cotAprovacoesAtuais.length) { cont.innerHTML = ''; return; }

  cont.innerHTML = `
    <div style="margin-top:18px;border-top:1px solid var(--gray-200);padding-top:14px;">
      <label style="font-weight:600;font-size:13px;display:block;margin-bottom:8px;">✅ Aprovações (Nível de Alçada Requerido: ${nivelReq})</label>
      ${_cotAprovacoesAtuais.map(a => `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;padding:8px 12px;background:var(--gray-50);border-radius:6px;">
          <strong style="min-width:70px;">Nível ${a.nivel}</strong>
          ${_badgeAprovacaoCOT(a.status)}
          <span style="font-size:12px;color:var(--gray-500);">${escapeHTML(a.aprovador_nome || '—')}${a.data_decisao ? ' · ' + fmtDate(a.data_decisao) : ''}</span>
          ${a.status === 'Aguardando' ? `
            <div style="display:flex;gap:6px;margin-left:auto;">
              <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="registrarDecisaoAprovacaoCOT('${a.id}','Aprovado')">✓ Aprovar</button>
              <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="registrarDecisaoAprovacaoCOT('${a.id}','Rejeitado')">✕ Rejeitar</button>
              <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="registrarDecisaoAprovacaoCOT('${a.id}','Dispensado')">— Dispensar</button>
            </div>` : ''}
        </div>`).join('')}
    </div>`;
}

function _badgeAprovacaoCOT(status) {
  const map = { 'Aguardando': 'tag-badge warning', 'Aprovado': 'tag-badge success', 'Rejeitado': 'tag-badge danger', 'Dispensado': 'tag-badge' };
  return `<span class="${map[status] || 'tag-badge'}">${escapeHTML(status)}</span>`;
}

async function registrarDecisaoAprovacaoCOT(aprovacaoId, decisao) {
  const nome = prompt('Nome do aprovador:');
  if (!nome) return;

  await db.from('compras_cotacoes_aprovacoes')
    .update({ status: decisao, aprovador_nome: nome, data_decisao: hoje() })
    .eq('id', aprovacaoId);

  const aprov = _cotAprovacoesAtuais.find(a => a.id === aprovacaoId);
  const cotacaoId = aprov?.cotacao_id;

  const { data: todas } = await db.from('compras_cotacoes_aprovacoes').select('*').eq('cotacao_id', cotacaoId);
  const todasDecididas = (todas || []).every(a => a.status !== 'Aguardando');
  const algumaRejeitada = (todas || []).some(a => a.status === 'Rejeitado');

  if (todasDecididas) {
    const novoStatusCot = algumaRejeitada ? 'Rejeitada' : 'Aprovada';
    const { data: cot } = await db.from('compras_cotacoes').select('solicitacao_id').eq('id', cotacaoId).single();
    await db.from('compras_cotacoes').update({ status: novoStatusCot }).eq('id', cotacaoId);
    if (cot?.solicitacao_id) await db.from('compras_solicitacoes').update({ status: novoStatusCot }).eq('id', cot.solicitacao_id);
  }

  await carregarCotacoes();
  await renderAprovacoesCOT(cotacaoId);
  const cAtual = _cotCache.find(c => c.id === cotacaoId);
  if (cAtual) $('cot-status').value = cAtual.status;
}

// ── Listagem ──────────────────────────────────────────────────────────
function _badgeStatusCOT(status) {
  const map = {
    'Aberta': 'tag-badge', 'Em Análise': 'tag-badge andamento', 'Aguard. Aprovação': 'tag-badge warning',
    'Aprovada': 'tag-badge success', 'Rejeitada': 'tag-badge danger', 'OC Emitida': 'tag-badge semestral',
  };
  return `<span class="${map[status] || 'tag-badge'}">${escapeHTML(status || '—')}</span>`;
}

async function carregarCotacoes() {
  const tbody = $('tbody-cotacoes');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="td-loading">Carregando...</td></tr>';

  const { data, error } = await db.from('compras_cotacoes')
    .select('*, compras_solicitacoes(numero, descricao)')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="td-loading">Erro ao carregar: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  _cotCache = data || [];

  const vencedorIds = _cotCache.map(c => c.vencedor_fornecedor_id).filter(Boolean);
  let fornecedoresMap = {}, precosPorForn = {};
  if (vencedorIds.length) {
    const { data: fornecedores } = await db.from('compras_cotacoes_fornecedores').select('id, nome').in('id', vencedorIds);
    (fornecedores || []).forEach(f => fornecedoresMap[f.id] = f.nome);
    const { data: precos } = await db.from('compras_cotacoes_precos').select('fornecedor_id, solicitacao_item_id, valor_unitario').in('fornecedor_id', vencedorIds);
    (precos || []).forEach(p => { (precosPorForn[p.fornecedor_id] = precosPorForn[p.fornecedor_id] || []).push(p); });
  }

  const itemIds = [...new Set(Object.values(precosPorForn).flat().map(p => p.solicitacao_item_id))];
  let qtdMap = {};
  if (itemIds.length) {
    const { data: itens } = await db.from('compras_solicitacoes_itens').select('id, quantidade').in('id', itemIds);
    (itens || []).forEach(i => qtdMap[i.id] = i.quantidade);
  }

  _renderStatsCOT();

  tbody.innerHTML = _cotCache.length ? _cotCache.map(c => {
    const precos = precosPorForn[c.vencedor_fornecedor_id] || [];
    const total = precos.reduce((acc, p) => acc + (p.valor_unitario || 0) * (qtdMap[p.solicitacao_item_id] || 0), 0);
    const nomeVencedor = fornecedoresMap[c.vencedor_fornecedor_id] || '—';
    return `
      <tr>
        <td><strong>${escapeHTML(c.numero)}</strong></td>
        <td style="font-size:12px;color:var(--gray-500);">${escapeHTML(c.compras_solicitacoes?.numero || '—')}<br>${escapeHTML(c.compras_solicitacoes?.descricao || '')}</td>
        <td>${fmtDate(c.prazo_retorno)}</td>
        <td>${escapeHTML(nomeVencedor)}</td>
        <td style="font-weight:700;">${total ? fmtMoney(total) : '—'}</td>
        <td style="text-align:center;">${c.nivel_alcada_requerido || '—'}</td>
        <td>${_badgeStatusCOT(c.status)}</td>
        <td style="display:flex;gap:4px;">
          <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarCotacao('${c.id}')">✏️ Editar</button>
          <button class="btn-excluir" onclick="excluirCotacao('${c.id}','${escapeHTML(c.numero)}')">✕</button>
        </td>
      </tr>`;
  }).join('') : '<tr><td colspan="8" class="td-loading">Nenhuma cotação encontrada.</td></tr>';
}

function _renderStatsCOT() {
  $('cot-stat-total').textContent = _cotCache.length;
  $('cot-stat-analise').textContent = _cotCache.filter(c => c.status === 'Em Análise' || c.status === 'Aberta').length;
  $('cot-stat-aguardando').textContent = _cotCache.filter(c => c.status === 'Aguard. Aprovação').length;
  $('cot-stat-aprovadas').textContent = _cotCache.filter(c => c.status === 'Aprovada').length;
}

if ($('btn-salvar-cot')) {
  $('btn-salvar-cot').addEventListener('click', salvarCotacao);
}

// =====================================================================
//  MÓDULO DE COMPRAS — Ordens de Compra (OC)
//  Tabelas: compras_ordens, compras_ordens_recebimentos
//  Itens/fornecedor da OC são herdados da cotação vencedora (somente leitura)
// =====================================================================

let _ocCache = [];
let _ocItensRef = [];      // [{item_id, descricao, quantidade, unidade, valor_unitario, subtotal}]
let _ocFornecedorRef = null; // {nome, cnpj, email, contato_nome, link_site}
let _ocTotalRef = 0;

// ── Geração de número OC-AAAA-NNN ───────────────────────────────────
async function gerarNumeroOC() {
  const ano = new Date().getFullYear();
  const prefixo = `OC-${ano}-`;
  const { data } = await db.from('compras_ordens').select('numero').like('numero', prefixo + '%');
  let max = 0;
  (data || []).forEach(r => {
    const seq = parseInt(String(r.numero).split('-').pop(), 10);
    if (!isNaN(seq) && seq > max) max = seq;
  });
  return prefixo + String(max + 1).padStart(3, '0');
}

// ── Select de cotações de origem (Aprovadas) ────────────────────────
async function carregarSelectCotacoesOC() {
  const sel = $('oc-cotacao'); if (!sel) return;
  const idCotAtual = sel.dataset.cotacaoAtual || '';

  const { data } = await db.from('compras_cotacoes')
    .select('id, numero, status, compras_solicitacoes(numero, descricao)')
    .order('created_at', { ascending: false });

  sel.innerHTML = '<option value="">-- Selecione a Cotação --</option>';
  (data || []).forEach(c => {
    if (!['Aprovada', 'OC Emitida'].includes(c.status) && c.id !== idCotAtual) return;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.numero} — ${c.compras_solicitacoes?.numero || ''} ${c.compras_solicitacoes?.descricao || ''}`;
    sel.appendChild(opt);
  });
  if (idCotAtual) sel.value = idCotAtual;
}

// ── Ao selecionar a cotação, carrega fornecedor vencedor + itens/preços ──
async function onSelecionarCotacaoOC() {
  const cotId = $('oc-cotacao').value;
  const refForn = $('oc-fornecedor-referencia');
  const refItens = $('oc-itens-referencia');

  _ocItensRef = [];
  _ocFornecedorRef = null;
  _ocTotalRef = 0;

  if (!cotId) { refForn.innerHTML = ''; refItens.innerHTML = ''; return; }

  const { data: cot } = await db.from('compras_cotacoes').select('vencedor_fornecedor_id').eq('id', cotId).single();
  if (!cot?.vencedor_fornecedor_id) {
    refForn.innerHTML = '<p style="font-size:12px;color:var(--danger);margin:8px 0;">⚠️ Esta cotação não possui fornecedor vencedor definido.</p>';
    refItens.innerHTML = '';
    return;
  }

  const { data: forn } = await db.from('compras_cotacoes_fornecedores').select('*').eq('id', cot.vencedor_fornecedor_id).single();
  _ocFornecedorRef = forn || null;

  const { data: precos } = await db.from('compras_cotacoes_precos')
    .select('valor_unitario, solicitacao_item_id, compras_solicitacoes_itens(descricao, quantidade, unidade)')
    .eq('fornecedor_id', cot.vencedor_fornecedor_id);

  _ocItensRef = (precos || []).map(p => ({
    item_id: p.solicitacao_item_id,
    descricao: p.compras_solicitacoes_itens?.descricao || '—',
    quantidade: p.compras_solicitacoes_itens?.quantidade || 0,
    unidade: p.compras_solicitacoes_itens?.unidade || 'UN',
    valor_unitario: p.valor_unitario || 0,
    subtotal: (p.valor_unitario || 0) * (p.compras_solicitacoes_itens?.quantidade || 0),
  }));
  _ocTotalRef = _ocItensRef.reduce((acc, i) => acc + i.subtotal, 0);

  refForn.innerHTML = _ocFornecedorRef ? `
    <div class="card" style="background:var(--gray-50);margin-top:10px;">
      <h4 style="margin:0 0 8px;">🏷️ Fornecedor Vencedor</h4>
      <p style="font-size:13px;margin:2px 0;"><strong>${escapeHTML(_ocFornecedorRef.nome)}</strong></p>
      <p style="font-size:12px;color:var(--gray-500);margin:2px 0;">CNPJ: ${escapeHTML(_ocFornecedorRef.cnpj) !== '—' ? escapeHTML(_ocFornecedorRef.cnpj) : '—'} · E-mail: ${escapeHTML(_ocFornecedorRef.email) !== '—' ? escapeHTML(_ocFornecedorRef.email) : '—'}</p>
      <p style="font-size:12px;color:var(--gray-500);margin:2px 0;">Contato: ${escapeHTML(_ocFornecedorRef.contato_nome) !== '—' ? escapeHTML(_ocFornecedorRef.contato_nome) : '—'} ${_ocFornecedorRef.link_site ? '· <a href="' + escapeHTML(_ocFornecedorRef.link_site) + '" target="_blank">' + escapeHTML(_ocFornecedorRef.link_site) + '</a>' : ''}</p>
    </div>` : '';

  refItens.innerHTML = _ocItensRef.length ? `
    <div class="table-wrap" style="margin-top:10px;">
      <table>
        <thead><tr><th>Item</th><th>Qtd.</th><th>Unidade</th><th>Valor Unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${_ocItensRef.map(i => `
          <tr>
            <td>${escapeHTML(i.descricao)}</td>
            <td>${i.quantidade}</td>
            <td>${escapeHTML(i.unidade)}</td>
            <td>${fmtMoney(i.valor_unitario)}</td>
            <td>${fmtMoney(i.subtotal)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700;">Total da OC</td><td style="font-weight:700;">${fmtMoney(_ocTotalRef)}</td></tr></tfoot>
      </table>
    </div>` : '<p style="font-size:12px;color:var(--gray-400);margin:8px 0;">Nenhum item com preço definido para o fornecedor vencedor.</p>';
}

// ── Salvar (criar ou atualizar) ──────────────────────────────────────
async function salvarOrdemCompra() {
  const idEdicao = $('oc-id-edicao').value;
  const cotacaoId = $('oc-cotacao').value;
  const localEntrega = $('oc-local-entrega').value.trim();
  const centroCusto = $('oc-centro-custo').value.trim();
  const referencia = $('oc-referencia').value.trim();
  const instrucoes = $('oc-instrucoes').value.trim();
  const garantia = $('oc-garantia').value.trim();
  const statusOC = $('oc-status').value;
  const statusEnvio = $('oc-status-envio').value;

  if (!cotacaoId) { msgForm('msg-oc', '⚠️ Selecione a cotação de origem.', 'red'); return; }
  if (!_ocFornecedorRef) { msgForm('msg-oc', '⚠️ A cotação selecionada não possui fornecedor vencedor definido.', 'red'); return; }

  msgForm('msg-oc', '⏳ Salvando...', 'blue');

  const payload = {
    cotacao_id: cotacaoId,
    local_entrega: localEntrega || null,
    centro_custo: centroCusto || null,
    referencia_interna: referencia || null,
    instrucoes_entrega: instrucoes || null,
    garantia_exigida: garantia || null,
    status_oc: statusOC,
    status_envio: statusEnvio,
  };

  let ordemId = idEdicao;

  if (idEdicao) {
    const { error } = await db.from('compras_ordens').update(payload).eq('id', idEdicao);
    if (error) { msgForm('msg-oc', '❌ Erro ao atualizar: ' + error.message, 'red'); return; }
  } else {
    payload.numero = await gerarNumeroOC();
    const { data: nova, error } = await db.from('compras_ordens').insert(payload).select('id').single();
    if (error) { msgForm('msg-oc', '❌ Erro ao registrar: ' + error.message, 'red'); return; }
    ordemId = nova.id;
  }

  // Marca a cotação como "OC Emitida"
  await db.from('compras_cotacoes').update({ status: 'OC Emitida' }).eq('id', cotacaoId);

  msgForm('msg-oc', idEdicao ? '✅ Ordem de Compra atualizada com sucesso!' : '✅ Ordem de Compra registrada com sucesso!', 'green');

  if (!idEdicao) {
    // Mantém o formulário aberto em modo edição para permitir registrar recebimentos
    await editarOrdemCompra(ordemId);
  } else {
    await renderRecebimentoOC(ordemId);
  }
  await carregarOrdensCompra();
}

// ── Reset / edição ────────────────────────────────────────────────────
function resetarFormOC() {
  $('oc-id-edicao').value = '';
  $('oc-cotacao').dataset.cotacaoAtual = '';
  $('oc-cotacao').value = '';
  $('oc-local-entrega').value = '';
  $('oc-centro-custo').value = '';
  $('oc-referencia').value = '';
  $('oc-instrucoes').value = '';
  $('oc-garantia').value = '';
  $('oc-status').value = 'Rascunho';
  $('oc-status-envio').value = 'Não Enviada';
  $('oc-fornecedor-referencia').innerHTML = '';
  $('oc-itens-referencia').innerHTML = '';
  $('oc-recebimento-container').innerHTML = '';
  _ocItensRef = [];
  _ocFornecedorRef = null;
  _ocTotalRef = 0;
  $('oc-form-titulo').textContent = '📝 Nova Ordem de Compra';
  $('btn-salvar-oc').textContent = '💾 Registrar Ordem de Compra';
  $('btn-salvar-oc').style.background = '';
  $('btn-cancelar-oc').style.display = 'none';
  carregarSelectCotacoesOC();
}

async function editarOrdemCompra(id) {
  let o = _ocCache.find(x => x.id === id);
  if (!o) {
    const { data } = await db.from('compras_ordens').select('*, compras_cotacoes(numero, status, compras_solicitacoes(numero, descricao))').eq('id', id).single();
    o = data;
  }
  if (!o) return;

  $('oc-id-edicao').value = o.id;
  $('oc-local-entrega').value = o.local_entrega || '';
  $('oc-centro-custo').value = o.centro_custo || '';
  $('oc-referencia').value = o.referencia_interna || '';
  $('oc-instrucoes').value = o.instrucoes_entrega || '';
  $('oc-garantia').value = o.garantia_exigida || '';
  $('oc-status').value = o.status_oc || 'Rascunho';
  $('oc-status-envio').value = o.status_envio || 'Não Enviada';

  $('oc-cotacao').dataset.cotacaoAtual = o.cotacao_id || '';
  await carregarSelectCotacoesOC();
  $('oc-cotacao').value = o.cotacao_id || '';
  await onSelecionarCotacaoOC();

  await renderRecebimentoOC(o.id);

  $('oc-form-titulo').textContent = `✏️ Editando ${o.numero}`;
  $('btn-salvar-oc').textContent = '💾 Salvar Alterações';
  $('btn-salvar-oc').style.background = '#d97706';
  $('btn-cancelar-oc').style.display = 'inline-block';
  document.getElementById('oc-form-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function excluirOrdemCompra(id, numero) {
  if (!confirm(`Excluir a OC ${numero}? Esta ação não pode ser desfeita.`)) return;
  await db.from('compras_ordens_recebimentos').delete().eq('ordem_id', id);
  await db.from('compras_ordens').delete().eq('id', id);
  await carregarOrdensCompra();
}

// ── Recebimento de itens ──────────────────────────────────────────────
async function renderRecebimentoOC(ordemId) {
  const cont = $('oc-recebimento-container');
  if (!cont) return;
  if (!_ocItensRef.length) { cont.innerHTML = ''; return; }

  const { data: recebimentos } = await db.from('compras_ordens_recebimentos').select('*').eq('ordem_id', ordemId);
  const recebidoPorItem = {};
  (recebimentos || []).forEach(r => {
    recebidoPorItem[r.solicitacao_item_id] = (recebidoPorItem[r.solicitacao_item_id] || 0) + (r.quantidade_recebida || 0);
  });

  cont.innerHTML = `
    <div style="margin-top:18px;border-top:1px solid var(--gray-200);padding-top:14px;">
      <label style="font-weight:600;font-size:13px;display:block;margin-bottom:8px;">📥 Recebimento de Itens</label>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Pedido</th><th>Recebido</th><th>Receber agora</th><th></th></tr></thead>
          <tbody>
            ${_ocItensRef.map(i => {
              const recebido = recebidoPorItem[i.item_id] || 0;
              const restante = Math.max(0, i.quantidade - recebido);
              return `
                <tr>
                  <td>${escapeHTML(i.descricao)}</td>
                  <td>${i.quantidade} ${escapeHTML(i.unidade)}</td>
                  <td>${recebido} ${escapeHTML(i.unidade)}</td>
                  <td><input type="number" min="0" max="${restante}" step="1" id="oc-receber-${i.item_id}" class="form-input-style" style="width:90px;" placeholder="0" ${restante === 0 ? 'disabled' : ''}></td>
                  <td>${restante === 0
                    ? '<span class="tag-badge success">✓ Completo</span>'
                    : `<button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="registrarRecebimentoOC('${ordemId}','${i.item_id}')">Registrar</button>`}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function registrarRecebimentoOC(ordemId, itemId) {
  const input = $('oc-receber-' + itemId);
  const qtd = parseInt(input.value, 10);
  if (!qtd || qtd <= 0) { alert('Informe uma quantidade válida.'); return; }

  await db.from('compras_ordens_recebimentos').insert({
    ordem_id: ordemId,
    solicitacao_item_id: itemId,
    quantidade_recebida: qtd,
    data_recebimento: new Date().toISOString(),
  });

  // Recalcula status geral da OC
  const { data: recebimentos } = await db.from('compras_ordens_recebimentos').select('*').eq('ordem_id', ordemId);
  const recebidoPorItem = {};
  (recebimentos || []).forEach(r => {
    recebidoPorItem[r.solicitacao_item_id] = (recebidoPorItem[r.solicitacao_item_id] || 0) + (r.quantidade_recebida || 0);
  });
  const totalmenteRecebido = _ocItensRef.every(i => (recebidoPorItem[i.item_id] || 0) >= i.quantidade);
  const algumRecebido = _ocItensRef.some(i => (recebidoPorItem[i.item_id] || 0) > 0);
  const novoStatus = totalmenteRecebido ? 'Recebida' : (algumRecebido ? 'Parcial' : 'Rascunho');

  await db.from('compras_ordens').update({ status_oc: novoStatus }).eq('id', ordemId);
  $('oc-status').value = novoStatus;

  await renderRecebimentoOC(ordemId);
  await carregarOrdensCompra();
}

// ── Badges ────────────────────────────────────────────────────────────
function _badgeStatusOC(status) {
  const map = {
    'Rascunho': 'tag-badge', 'Enviada': 'tag-badge andamento', 'Confirmada': 'tag-badge semestral',
    'Parcial': 'tag-badge warning', 'Recebida': 'tag-badge success', 'Cancelada': 'tag-badge danger',
  };
  return `<span class="${map[status] || 'tag-badge'}">${escapeHTML(status || '—')}</span>`;
}

function _badgeEnvioOC(status) {
  return status === 'Enviada'
    ? '<span class="tag-badge success">📤 Enviada</span>'
    : '<span class="tag-badge">Não Enviada</span>';
}

// ── Listagem ──────────────────────────────────────────────────────────
async function carregarOrdensCompra() {
  const tbody = $('tbody-ordens-compra');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="td-loading">Carregando...</td></tr>';

  const { data, error } = await db.from('compras_ordens')
    .select('*, compras_cotacoes(numero, vencedor_fornecedor_id, compras_solicitacoes(numero, descricao))')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="td-loading">Erro ao carregar: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  _ocCache = data || [];

  // Carrega nomes dos fornecedores vencedores e totais
  const fornIds = [...new Set(_ocCache.map(o => o.compras_cotacoes?.vencedor_fornecedor_id).filter(Boolean))];
  let fornecedoresMap = {}, precosPorForn = {};
  if (fornIds.length) {
    const { data: fornecedores } = await db.from('compras_cotacoes_fornecedores').select('id, nome').in('id', fornIds);
    (fornecedores || []).forEach(f => fornecedoresMap[f.id] = f.nome);
    const { data: precos } = await db.from('compras_cotacoes_precos').select('fornecedor_id, solicitacao_item_id, valor_unitario').in('fornecedor_id', fornIds);
    (precos || []).forEach(p => { (precosPorForn[p.fornecedor_id] = precosPorForn[p.fornecedor_id] || []).push(p); });
  }
  const itemIds = [...new Set(Object.values(precosPorForn).flat().map(p => p.solicitacao_item_id))];
  let qtdMap = {};
  if (itemIds.length) {
    const { data: itens } = await db.from('compras_solicitacoes_itens').select('id, quantidade').in('id', itemIds);
    (itens || []).forEach(i => qtdMap[i.id] = i.quantidade);
  }

  _ocCache.forEach(o => {
    const fornId = o.compras_cotacoes?.vencedor_fornecedor_id;
    const precos = precosPorForn[fornId] || [];
    o._fornecedorNome = fornecedoresMap[fornId] || '—';
    o._total = precos.reduce((acc, p) => acc + (p.valor_unitario || 0) * (qtdMap[p.solicitacao_item_id] || 0), 0);
  });

  _renderStatsOC();
  filtrarOrdensCompra();
}

function _renderStatsOC() {
  $('oc-stat-total').textContent     = _ocCache.length;
  $('oc-stat-rascunho').textContent  = _ocCache.filter(o => o.status_oc === 'Rascunho').length;
  $('oc-stat-enviadas').textContent  = _ocCache.filter(o => o.status_envio === 'Enviada').length;
  $('oc-stat-recebidas').textContent = _ocCache.filter(o => o.status_oc === 'Recebida').length;
}

function filtrarOrdensCompra() {
  const tbody = $('tbody-ordens-compra');
  if (!tbody) return;

  const termo  = ($('oc-filtro-texto')?.value || '').toLowerCase().trim();
  const status = $('oc-filtro-status')?.value || '';
  const envio  = $('oc-filtro-envio')?.value || '';

  let dados = [..._ocCache];
  if (status) dados = dados.filter(o => o.status_oc === status);
  if (envio)  dados = dados.filter(o => o.status_envio === envio);
  if (termo) {
    dados = dados.filter(o => `${o.numero} ${o.compras_cotacoes?.numero || ''} ${o._fornecedorNome}`.toLowerCase().includes(termo));
  }

  tbody.innerHTML = dados.length ? dados.map(o => `
    <tr>
      <td><strong>${escapeHTML(o.numero)}</strong></td>
      <td style="font-size:12px;color:var(--gray-500);">${escapeHTML(o.compras_cotacoes?.numero || '—')}<br>${escapeHTML(o.compras_cotacoes?.compras_solicitacoes?.descricao || '')}</td>
      <td>${escapeHTML(o._fornecedorNome)}</td>
      <td style="font-weight:700;">${o._total ? fmtMoney(o._total) : '—'}</td>
      <td>${_badgeEnvioOC(o.status_envio)}</td>
      <td>${_badgeStatusOC(o.status_oc)}</td>
      <td>${o.created_at ? fmtDate(o.created_at.split('T')[0]) : '—'}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarOrdemCompra('${o.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirOrdemCompra('${o.id}','${escapeHTML(o.numero)}')">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="8" class="td-loading">Nenhuma ordem de compra encontrada.</td></tr>';
}

if ($('btn-salvar-oc')) {
  $('btn-salvar-oc').addEventListener('click', salvarOrdemCompra);
}

// =====================================================================
//  INTEGRAÇÃO OS → SC/SS (Pré-Demandas de Compras)
//  Tabela: compras_pre_demandas
// =====================================================================

let _pdItemSeq = 0;

function abrirPreDemandaOS(origemTipo, origemId, origemNumero, setorSugerido = '') {
  $('pd-origem-tipo').value = origemTipo;
  $('pd-origem-id').value = origemId;
  $('pd-origem-numero-val').value = origemNumero;
  $('pd-origem-numero').textContent = origemNumero;
  $('pd-tipo').value = 'SC';
  $('pd-setor').value = (setorSugerido || '').trim();
  $('pd-prioridade').value = 'Normal';
  $('pd-descricao').value = '';
  $('pd-itens-tbody').innerHTML = '';
  $('msg-pd').textContent = '';
  adicionarItemPD();
  $('overlay-pre-demanda').style.display = 'flex';
}

function fecharModalPreDemanda() {
  $('overlay-pre-demanda').style.display = 'none';
}

function adicionarItemPD(desc = '', qtd = 1, unidade = '', catalogoId = '') {
  const tbody = $('pd-itens-tbody');
  if (!tbody) return;
  const rid   = 'pd-item-' + (++_pdItemSeq);
  const inpId = 'pd-desc-' + _pdItemSeq;
  const tr    = document.createElement('tr');
  tr.id = rid;
  const catIdVal    = catalogoId || '';
  const descDisplay = desc || '';
  tr.innerHTML = `
    <td style="position:relative;min-width:220px;">
      <input type="hidden" class="pd-item-cat-id" value="${escapeHTML(catIdVal)}">
      <input type="hidden" class="pd-item-unid-id" value="">
      <input type="text" id="${inpId}" name="pd-busca-${_pdItemSeq}" class="form-input-style pd-item-desc" value="${escapeHTML(descDisplay)}"
             placeholder="Digite para buscar no catálogo..."
             autocomplete="new-password" data-form-type="other" role="combobox" aria-autocomplete="list" aria-expanded="false"
             style="${catIdVal ? 'border-color:#48bb78;background:#f0fff4;' : ''}">
    </td>
    <td><input type="number" class="form-input-style pd-item-qtd" value="${Number(qtd) || 1}" min="0.001" step="any" style="width:80px;"></td>
    <td><input type="text" class="pd-item-sigla" value="${escapeHTML(unidade)}" readonly
               style="width:65px;background:#f7fafc;color:#718096;border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;font-size:13px;"></td>
    <td><button type="button" class="btn-excluir" onclick="document.getElementById('${rid}').remove()">✕</button></td>`;
  tbody.appendChild(tr);

  requestAnimationFrame(() => {
    const inp = tr.querySelector('.pd-item-desc');
    if (!inp) return;
    _bindAutocompleteCatalogo(inp, tr, 'pd');
  });
}

function coletarItensPD() {
  const linhas = [...document.querySelectorAll('#pd-itens-tbody tr')];
  return linhas.map(tr => ({
    catalogo_id: tr.querySelector('.pd-item-cat-id')?.value  || null,
    unidade_id:  tr.querySelector('.pd-item-unid-id')?.value || null,
    descricao:   tr.querySelector('.pd-item-desc')?.value.trim() || '',
    quantidade:  parseFloat(tr.querySelector('.pd-item-qtd')?.value) || 1,
    unidade:     tr.querySelector('.pd-item-sigla')?.value.trim() || '',
  })).filter(i => i.descricao && i.catalogo_id);
}

async function salvarPreDemanda() {
  const origemTipo   = $('pd-origem-tipo').value;
  const origemId     = $('pd-origem-id').value;
  const origemNumero = $('pd-origem-numero-val').value;
  const tipo         = $('pd-tipo').value;
  const setor        = $('pd-setor').value.trim();
  const prioridade   = $('pd-prioridade').value;
  const descricao    = $('pd-descricao').value.trim();
  const itens        = coletarItensPD();

  if (!setor || !descricao) { msgForm('msg-pd', '⚠️ Preencha Setor e Descrição.', 'red'); return; }
  if (!itens.length) { msgForm('msg-pd', '⛔ Selecione ao menos um item do catálogo.', 'red'); return; }

  msgForm('msg-pd', '⏳ Enviando...', 'blue');

  const { data: { user } } = await db.auth.getUser();

  const { error } = await db.from('compras_pre_demandas').insert({
    origem_tipo: origemTipo,
    origem_id: origemId,
    origem_numero: origemNumero,
    tipo_solicitacao: tipo,
    descricao,
    setor,
    prioridade,
    itens,
    solicitante_id: user?.id || null,
  });

  if (error) { msgForm('msg-pd', '❌ Erro ao enviar: ' + error.message, 'red'); return; }

  msgForm('msg-pd', '✅ Pré-demanda enviada para aprovação no módulo de Compras!', 'green');
  setTimeout(fecharModalPreDemanda, 1200);
}

if ($('btn-salvar-pd')) {
  $('btn-salvar-pd').addEventListener('click', salvarPreDemanda);
}

// ── Aprovação de pré-demandas (compras-sc.html) ──────────────────────
let _pdCache = [];

function _badgeTipoPD(tipo) {
  return tipo === 'SS' ? '<span class="tag-badge andamento">🧰 SS</span>' : '<span class="tag-badge">📦 SC</span>';
}

async function carregarPreDemandas() {
  const tbody = $('tbody-pre-demandas');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="td-loading">Carregando...</td></tr>';

  const { data, error } = await db.from('compras_pre_demandas')
    .select('*, profiles(nome)')
    .eq('status', 'Pendente')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="td-loading">Erro ao carregar: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  _pdCache = data || [];
  if ($('pd-badge-count')) $('pd-badge-count').textContent = _pdCache.length;

  tbody.innerHTML = _pdCache.length ? _pdCache.map(p => `
    <tr>
      <td><strong>${escapeHTML(p.origem_numero)}</strong><br><span style="font-size:10px;color:var(--gray-400);">${escapeHTML(p.origem_tipo)}</span></td>
      <td>${_badgeTipoPD(p.tipo_solicitacao)}</td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHTML(p.descricao)}">${escapeHTML(p.descricao)}</td>
      <td>${escapeHTML(p.setor)}</td>
      <td>${_badgePrioridadeSC(p.prioridade)}</td>
      <td style="font-size:11px;">${(p.itens||[]).map(i => `${i.quantidade}x ${escapeHTML(i.descricao)}`).join('<br>')}</td>
      <td style="color:var(--gray-500);font-size:12px;">${escapeHTML(p.profiles?.nome || '—')}<br>${fmtDate(p.created_at?.split('T')[0])}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-primary" style="padding:3px 10px;font-size:11px;background:#10b981;" onclick="aprovarPreDemanda('${p.id}')">✓ Aprovar</button>
        <button class="btn-excluir" onclick="rejeitarPreDemanda('${p.id}')">✕ Rejeitar</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="8" class="td-loading">Nenhuma pré-demanda pendente.</td></tr>';
}

async function aprovarPreDemanda(id) {
  const p = _pdCache.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Aprovar esta pré-demanda e gerar uma ${p.tipo_solicitacao} a partir da ${p.origem_numero}?`)) return;

  const numero = await gerarNumeroSolicitacao(p.tipo_solicitacao);

  const { data: nova, error } = await db.from('compras_solicitacoes').insert({
    numero,
    tipo: p.tipo_solicitacao,
    descricao: p.descricao,
    setor: p.setor,
    prioridade: p.prioridade,
    status: 'Pendente',
    justificativa: `Gerada automaticamente a partir da pré-demanda da ${p.origem_numero}.`,
    data_necessaria: hoje(),
    solicitante_id: p.solicitante_id,
  }).select('id').single();

  if (error) { alert('Erro ao gerar solicitação: ' + error.message); return; }

  const itensPayload = (p.itens || []).map(i => ({ ...i, solicitacao_id: nova.id }));
  if (itensPayload.length) await db.from('compras_solicitacoes_itens').insert(itensPayload);

  const { data: { user } } = await db.auth.getUser();
  await db.from('compras_pre_demandas').update({
    status: 'Aprovada',
    solicitacao_id: nova.id,
    decidido_por: user?.email || null,
    data_decisao: new Date().toISOString(),
  }).eq('id', id);

  await carregarPreDemandas();
  await carregarSolicitacoesCompra();
}

async function rejeitarPreDemanda(id) {
  if (!confirm('Rejeitar esta pré-demanda? Nenhuma SC/SS será criada.')) return;
  const { data: { user } } = await db.auth.getUser();
  await db.from('compras_pre_demandas').update({
    status: 'Rejeitada',
    decidido_por: user?.email || null,
    data_decisao: new Date().toISOString(),
  }).eq('id', id);
  await carregarPreDemandas();
}

// =====================================================================
//  CATÁLOGO DE ITENS — compras_catalogo_itens
//  Página: compras-catalogo.html
// =====================================================================

let _catCache = [];   // cache de itens do catálogo
let _umCache  = [];   // cache de unidades de medida

// ── Prefixos de código por grupo ─────────────────────────────────────
const _CAT_PREFIXO = {
  'Material':   'MAT',
  'Serviço':    'SVC',
  'EPI':        'EPI',
  'Ferramenta': 'FER',
  'Químico':    'QUI',
  'Outro':      'OUT',
};

// ── Alterna abas ─────────────────────────────────────────────────────
function alternarAbaCatalogo(aba) {
  ['itens','unidades'].forEach(a => {
    const el = $('aba-catalogo-' + a);
    if (el) el.style.display = a === aba ? '' : 'none';
  });
}

// ── Geração de código automático ─────────────────────────────────────
async function atualizarCodigoCatalogo() {
  const grupo   = $('cat-grupo')?.value || 'Material';
  const prefixo = _CAT_PREFIXO[grupo] || 'OUT';
  if ($('cat-id-edicao')?.value) return; // em edição não altera código
  const { data } = await db.from('compras_catalogo_itens')
    .select('codigo')
    .like('codigo', prefixo + '-%')
    .order('codigo', { ascending: false })
    .limit(1);
  const ultimo = data?.[0]?.codigo || '';
  const seq    = parseInt(ultimo.split('-').pop(), 10) || 0;
  if ($('cat-codigo')) $('cat-codigo').value = `${prefixo}-${String(seq + 1).padStart(4, '0')}`;
}

// ── Carrega unidades no select do formulário ──────────────────────────
async function carregarUnidadesMedida() {
  const tbody = $('tbody-unidades-medida');

  const { data, error } = await db.from('compras_unidades_medida')
    .select('*')
    .order('sigla');

  if (error) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="td-loading">Erro: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  _umCache = data || [];

  // Popula selects de unidades em todos os formulários que os usam
  ['cat-unidade'].map($).filter(Boolean).forEach(sel => {
    const atual = sel.value;
    sel.innerHTML = '<option value="">-- Unidade --</option>';
    _umCache.forEach(u => {
      const opt = document.createElement('option');
      opt.value       = u.id;
      opt.textContent = `${u.sigla} — ${u.descricao}`;
      sel.appendChild(opt);
    });
    if (atual) sel.value = atual;
  });

  // Renderiza tabela
  if (!tbody) return;
  tbody.innerHTML = _umCache.length ? _umCache.map(u => `
    <tr>
      <td><strong>${escapeHTML(u.sigla)}</strong></td>
      <td>${escapeHTML(u.descricao)}</td>
      <td>${u.ativo ? '<span class="tag-badge success">Ativo</span>' : '<span class="tag-badge danger">Inativo</span>'}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarUnidadeMedida(${u.id})">✏️ Editar</button>
        <button class="btn-excluir" onclick="toggleAtivoUM(${u.id},${u.ativo})">
          ${u.ativo ? '⛔ Desativar' : '✅ Ativar'}
        </button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4" class="td-loading">Nenhuma unidade cadastrada.</td></tr>';
}

async function salvarUnidadeMedida() {
  const id      = $('um-id-edicao')?.value || '';
  const sigla   = ($('um-sigla')?.value || '').trim().toUpperCase();
  const desc    = ($('um-descricao')?.value || '').trim();

  if (!sigla || !desc) { msgForm('msg-um', '⚠️ Preencha Sigla e Descrição.', 'red'); return; }
  msgForm('msg-um', '⏳ Salvando...', 'blue');

  const payload = { sigla, descricao: desc };
  const { error } = id
    ? await db.from('compras_unidades_medida').update(payload).eq('id', id)
    : await db.from('compras_unidades_medida').insert(payload);

  if (error) { msgForm('msg-um', '❌ Erro: ' + error.message, 'red'); return; }
  msgForm('msg-um', id ? '✅ Unidade atualizada!' : '✅ Unidade cadastrada!', 'green');
  resetarFormUM();
  await carregarUnidadesMedida();
}

function editarUnidadeMedida(id) {
  const u = _umCache.find(x => x.id === id);
  if (!u) return;
  if ($('um-id-edicao'))  $('um-id-edicao').value  = u.id;
  if ($('um-sigla'))      $('um-sigla').value       = u.sigla;
  if ($('um-descricao'))  $('um-descricao').value   = u.descricao;
  if ($('um-form-titulo')) $('um-form-titulo').textContent = '✏️ Editando Unidade — ' + u.sigla;
  if ($('btn-cancelar-um')) $('btn-cancelar-um').style.display = 'inline-block';
  $('um-sigla')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function toggleAtivoUM(id, ativo) {
  const acao = ativo ? 'desativar' : 'ativar';
  if (!confirm(`Deseja ${acao} esta unidade de medida?`)) return;
  const { error } = await db.from('compras_unidades_medida').update({ ativo: !ativo }).eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  await carregarUnidadesMedida();
}

function resetarFormUM() {
  if ($('um-id-edicao'))   $('um-id-edicao').value   = '';
  if ($('um-sigla'))       $('um-sigla').value        = '';
  if ($('um-descricao'))   $('um-descricao').value    = '';
  if ($('um-form-titulo')) $('um-form-titulo').textContent = '📐 Nova Unidade de Medida';
  if ($('btn-cancelar-um')) $('btn-cancelar-um').style.display = 'none';
  if ($('msg-um')) $('msg-um').textContent = '';
}

// ── Catálogo de Itens ─────────────────────────────────────────────────
async function carregarCatalogo() {
  const tbody = $('tbody-catalogo');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="td-loading">Carregando...</td></tr>';

  const { data, error } = await db.from('compras_catalogo_itens')
    .select('*, compras_unidades_medida(sigla, descricao)')
    .order('codigo');

  if (error) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="td-loading">Erro: ${escapeHTML(error.message)}</td></tr>`;
    return;
  }

  _catCache = data || [];
  _renderStatsCatalogo();
  filtrarCatalogo();
}

function _renderStatsCatalogo() {
  if ($('cat-stat-total'))    $('cat-stat-total').textContent    = _catCache.filter(i => i.ativo).length;
  if ($('cat-stat-material')) $('cat-stat-material').textContent = _catCache.filter(i => i.grupo === 'Material' && i.ativo).length;
  if ($('cat-stat-servico'))  $('cat-stat-servico').textContent  = _catCache.filter(i => i.grupo === 'Serviço' && i.ativo).length;
  if ($('cat-stat-inativos')) $('cat-stat-inativos').textContent = _catCache.filter(i => !i.ativo).length;
}

const _CAT_GRUPO_ICON = { Material:'📦', 'Serviço':'🧰', EPI:'🦺', Ferramenta:'🔧', Químico:'🧪', Outro:'📎' };

function filtrarCatalogo() {
  const tbody = $('tbody-catalogo');
  if (!tbody) return;
  const termo  = ($('cat-filtro-texto')?.value || '').toLowerCase().trim();
  const grupo  = $('cat-filtro-grupo')?.value  || '';
  const ativo  = $('cat-filtro-ativo')?.value  || '';

  let dados = [..._catCache];
  if (grupo) dados = dados.filter(i => i.grupo === grupo);
  if (ativo) dados = dados.filter(i => String(i.ativo) === ativo);
  if (termo) dados = dados.filter(i =>
    i.codigo.toLowerCase().includes(termo) ||
    i.descricao.toLowerCase().includes(termo) ||
    (i.especificacao || '').toLowerCase().includes(termo)
  );

  tbody.innerHTML = dados.length ? dados.map(i => `
    <tr style="${!i.ativo ? 'opacity:.55;' : ''}">
      <td><strong style="font-family:monospace;">${escapeHTML(i.codigo)}</strong></td>
      <td>${escapeHTML(i.descricao)}</td>
      <td><span class="tag-badge">${_CAT_GRUPO_ICON[i.grupo] || ''} ${escapeHTML(i.grupo)}</span></td>
      <td><strong>${escapeHTML(i.compras_unidades_medida?.sigla || '—')}</strong>
          <small style="color:#a0aec0;"> ${escapeHTML(i.compras_unidades_medida?.descricao || '')}</small></td>
      <td style="font-size:11px;color:#718096;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
          title="${escapeHTML(i.especificacao || '')}">${escapeHTML(i.especificacao || '—')}</td>
      <td>${i.ativo ? '<span class="tag-badge success">Ativo</span>' : '<span class="tag-badge danger">Inativo</span>'}</td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarItemCatalogo('${i.id}')">✏️</button>
        <button class="btn-excluir" onclick="toggleAtivoCatalogo('${i.id}',${i.ativo})">
          ${i.ativo ? '⛔' : '✅'}
        </button>
      </td>
    </tr>`).join('') : '<tr><td colspan="7" class="td-loading">Nenhum item encontrado.</td></tr>';
}

async function salvarItemCatalogo() {
  const id         = $('cat-id-edicao')?.value || '';
  const codigo     = ($('cat-codigo')?.value     || '').trim();
  const descricao  = ($('cat-descricao')?.value  || '').trim();
  const grupo      = $('cat-grupo')?.value       || 'Material';
  const unidadeId  = $('cat-unidade')?.value     || '';
  const especif    = ($('cat-especificacao')?.value || '').trim();
  const ativo      = $('cat-ativo')?.value !== 'false';

  if (!descricao)  { msgForm('msg-cat', '⚠️ Preencha a Descrição do item.', 'red'); return; }
  if (!unidadeId)  { msgForm('msg-cat', '⚠️ Selecione a Unidade de Medida.', 'red'); return; }
  if (!codigo)     { msgForm('msg-cat', '⚠️ Código não gerado. Selecione o Grupo e tente novamente.', 'red'); return; }

  msgForm('msg-cat', '⏳ Salvando...', 'blue');

  const payload = {
    codigo,
    descricao,
    grupo,
    unidade_id:    parseInt(unidadeId, 10),
    especificacao: especif || null,
    ativo,
  };

  const { error } = id
    ? await db.from('compras_catalogo_itens').update(payload).eq('id', id)
    : await db.from('compras_catalogo_itens').insert(payload);

  if (error) {
    const msg = error.message.includes('uq_catalogo_descricao')
      ? '❌ Já existe um item com esta descrição no catálogo.'
      : '❌ Erro ao salvar: ' + error.message;
    msgForm('msg-cat', msg, 'red');
    return;
  }

  msgForm('msg-cat', id ? '✅ Item atualizado com sucesso!' : '✅ Item cadastrado no catálogo!', 'green');
  resetarFormCatalogo();
  await carregarCatalogo();
}

function editarItemCatalogo(id) {
  const i = _catCache.find(x => x.id === id);
  if (!i) return;
  if ($('cat-id-edicao'))      $('cat-id-edicao').value      = i.id;
  if ($('cat-codigo'))         $('cat-codigo').value         = i.codigo;
  if ($('cat-descricao'))      $('cat-descricao').value      = i.descricao;
  if ($('cat-grupo'))          $('cat-grupo').value          = i.grupo;
  if ($('cat-unidade'))        $('cat-unidade').value        = i.unidade_id;
  if ($('cat-especificacao'))  $('cat-especificacao').value  = i.especificacao || '';
  if ($('cat-ativo'))          $('cat-ativo').value          = String(i.ativo);
  if ($('cat-form-titulo'))    $('cat-form-titulo').textContent = `✏️ Editando — ${i.codigo}`;
  if ($('btn-cancelar-cat'))   $('btn-cancelar-cat').style.display = 'inline-block';
  $('cat-descricao')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function toggleAtivoCatalogo(id, ativo) {
  const acao = ativo ? 'desativar' : 'ativar';
  if (!confirm(`Deseja ${acao} este item do catálogo?`)) return;
  const { error } = await db.from('compras_catalogo_itens').update({ ativo: !ativo }).eq('id', id);
  if (error) { alert('Erro: ' + error.message); return; }
  await carregarCatalogo();
}

function resetarFormCatalogo() {
  if ($('cat-id-edicao'))     $('cat-id-edicao').value     = '';
  if ($('cat-codigo'))        $('cat-codigo').value        = '';
  if ($('cat-descricao'))     $('cat-descricao').value     = '';
  if ($('cat-grupo'))         $('cat-grupo').value         = 'Material';
  if ($('cat-unidade'))       $('cat-unidade').value       = '';
  if ($('cat-especificacao')) $('cat-especificacao').value = '';
  if ($('cat-ativo'))         $('cat-ativo').value         = 'true';
  if ($('cat-form-titulo'))   $('cat-form-titulo').textContent = '📝 Novo Item no Catálogo';
  if ($('btn-cancelar-cat'))  $('btn-cancelar-cat').style.display = 'none';
  if ($('msg-cat'))           $('msg-cat').textContent = '';
  atualizarCodigoCatalogo();
}
