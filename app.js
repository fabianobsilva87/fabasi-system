// =====================================================================
//  CONCREDUR — app.js  (versão refatorada — Fases 1-4)
//  Fase 1: credenciais removidas → consumidas de config.js
//  Fase 2: assinaturas → Storage; observacoes → meta_pmoc JSONB
//  Fase 3: CanvasAssinatura isolado; escapeHTML contra XSS
//  Fase 4: dashboard lê views SQL materializadas
// =====================================================================

// ── Credenciais: lidas EXCLUSIVAMENTE de config.js (carregado antes no HTML)
// Sem fallback embutido. Conectar em silêncio a outro projeto Supabase é pior que
// não abrir: as O.S. e fichas PMOC iriam para uma base fantasma sem ninguém notar.
if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL ||
    typeof SUPABASE_ANON_KEY === 'undefined' || !SUPABASE_ANON_KEY) {
  const _msgCfg =
    '<div style="padding:40px;font-family:system-ui,-apple-system,sans-serif;color:#dc2626;max-width:640px;margin:0 auto">' +
    '<h2 style="margin:0 0 12px">Falha de configuração</h2>' +
    '<p style="color:#4a5568;line-height:1.6">O arquivo <code>config.js</code> não foi carregado, ou não define ' +
    '<code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code>.<br>' +
    'O sistema foi interrompido para não gravar dados em uma base incorreta.<br><br>' +
    'Contate o administrador do sistema.</p></div>';
  if (document.body) {
    document.body.style.visibility = 'visible'; // não deixar a tela invisível (ver T2.3)
    document.body.innerHTML = _msgCfg;
  } else {
    document.documentElement.innerHTML = '<body>' + _msgCfg + '</body>';
  }
  throw new Error('CONFIG_AUSENTE');
}
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// ── T2.1: paginação obrigatória em leituras de lista ──────────────────────────
// O PostgREST aplica max-rows (padrão 1.000) e retorna truncado SEM erro. Um
// inventário com 1.001 equipamentos emitiria Plano PMOC incompleto — não
// conformidade perante a Lei 13.589/2018 e a Portaria MS 3.523/98.
//
// Recebe uma FÁBRICA de query (e não a query pronta) para poder reaplicar
// .range() a cada página, e devolve { data, error } no mesmo formato do
// supabase-js, de modo que os pontos de chamada não mudem o tratamento de erro.
async function fetchAll(construirQuery, chunk = 1000) {
  const todos = [];
  for (let de = 0; ; de += chunk) {
    const { data, error } = await construirQuery().range(de, de + chunk - 1);
    if (error) return { data: null, error };
    if (data) for (const linha of data) todos.push(linha);
    if (!data || data.length < chunk) break;
  }
  return { data: todos, error: null };
}

// Variante para filtros .in(): além do max-rows, uma lista grande de IDs estoura
// o limite de tamanho da URL (HTTP 414). Quebra os IDs em blocos de 500,
// conforme o padrão de operações em lote do projeto.
// ATENÇÃO: aqui a fábrica PRECISA devolver uma query nova a cada chamada, senão
// os filtros .in() se acumulam no mesmo builder.
async function fetchAllIn(construirQuery, coluna, ids, blocoIds = 500, chunk = 1000) {
  const todos = [];
  const unicos = [...new Set(ids || [])];
  if (!unicos.length) return { data: [], error: null };
  for (let i = 0; i < unicos.length; i += blocoIds) {
    const fatia = unicos.slice(i, i + blocoIds);
    const { data, error } = await fetchAll(() => construirQuery().in(coluna, fatia), chunk);
    if (error) return { data: null, error };
    if (data) for (const linha of data) todos.push(linha);
  }
  return { data: todos, error: null };
}

// ── T4.4: contagem de equipamentos por local ────────────────────────────────
// Tenta a view agregada; se ela ainda não existir no banco, cai no scan completo.
// Mesmo padrão de fallback já usado pelas vw_dashboard_* do dashboard.
async function contarEquipamentosPorLocal(nivel) {
  const coluna = { bloco: 'bloco_id', setor: 'setor_id', sala: 'sala_id' }[nivel];
  const mapa = {};

  const { data: view, error: erroView } = await db
    .from('vw_contagem_equipamentos_por_local')
    .select('local_id, total')
    .eq('nivel', nivel);

  if (!erroView && view) {
    view.forEach(r => { if (r.local_id) mapa[r.local_id] = Number(r.total) || 0; });
    return mapa;
  }

  console.warn('vw_contagem_equipamentos_por_local indisponível — usando varredura completa.');
  const { data: eqs } = await fetchAll(() => db.from('equipamentos').select(coluna));
  (eqs || []).forEach(e => { if (e[coluna]) mapa[e[coluna]] = (mapa[e[coluna]] || 0) + 1; });
  return mapa;
}

// ── T1.1b: faixa visível quando o sistema NÃO está apontando para produção ───
// config.js expõe IS_HOMOLOGACAO, mas nada no sistema o consumia: o switch de
// ambiente era completamente silencioso.
function marcarAmbienteNaoProdutivo() {
  if (typeof IS_HOMOLOGACAO === 'undefined' || !IS_HOMOLOGACAO) return;
  if (document.getElementById('app-faixa-ambiente')) return;
  const faixa = document.createElement('div');
  faixa.id = 'app-faixa-ambiente';
  faixa.textContent = '\u26A0 AMBIENTE DE HOMOLOGA\u00C7\u00C3O \u2014 os dados gravados aqui N\u00C3O v\u00E3o para a base de produ\u00E7\u00E3o';
  document.body.appendChild(faixa);
  document.body.classList.add('tem-faixa-ambiente');
}

// ── T3.2: toast global + wrapper de consulta ─────────────────────────────────
// Substitui alert() como camada de erro: alert bloqueia a UI e não registra nada.
let _appToastTimer = null;
function toast(msg, tipo = 'info') {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = (tipo === 'erro' ? 'erro ' : '') + 'show';
  if (_appToastTimer) clearTimeout(_appToastTimer);
  _appToastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

// Envolve uma consulta ao Supabase, notifica o usuário e registra no console.
// Uso: const eqs = await q(fetchAll(() => db.from('equipamentos').select('*')), 'inventário');
async function q(promise, contexto) {
  const { data, error } = await promise;
  if (error) {
    console.error('[' + contexto + ']', error);
    toast('Erro em ' + contexto + ': ' + error.message, 'erro');
    throw error;
  }
  return data;
}

// ── T3.1: watchdog de inatividade (30 min, aviso 2 min antes) ────────────────
// Sistema usado em notebook de sala técnica compartilhada — sessão eterna é risco.
const INATIVIDADE_LIMITE_MS = 30 * 60 * 1000;
const INATIVIDADE_AVISO_MS  = 2  * 60 * 1000;

function iniciarWatchdogInatividade() {
  const pag = window.location.pathname.split('/').pop();
  if (pag === '' || pag === 'index.html' || pag === 'verificar.html') return;

  let tExpira = null, tAviso = null, ultimoReset = 0;

  const encerrar = async () => {
    limparTimers();
    try { await db.auth.signOut(); } catch (e) { console.warn('signOut:', e); }
    window.location.href = 'index.html?motivo=inatividade';
  };

  const mostrarAviso = () => {
    let el = document.getElementById('app-aviso-inatividade');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-aviso-inatividade';
      el.innerHTML =
        '<div><h3 style="margin:0 0 10px;color:#1e3a5f;">Sessão prestes a expirar</h3>' +
        '<p style="margin:0 0 18px;color:#4a5568;font-size:14px;line-height:1.5;">' +
        'Por inatividade, sua sessão será encerrada em 2 minutos.</p>' +
        '<button type="button" id="btn-continuar-sessao" class="btn-primary">Continuar conectado</button></div>';
      document.body.appendChild(el);
      el.querySelector('#btn-continuar-sessao').addEventListener('click', () => {
        el.classList.remove('show');
        reiniciar(true);
      });
    }
    el.classList.add('show');
  };

  const limparTimers = () => { clearTimeout(tExpira); clearTimeout(tAviso); };

  function reiniciar(forcado = false) {
    const agora = Date.now();
    // Throttle: no máximo um reset por segundo, para não recriar timers a cada mousemove.
    if (!forcado && agora - ultimoReset < 1000) return;
    ultimoReset = agora;
    limparTimers();
    tAviso  = setTimeout(mostrarAviso, INATIVIDADE_LIMITE_MS - INATIVIDADE_AVISO_MS);
    tExpira = setTimeout(encerrar, INATIVIDADE_LIMITE_MS);
  }

  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    .forEach(ev => window.addEventListener(ev, () => reiniciar(), { passive: true }));
  reiniciar(true);
}

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
  el.style.color = cor === 'red'   ? '#dc2626'
                 : cor === 'green' ? '#059669'
                 : cor === 'orange'? '#c2410c'
                 : '#1a56db';
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
      // T1.2 — o cliente NUNCA cria o próprio perfil nem escreve a própria role.
      // A criação passou a ser responsabilidade do servidor: trigger
      // on_auth_user_created (AFTER INSERT ON auth.users), com defaults
      // 'leitor'/'pendente'. Aqui apenas registramos e seguimos com o e-mail.
      console.warn('profiles: perfil não localizado para', user.email,
                   '— criação é responsabilidade do trigger no servidor.');
    }
  } catch(e) {
    // RLS ou outro erro em profiles — não impede o uso do sistema
    console.warn('profiles sync:', e.message);
  }
}
// T2.2 — a promise é exportada para que as páginas sequenciem de verdade o
// carregamento de dados, em vez de apostar num setTimeout de 400 ms.
// T2.3 — o .finally() revela a página só depois da validação de sessão.
window.sessaoPronta = verificarSessaoGlobal()
  .catch(err => { console.error('verificarSessaoGlobal:', err); })
  .finally(() => {
    document.documentElement.classList.remove('sessao-pendente');
    marcarAmbienteNaoProdutivo();   // T1.1b
    iniciarWatchdogInatividade();   // T3.1
  });

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
// Parser defensivo único para o campo extras_tecnico (armazenado como `text` no banco,
// não `jsonb`). Sempre usar esta função para ler o campo — nunca chamar Object.keys()/
// Object.entries() direto nele, pois se vier como string JSON isso itera os caracteres
// da string em vez das chaves do objeto. Retorna sempre um objeto (nunca null/undefined).
function parseExtras(extras) {
  if (!extras) return {};
  if (typeof extras === 'object') return extras;
  try {
    const parsed = JSON.parse(extras);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

// Os 4 selects da Matriz de Criticidade Baseada em Riscos (equipamentos.html).
// Fonte única para persistência e restauração — não repetir estes IDs soltos pelo código.
const CRIT_MATRIZ_CAMPOS = ['crit-interrupcao', 'crit-seguranca', 'crit-operacao', 'crit-reserva'];

// Reconstrói um conjunto de respostas coerente com uma CLASSE já gravada, para ativos
// cadastrados antes de as respostas passarem a ser persistidas. Não recupera as respostas
// originais (elas nunca foram salvas), mas garante que reabrir e salvar o ativo PRESERVE a
// classe em vez de rebaixá-la. O gestor deve revisar e ajustar as respostas.
function reconstruirRespostasCriticidade(classe) {
  const c = normalizarClasseCriticidade(classe);
  if (c === 'Alta')  return { 'crit-interrupcao':'sim', 'crit-seguranca':'nao', 'crit-operacao':'nao', 'crit-reserva':'nao' };
  if (c === 'Média') return { 'crit-interrupcao':'sim', 'crit-seguranca':'nao', 'crit-operacao':'nao', 'crit-reserva':'sim' };
  if (c === 'Baixa') return { 'crit-interrupcao':'nao', 'crit-seguranca':'nao', 'crit-operacao':'nao', 'crit-reserva':'nao' };
  return null;
}

// Restaura os 4 selects da matriz ao abrir um ativo para edição e recalcula o rótulo da classe.
// Retorna true quando as respostas vieram gravadas, false quando foram reconstruídas da classe.
function restaurarMatrizCriticidade(eq) {
  const extras = parseExtras(eq.extras_tecnico);
  const temGravadas = CRIT_MATRIZ_CAMPOS.some(id => extras[id]);
  const fonte = temGravadas ? extras : (reconstruirRespostasCriticidade(eq.criticidade) || {});
  CRIT_MATRIZ_CAMPOS.forEach(id => {
    const el = $(id);
    if (el && fonte[id]) el.value = fonte[id];
  });
  calcularCriticidadeFluxograma();
  return temGravadas;
}

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
  VEN:  ['eq-funcao-ven','eq-tipo-ven','eq-diametro-ven','eq-tensao-ven','eq-vazao-ven'],
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
  atualizarAvisoExaustaoSala();
}


if ($('btn-salvar')) {
  $('btn-salvar').addEventListener('click', async () => {
    const tag = $('eq-tag')?.value.trim(); const cat = $('eq-categoria')?.value;
    if (!tag || !cat) { msgForm('msg-equipamento', 'TAG e Categoria são obrigatórias.', 'red'); return; }

    // ── Gate de exaustão ──────────────────────────────────────────────────────────────────
    // A Função é obrigatória em VEN porque é ela que determina se o ativo conta como exaustor
    // nos relatórios de conformidade. Sem ela, um exaustor centrífugo seria contabilizado como
    // ventilador comum e a sala continuaria aparecendo como pendente.
    if (cat === 'VEN') {
      const funcaoVen = _normalizarTextoSugestaoCriticidade($('eq-funcao-ven')?.value || '');
      if (!funcaoVen) {
        msgForm('msg-equipamento', 'Informe a Função do ativo (Exaustão, Ventilação ou Insuflamento) antes de salvar.', 'red');
        return;
      }
      if (funcaoVen.includes('exaust')) {
        const salaSel = obterSalaSelecionadaEquipamento();
        if (!salaSel) {
          msgForm('msg-equipamento', 'Selecione a Sala onde o exaustor será instalado antes de salvar.', 'red');
          return;
        }
        const exig = obterExigenciaExaustaoSala(salaSel);
        if (exig.exige !== true) {
          const aviso = exig.exige === false
            ? `A sala "${salaSel.nome}" não exige exaustão mecânica.\n${exig.motivo}`
            : `A sala "${salaSel.nome}" não possui Tipo de Ambiente nem exigência de exaustão cadastrados.`;
          const ok = confirm(`${aviso}\n\nExaustores devem ser cadastrados apenas em ambientes com exaustão obrigatória.\n\nDeseja registrar esta exceção mesmo assim?`);
          if (!ok) {
            msgForm('msg-equipamento', 'Cadastro cancelado. Ajuste a exigência de exaustão da sala em Locais → Salas.', 'red');
            return;
          }
        }
      }
    }

    msgForm('msg-equipamento', 'Salvando...', 'blue');
    // Localização agora vem de catálogos (instituicoes / blocos / setores / salas) selecionados, não mais texto livre.
    // setor/sala (texto) são mantidos em sincronia automaticamente para compatibilidade
    // com laudos, QR público, dashboard e filtros já existentes.
    const instId  = $('eq-instituicao-id')?.value || '';
    const blocoId = $('eq-bloco-id')?.value       || '';
    const setorId = $('eq-setor-id')?.value       || '';
    const salaId  = $('eq-sala-id')?.value        || '';
    const payload = {
      tag, categoria: cat,
      marca:      $('eq-marca')?.value.trim()      || null,
      produto:    $('eq-produto')?.value.trim()    || null,
      nr_serie:   $('eq-serie')?.value.trim()      || null,
      patrimonio: $('eq-patrimonio')?.value.trim() || null,
      setor_id:       setorId || null,
      sala_id:        salaId  || null,
      setor:      setorId ? $('eq-setor-id').selectedOptions[0].textContent : null,
      sala:       salaId  ? $('eq-sala-id').selectedOptions[0].textContent  : null,
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
    // As 4 respostas da Matriz de Criticidade também são persistidas. Sem isso, apenas a CLASSE
    // resultante era gravada — e ao reabrir o ativo para edição os selects voltavam ao padrão
    // ("Não" nas quatro), fazendo o salvamento recalcular e REBAIXAR a criticidade
    // silenciosamente. Guardar as respostas torna a edição idempotente.
    CRIT_MATRIZ_CAMPOS.forEach(id => {
      const el = $(id); if (el && el.value) extras[id] = el.value;
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
  if ($('eq-bloco-id')) {
    await popularSelectBlocos(eq.instituicao_id || '', 'eq-bloco-id');
    $('eq-bloco-id').value = eq.bloco_id || '';
  }
  if ($('eq-setor-id')) {
    await popularSelectSetores(eq.bloco_id || '', 'eq-setor-id');
    $('eq-setor-id').value = eq.setor_id || '';
  }
  if ($('eq-sala-id')) {
    await popularSelectSalas(eq.setor_id || '', 'eq-sala-id');
    $('eq-sala-id').value = eq.sala_id || '';
  }
  if (eq.categoria === 'AC') {
    definirCapacidadeBTU(eq.potencia || '');
  } else if ($('eq-potencia') && eq.potencia) {
    $('eq-potencia').value = eq.potencia;
  }
  if ($('eq-validade') && eq.validade) $('eq-validade').value = eq.validade;

  // Preenche os campos técnicos extras (extras_tecnico, armazenado como text)
  const extras = parseExtras(eq.extras_tecnico);
  Object.entries(extras).forEach(([k, v]) => {
    const el = $('eq-' + k);
    if (el) el.value = v;
  });

  // Restaura a Matriz de Criticidade — sem isto, salvar uma edição rebaixaria a classe.
  const critGravada = restaurarMatrizCriticidade(eq);

  // Atualiza o título e o botão para refletir o modo edição
  const btn = $('btn-salvar');
  if (btn) { btn.textContent = '💾 Salvar Alterações'; btn.style.background = '#d97706'; }
  msgForm('msg-equipamento',
    '✏️ Editando equipamento ' + (eq.tag || '')
    + (critGravada ? '' : ' — atenção: as respostas da Matriz de Criticidade foram reconstruídas a partir da classe gravada (' + (eq.criticidade || '—') + '). Revise-as antes de salvar.'),
    critGravada ? 'blue' : 'orange');
}

async function carregarEquipamentos() {
  const { data } = await fetchAll(() => db.from('equipamentos').select('*').order('tag', { ascending: true }));
  globalEquipamentos = data || [];
  filtrarEquipamentos(0);
  atualizarSelectEquipamentos();
}

// ----- Filtro por local (Instituição → Bloco → Setor → Sala) -----
// Compartilhado por gerir-equipamentos.html e impressoes.html (selects #gerir-filtro-*).
// Single source of truth: estado do filtro + funções de cascata vivem aqui em app.js;
// as páginas apenas chamam essas funções via onchange, nunca duplicam a lógica.
let _gerirFiltroLocal = { instituicaoId: '', blocoId: '', setorId: '', salaId: '' };

async function inicializarFiltrosGerir() {
  await popularSelectInstituicoes('gerir-filtro-instituicao', true);
  await popularSelectBlocosComTodos('', 'gerir-filtro-bloco', 'Todos os Blocos');
  await popularSelectSetoresComTodos('', 'gerir-filtro-setor', 'Todos os Setores');
  await popularSelectSalasComTodos('', 'gerir-filtro-sala', 'Todas as Salas');
}

// Após qualquer mudança no filtro de local, atualiza a tela que estiver ativa:
// a tabela de gerenciamento (filtrarEquipamentos) ou o contador da Central de Impressões
// (atualizarEscopoImpressao) — cada página só tem uma das duas funções definida.
function _atualizarListaAposFiltroLocalGerir() {
  if (typeof filtrarEquipamentos === 'function') filtrarEquipamentos(0);
  if (typeof atualizarEscopoImpressao === 'function') atualizarEscopoImpressao();
}

async function gerirAoMudarInstituicao() {
  _gerirFiltroLocal.instituicaoId = $('gerir-filtro-instituicao')?.value || '';
  _gerirFiltroLocal.blocoId = ''; _gerirFiltroLocal.setorId = ''; _gerirFiltroLocal.salaId = '';
  await popularSelectBlocosComTodos(_gerirFiltroLocal.instituicaoId, 'gerir-filtro-bloco', 'Todos os Blocos');
  await popularSelectSetoresComTodos('', 'gerir-filtro-setor', 'Todos os Setores');
  await popularSelectSalasComTodos('', 'gerir-filtro-sala', 'Todas as Salas');
  _atualizarListaAposFiltroLocalGerir();
}

async function gerirAoMudarBloco() {
  _gerirFiltroLocal.blocoId = $('gerir-filtro-bloco')?.value || '';
  _gerirFiltroLocal.setorId = ''; _gerirFiltroLocal.salaId = '';
  await popularSelectSetoresComTodos(_gerirFiltroLocal.blocoId, 'gerir-filtro-setor', 'Todos os Setores');
  await popularSelectSalasComTodos('', 'gerir-filtro-sala', 'Todas as Salas');
  _atualizarListaAposFiltroLocalGerir();
}

async function gerirAoMudarSetor() {
  _gerirFiltroLocal.setorId = $('gerir-filtro-setor')?.value || '';
  _gerirFiltroLocal.salaId = '';
  await popularSelectSalasComTodos(_gerirFiltroLocal.setorId, 'gerir-filtro-sala', 'Todas as Salas');
  _atualizarListaAposFiltroLocalGerir();
}

function gerirAoMudarSala() {
  _gerirFiltroLocal.salaId = $('gerir-filtro-sala')?.value || '';
  _atualizarListaAposFiltroLocalGerir();
}

async function gerirLimparFiltrosLocal() {
  _gerirFiltroLocal = { instituicaoId: '', blocoId: '', setorId: '', salaId: '' };
  if ($('gerir-filtro-instituicao')) $('gerir-filtro-instituicao').value = '';
  await inicializarFiltrosGerir();
  _atualizarListaAposFiltroLocalGerir();
}

function obterEquipamentosFiltrados() {
  const termo = ($('search-eq-termo')?.value || '').toLowerCase();
  const crit  = $('search-eq-criticidade')?.value || '';
  return globalEquipamentos.filter(e =>
    (!termo || e.tag.toLowerCase().includes(termo) || (e.produto||'').toLowerCase().includes(termo)) &&
    (!crit  || (e.criticidade||'') === crit) &&
    (!_gerirFiltroLocal.salaId        || String(e.sala_id||'')        === String(_gerirFiltroLocal.salaId)) &&
    (!_gerirFiltroLocal.setorId       || String(e.setor_id||'')       === String(_gerirFiltroLocal.setorId)) &&
    (!_gerirFiltroLocal.blocoId       || String(e.bloco_id||'')       === String(_gerirFiltroLocal.blocoId)) &&
    (!_gerirFiltroLocal.instituicaoId || String(e.instituicao_id||'') === String(_gerirFiltroLocal.instituicaoId))
  );
}

function filtrarEquipamentos(delta) {
  paginaAtualEquipamento = Math.max(0, paginaAtualEquipamento + delta);
  let items = obterEquipamentosFiltrados();
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
  if (!items.length) { toast('Nenhum ativo encontrado para gerar o relatório com os filtros atuais.'); return; }

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
  <div class="laudo-wrapper relatorio-livre">
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
  imprimir('area-relatorio-ativos', html, 'paisagem');
}

// Converte a capacidade textual do ativo (ex.: "12.000 BTU/h", "9000", "80.000 BTU/h") no
// valor numérico em BTU/h. O ponto é separador de milhar (padrão brasileiro) e é removido.
// T3.3 — Converte capacidade para BTU/h. Antes, "1,5 TR" virava 1.5 e a sala era
// classificada como "Subdimensionada" indevidamente no relatório de divergência.
// Formatos já suportados são preservados: "12.000 BTU/h", "12000", "9.000".
// Conversões: 1 TR = 12.000 BTU/h · 1 kW ≈ 3.412 BTU/h.
const BTU_POR_TR = 12000;
const BTU_POR_KW = 3412;

function parseCapacidadeBTU(str) {
  const bruto = String(str || '').trim();
  if (!bruto) return 0;

  // Unidade declarada explicitamente (TR / kW). "BTU/h" cai no caminho padrão.
  const unidade = /\bTR\b|\btonelada/i.test(bruto) ? 'TR'
                : (/\bkW\b/i.test(bruto) && !/\bBTU/i.test(bruto)) ? 'KW'
                : null;

  // Remove a unidade antes de normalizar o número.
  const semUnidade = bruto
    .replace(/\s*BTU\s*\/?\s*h?/i, '')
    .replace(/\s*\bTR\b/i, '')
    .replace(/\s*toneladas?\s*(de\s*)?(refrigera[cç][aã]o)?/i, '')
    .replace(/\s*\bkW\b/i, '')
    .trim();

  // Separadores: em TR/kW o ponto é decimal ("1.5 TR"); em BTU/h é milhar ("12.000").
  let normalizado;
  if (unidade && /^\d+[.,]\d+$/.test(semUnidade)) {
    normalizado = semUnidade.replace(',', '.');
  } else {
    normalizado = semUnidade.replace(/\./g, '').replace(',', '.');
  }

  const n = parseFloat(normalizado);
  if (isNaN(n)) return 0;

  if (unidade === 'TR') return Math.round(n * BTU_POR_TR);
  if (unidade === 'KW') return Math.round(n * BTU_POR_KW);
  return n;
}

// ----- Tipo de Ambiente da Sala (cadastro explícito em locais.html) -----
// Catálogo único (single source of truth) que associa cada Tipo de Ambiente a uma classe de
// criticidade sugerida e à exigência normativa de exaustão mecânica. Usado para popular o
// <select id="sala-tipo-ambiente">, para orientar o relatório de Adequação de Carga por Sala
// sem depender apenas do nome digitado da sala, e para as duas rotinas de consistência
// Ativo × Ambiente (divergência de criticidade e conformidade de exaustão).
//
// Campo `exaustao`: quando presente (string), indica que o ambiente EXIGE exaustão mecânica e
// descreve o motivo técnico/normativo. Ausente = exaustão não obrigatória por tipo. O cadastro
// da Sala pode sobrescrever essa sugestão (coluna salas.exige_exaustao = 'sim' | 'nao').
//
// Campo `assistencial`: marca os ambientes que caracterizam prestação de assistência à saúde e,
// portanto, atraem a RDC ANVISA nº 50/2002 e a ABNT NBR 7256:2021 (suprimento obrigatório de ar
// exterior filtrado). É a fonte autoritativa do item 5.3 do Plano PMOC — substitui a heurística
// por nome de setor/sala, que produzia falsos positivos: "Laboratório de Vida Diária" (ambiente
// simulado de terapia ocupacional, com cozinha, sala e quarto de treino) casava com o termo
// "laboratório" e era classificado como laboratório de análises. A heurística por nome permanece
// apenas como fallback para salas sem Tipo de Ambiente cadastrado.
const TIPOS_AMBIENTE_SALA = [
  // Criticidade Alta (A)
  { value: 'cpd_servidores',   label: 'CPD / Data Center / Sala de Servidores',     classe: 'Alta' },
  { value: 'telecom',          label: 'Telecomunicações — Sala Técnica (PABX, rack, distribuição)', classe: 'Alta' },
  { value: 'sala_baterias',    label: 'Sala de Baterias / Nobreak com Baterias Ventiladas', classe: 'Alta',
    exaustao: 'Baterias ventiladas (chumbo-ácido abertas) liberam hidrogênio — exaustão mecânica obrigatória. Baterias VRLA seladas dispensam' },
  { value: 'laboratorio',      label: 'Laboratório Químico / Biológico (análises, pesquisa, saúde)', classe: 'Alta',
    assistencial: true,
    exaustao: 'Manipulação de reagentes e agentes biológicos — exaustão/capela obrigatória' },
  { value: 'farmacia',         label: 'Farmácia — Dispensação / Estoque de Medicamentos', classe: 'Alta',
    assistencial: true },
  { value: 'farmacia_manipulacao', label: 'Farmácia de Manipulação / Laboratório Farmacotécnico', classe: 'Alta',
    assistencial: true,
    exaustao: 'Manipulação de insumos farmacêuticos — captação de pós e vapores (RDC ANVISA 67/2007)' },
  { value: 'camara_fria',      label: 'Câmara Fria / Frigorífica',                  classe: 'Alta' },
  { value: 'insumo_biologico', label: 'Insumos Biológicos / Banco de Sangue',       classe: 'Alta',
    assistencial: true,
    exaustao: 'Ambiente de contenção biológica — renovação de ar e controle de pressão' },
  { value: 'centro_cirurgico', label: 'Centro Cirúrgico / UTI / Emergência',        classe: 'Alta',
    assistencial: true,
    exaustao: 'Ambiente crítico assistencial — exaustão dedicada (ABNT NBR 7256)' },
  { value: 'arquivo_medico',   label: 'Arquivo Médico / Prontuários',               classe: 'Alta' },
  { value: 'raio_x',           label: 'Sala de Raio-X / Diagnóstico por Imagem',    classe: 'Alta',
    assistencial: true },
  // Criticidade Média (B)
  { value: 'sala_aula',        label: 'Sala de Aula',                               classe: 'Média' },
  { value: 'auditorio',        label: 'Auditório',                                  classe: 'Média' },
  { value: 'biblioteca',       label: 'Biblioteca',                                 classe: 'Média' },
  { value: 'administrativo',   label: 'Administrativo / Secretaria / Coordenação',  classe: 'Média' },
  { value: 'refeitorio',       label: 'Refeitório / Cantina',                       classe: 'Média',
    exaustao: 'Cocção e higienização — captação de vapores, calor e gordura (coifa/exaustor)' },
  { value: 'sala_professores', label: 'Sala de Professores / Reunião',              classe: 'Média' },
  { value: 'sala_tecnica_ti',  label: 'Sala Técnica de TI / Rack de Andar / Suporte', classe: 'Média' },
  { value: 'consultorio',      label: 'Consultório / Atendimento Clínico',          classe: 'Média',
    assistencial: true },
  { value: 'laboratorio_seco', label: 'Laboratório sem Agentes Químicos/Biológicos (Psicologia, Fonoaudiologia, Informática)', classe: 'Média' },
  { value: 'ambiente_simulado', label: 'Ambiente Simulado de Ensino (Lab. de Vida Diária, sala de habilidades, clínica-modelo)', classe: 'Média' },
  { value: 'sala_espera',      label: 'Sala de Espera / Recepção',                  classe: 'Média' },
  { value: 'deposito_quimico', label: 'Depósito de Produtos Químicos / Saneantes / Inflamáveis', classe: 'Média',
    exaustao: 'Guarda de produtos químicos, saneantes ou inflamáveis — renovação de ar para dispersão de vapores' },
  // Criticidade Baixa (C)
  { value: 'corredor',         label: 'Corredor / Circulação',                      classe: 'Baixa' },
  { value: 'banheiro',         label: 'Banheiro / Vestiário',                       classe: 'Baixa',
    exaustao: 'Sanitário/vestiário — exaustão mecânica obrigatória sem ventilação natural suficiente' },
  { value: 'deposito',         label: 'Depósito / Almoxarifado (materiais gerais)',  classe: 'Baixa' },
  { value: 'copa',             label: 'Copa sem Cocção (micro-ondas, bebedouro, pia)', classe: 'Baixa' },
  { value: 'copa_coccao',      label: 'Copa / Cozinha com Cocção (fogão, cooktop, forno)', classe: 'Baixa',
    exaustao: 'Cocção de alimentos — captação de vapores, calor e gordura (coifa ou exaustor)' },
  { value: 'estacionamento',   label: 'Estacionamento Descoberto / Área Externa',   classe: 'Baixa' },
  { value: 'garagem_fechada',  label: 'Garagem / Estacionamento Fechado (subsolo)', classe: 'Baixa',
    exaustao: 'Garagem fechada — exaustão de monóxido de carbono' },
  // Sem sugestão automática — usuário classifica manualmente cada ativo
  { value: 'outro',            label: 'Outro / Não classificado',                   classe: null },
];

function popularSelectTipoAmbiente(selectId) {
  const sel = $(selectId); if (!sel) return;
  const valorAtual = sel.value;
  const grupos = { Alta: [], 'Média': [], Baixa: [], _outro: [] };
  TIPOS_AMBIENTE_SALA.forEach(t => (t.classe ? grupos[t.classe] : grupos._outro).push(t));
  const optGroup = (label, itens) => itens.length
    ? `<optgroup label="${label}">${itens.map(t => `<option value="${t.value}">${escapeHTML(t.label)}</option>`).join('')}</optgroup>`
    : '';
  sel.innerHTML = '<option value="">— Selecione —</option>'
    + optGroup('Criticidade Alta (A)', grupos.Alta)
    + optGroup('Criticidade Média (B)', grupos['Média'])
    + optGroup('Criticidade Baixa (C)', grupos.Baixa)
    + optGroup('Outro', grupos._outro);
  if (valorAtual) sel.value = valorAtual;
}

// Retorna { classe, motivo, origem } com a criticidade sugerida para uma Sala.
// Prioriza o Tipo de Ambiente cadastrado explicitamente (origem: 'tipo'); se a sala não tiver
// tipo definido (cadastros antigos) ou o tipo for "Outro", cai para a heurística por nome
// (sugerirCriticidadeSala, origem: 'nome'). Retorna null se nenhuma das duas reconhecer o ambiente.
function obterCriticidadeSugeridaSala(sala) {
  const tipo = TIPOS_AMBIENTE_SALA.find(t => t.value === sala?.tipo_ambiente);
  if (tipo && tipo.classe) {
    return { classe: tipo.classe, motivo: `Baseado no Tipo de Ambiente cadastrado: ${tipo.label}`, origem: 'tipo' };
  }
  const porNome = sugerirCriticidadeSala(sala?.nome);
  return porNome ? { ...porNome, origem: 'nome' } : null;
}

// ----- Heurística de criticidade por nome de sala (fallback quando não há Tipo de Ambiente) -----
// Usada por obterCriticidadeSugeridaSala() apenas quando a sala não tem tipo_ambiente cadastrado
// (registros antigos) ou o tipo é "Outro". NÃO substitui a Matriz de Criticidade por ativo
// (equipamentos.html / calcularCriticidadeFluxograma) — é apenas um indicativo para o gestor.
const SUGESTAO_CRITICIDADE_SALA_REGRAS = [
  // ATENÇÃO: a avaliação é sequencial e o PRIMEIRO match vence. Esta regra precisa vir antes da
  // regra 'Alta', que contém a palavra genérica "laboratorio" — sem ela, "Laboratório de
  // Psicologia" seria classificado como Alta por conter o termo, apesar de não manipular
  // agentes químicos ou biológicos. Vale apenas como fallback: o Tipo de Ambiente cadastrado
  // na sala sempre prevalece sobre esta heurística de nome.
  { classe: 'Média', motivo: 'Laboratório sem manipulação de agentes químicos ou biológicos', palavras: [
    'psicologia', 'fonoaudiologia', 'fonoaudiologa', 'informatica', 'computacao',
    'laboratorio de idiomas', 'laboratorio de linguas', 'brinquedoteca', 'ludoteca',
  ]},
  { classe: 'Alta', motivo: 'Ambiente com equipamentos/insumos críticos (TI, saúde ou cadeia fria)', palavras: [
    'cpd', 'data center', 'datacenter', 'servidor', 'telecom', 'nobreak', 'no-break',
    'sala de baterias', 'banco de baterias', 'sala de bateria',
    'farmacia', 'camara fria', 'camara frigorifica', 'camara refrigerada',
    'laboratorio', 'bioquimica', 'microbiologia', 'patologia', 'anatomia', 'hemocentro',
    'banco de sangue', 'banco de dados', 'uti', 'cti', 'centro cirurgico', 'sala de cirurgia',
    'pronto socorro', 'emergencia', 'vacina', 'imunobiologico', 'arquivo medico', 'prontuario',
    'insumo biologico', 'necropsia', 'necroterio', 'central de gases', 'sala de gases',
    'raio-x', 'raio x', 'raiox', 'radiologia', 'tomografia', 'ressonancia', 'diagnostico por imagem',
  ]},
  { classe: 'Média', motivo: 'Ambiente de uso administrativo, acadêmico ou de convivência com fluxo relevante', palavras: [
    'sala de aula', 'auditorio', 'biblioteca', 'secretaria', 'coordenacao', 'administra',
    'recepcao', 'sala de espera', 'reuniao', 'diretoria', 'financeiro', 'recursos humanos', 'refeitorio',
    'cantina', 'restaurante', 'sala de professores', 'sala de estudo', 'tesouraria', 'protocolo',
    'consultorio', 'sala tecnica', 'rack', 'suporte tecnico', 'help desk', 'helpdesk',
  ]},
  { classe: 'Baixa', motivo: 'Ambiente de circulação, apoio ou permanência eventual, sem criticidade operacional', palavras: [
    'corredor', 'banheiro', 'sanitario', 'deposito', 'almoxarifado', 'copa', 'vestiario',
    'estacionamento', 'garagem', 'hall', 'circulacao', 'area externa',
  ]},
];

function _normalizarTextoSugestaoCriticidade(txt) {
  return (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Retorna { classe, motivo } com a classe de criticidade sugerida a partir do nome da sala,
// ou null se nenhuma palavra-chave reconhecida for encontrada (nome genérico, ex.: "Sala 204").
function sugerirCriticidadeSala(nomeSala) {
  const nome = _normalizarTextoSugestaoCriticidade(nomeSala);
  if (!nome) return null;
  for (const regra of SUGESTAO_CRITICIDADE_SALA_REGRAS) {
    if (regra.palavras.some(p => nome.includes(p))) return { classe: regra.classe, motivo: regra.motivo };
  }
  return null;
}

// ===================== CONSISTÊNCIA ATIVO × AMBIENTE =====================
// Dois controles derivados do cruzamento entre o cadastro de Salas (Locais → Salas) e o
// cadastro de Ativos (Novo Ativo / Gerenciamento de Ativos):
//
//   1) DIVERGÊNCIA DE CRITICIDADE — confronta a classe apurada pela Matriz de Criticidade
//      Baseada em Riscos de cada ativo (equipamentos.criticidade) com a criticidade esperada
//      do ambiente onde ele está instalado (Tipo de Ambiente da sala). O caso crítico é o
//      ativo SUBCLASSIFICADO: classe menor que a do ambiente, o que reduz indevidamente a
//      prioridade de atendimento e o MTTR-alvo de um ativo instalado em ambiente sensível.
//
//   2) CONFORMIDADE DE EXAUSTÃO — aponta salas que exigem exaustão mecânica e ainda não
//      possuem exaustor cadastrado, e exaustores instalados em ambientes que não a exigem.
//
// Single source of truth: relatórios (impressoes.html) e painéis (dashboard.html) consomem
// estas funções — nunca reimplementam a regra.

const EQ_CRITICIDADE_ORDEM = { 'Baixa': 1, 'Média': 2, 'Alta': 3 };

// Normaliza a classe gravada no ativo ("Alta", "Alta (A)", "media", "B"...) para um dos três
// rótulos canônicos. Retorna null quando o ativo não possui criticidade classificável.
function normalizarClasseCriticidade(valor) {
  const v = _normalizarTextoSugestaoCriticidade(valor).trim();
  if (!v) return null;
  if (v.startsWith('alta')  || v === 'a') return 'Alta';
  if (v.startsWith('media') || v === 'b') return 'Média';
  if (v.startsWith('baixa') || v === 'c') return 'Baixa';
  return null;
}

// Situações possíveis no confronto ativo × ambiente. `ordem` define a prioridade de exibição
// nos relatórios (menor primeiro): a divergência de risco aparece no topo da lista.
const DIVERGENCIA_CRIT_STATUS = {
  abaixo:     { rotulo: 'Subclassificado',           cls: 'danger',    ordem: 0, prioridade: true  },
  sem_classe: { rotulo: 'Ativo sem criticidade',     cls: 'warning',   ordem: 1, prioridade: true  },
  acima:      { rotulo: 'Superclassificado',         cls: 'andamento', ordem: 2, prioridade: false },
  sala_indef: { rotulo: 'Ambiente não classificado', cls: '',          ordem: 3, prioridade: false },
  sem_sala:   { rotulo: 'Sem sala vinculada',        cls: '',          ordem: 4, prioridade: false },
  alinhado:   { rotulo: 'Alinhado',                  cls: 'success',   ordem: 5, prioridade: false },
};

// Confronta cada ativo com a criticidade esperada da sala onde está instalado.
// Recebe as duas listas já carregadas (não faz I/O) para poder ser reutilizada por relatório,
// dashboard e testes. Retorna um array de análises, uma por ativo, na ordem recebida.
function analisarDivergenciaCriticidade(equipamentos, salas) {
  const mapaSalas = {};
  (salas || []).forEach(s => { mapaSalas[String(s.id)] = s; });

  return (equipamentos || []).map(eq => {
    const sala        = eq.sala_id ? mapaSalas[String(eq.sala_id)] : null;
    const classeAtivo = normalizarClasseCriticidade(eq.criticidade);
    const sugestao    = sala ? obterCriticidadeSugeridaSala(sala) : null;
    const classeSala  = sugestao ? sugestao.classe : null;

    let status;
    if (!sala)             status = 'sem_sala';
    else if (!classeAtivo) status = 'sem_classe';
    else if (!classeSala)  status = 'sala_indef';
    else {
      const nAtivo = EQ_CRITICIDADE_ORDEM[classeAtivo] || 0;
      const nSala  = EQ_CRITICIDADE_ORDEM[classeSala]  || 0;
      status = nAtivo === nSala ? 'alinhado' : (nAtivo < nSala ? 'abaixo' : 'acima');
    }
    return { eq, sala, classeAtivo, classeSala, sugestao, status, info: DIVERGENCIA_CRIT_STATUS[status] };
  });
}

// Consolida as análises em contadores por status (usado no dashboard e no quadro-resumo).
function resumirDivergenciaCriticidade(analises) {
  const resumo = { total: (analises || []).length, divergentes: 0 };
  Object.keys(DIVERGENCIA_CRIT_STATUS).forEach(k => { resumo[k] = 0; });
  (analises || []).forEach(a => {
    resumo[a.status] = (resumo[a.status] || 0) + 1;
    if (a.status === 'abaixo' || a.status === 'acima') resumo.divergentes++;
  });
  return resumo;
}

// ----- Exaustão mecânica -----
// Resolve se uma sala exige exaustão. O cadastro explícito (salas.exige_exaustao) sempre
// prevalece; na ausência dele, herda a regra do Tipo de Ambiente. Retorna:
//   { exige: true|false|null, origem: 'cadastro'|'tipo'|'indefinido', motivo: string }
// exige === null significa "não há informação suficiente" (sala sem tipo e sem cadastro).
function obterExigenciaExaustaoSala(sala) {
  const cadastro = (sala && sala.exige_exaustao ? String(sala.exige_exaustao) : '').toLowerCase();
  if (cadastro === 'sim') return { exige: true,  origem: 'cadastro', motivo: 'Exigência informada no cadastro da Sala' };
  if (cadastro === 'nao') return { exige: false, origem: 'cadastro', motivo: 'Dispensa informada no cadastro da Sala' };

  const tipo = TIPOS_AMBIENTE_SALA.find(t => t.value === (sala && sala.tipo_ambiente));
  if (!tipo || tipo.value === 'outro') {
    return { exige: null, origem: 'indefinido', motivo: 'Sala sem Tipo de Ambiente cadastrado — exigência não avaliada' };
  }
  return tipo.exaustao
    ? { exige: true,  origem: 'tipo', motivo: tipo.exaustao }
    : { exige: false, origem: 'tipo', motivo: `Tipo de Ambiente "${tipo.label}" não demanda exaustão mecânica dedicada` };
}

// Resolve o caráter ASSISTENCIAL de uma sala a partir do Tipo de Ambiente cadastrado.
// Retorna true | false quando há tipo definido, e null quando a sala não tem tipo (ou tem
// 'Outro') — hipótese em que cabe ao chamador aplicar sua heurística de fallback por nome.
// Fonte única consumida pelo item 5.3 do Plano PMOC.
function salaTipoEhAssistencial(sala) {
  const t = TIPOS_AMBIENTE_SALA.find(x => x.value === (sala && sala.tipo_ambiente));
  if (!t || t.value === 'outro') return null;
  return t.assistencial === true;
}

// Identifica se um ativo cumpre FUNÇÃO DE EXAUSTÃO. A categoria VEN é compartilhada entre
// ventiladores, exaustores e insufladores, e o campo "Tipo construtivo" não resolve a questão:
// "Centrífugo" e "Axial" descrevem o rotor, não a função — um centrífugo pode ser tanto caixa
// de exaustão quanto insuflador. Por isso a fonte primária é o campo "Função"
// (extras_tecnico['funcao-ven']), preenchido explicitamente no cadastro.
//
// A heurística por Tipo/texto permanece apenas como FALLBACK para registros legados,
// cadastrados antes da criação do campo Função.
function ehEquipamentoExaustor(eq) {
  if (!eq || eq.categoria !== 'VEN') return false;
  const extras = parseExtras(eq.extras_tecnico);

  // 1) Função declarada — decisão explícita, encerra a avaliação nos dois sentidos.
  const funcao = _normalizarTextoSugestaoCriticidade(extras['funcao-ven'] || extras['funcao_ven'] || '');
  if (funcao) return funcao.includes('exaust');

  // 2) Fallback para registros legados (sem Função preenchida).
  const tipoVen = _normalizarTextoSugestaoCriticidade(extras['tipo-ven'] || extras['tipo_ven'] || '');
  if (tipoVen.includes('exaustor')) return true;
  const texto = _normalizarTextoSugestaoCriticidade(`${eq.produto || ''} ${eq.tag || ''}`);
  return texto.includes('exaust') || /\bexr\b/.test(texto);
}

// Confronta cada sala com os exaustores nela cadastrados. Não faz I/O.
// Situações: 'pendente' (exige e não tem), 'conforme' (exige e tem), 'excedente' (não exige e
// tem exaustor instalado) e 'nao_exige' / 'indefinido' (informativos).
const EXAUSTAO_STATUS = {
  pendente:   { rotulo: 'Pendente — exige e não possui', cls: 'danger',    ordem: 0 },
  indefinido: { rotulo: 'Não avaliado',                  cls: 'warning',   ordem: 1 },
  excedente:  { rotulo: 'Instalado sem exigência',       cls: 'andamento', ordem: 2 },
  conforme:   { rotulo: 'Conforme',                      cls: 'success',   ordem: 3 },
  nao_exige:  { rotulo: 'Não exige exaustão',            cls: '',          ordem: 4 },
};

function analisarConformidadeExaustao(salas, equipamentos) {
  const exaustoresPorSala = {};
  (equipamentos || []).forEach(eq => {
    if (!eq.sala_id || !ehEquipamentoExaustor(eq)) return;
    (exaustoresPorSala[String(eq.sala_id)] = exaustoresPorSala[String(eq.sala_id)] || []).push(eq);
  });

  return (salas || []).map(sala => {
    const exigencia  = obterExigenciaExaustaoSala(sala);
    const exaustores = exaustoresPorSala[String(sala.id)] || [];
    let status;
    if (exigencia.exige === true)       status = exaustores.length ? 'conforme' : 'pendente';
    else if (exigencia.exige === false) status = exaustores.length ? 'excedente' : 'nao_exige';
    else                                status = exaustores.length ? 'conforme'  : 'indefinido';
    return { sala, exigencia, exaustores, qtd: exaustores.length, status, info: EXAUSTAO_STATUS[status] };
  });
}

function resumirConformidadeExaustao(analises) {
  const resumo = { total: (analises || []).length };
  Object.keys(EXAUSTAO_STATUS).forEach(k => { resumo[k] = 0; });
  (analises || []).forEach(a => { resumo[a.status] = (resumo[a.status] || 0) + 1; });
  return resumo;
}

// ----- Carregamento compartilhado (respeita o filtro de local da Central de Impressões) -----
// Devolve { salas, equipamentos } já recortados pelo filtro Instituição/Bloco/Setor/Sala
// selecionado em impressoes.html (_gerirFiltroLocal), com os joins de hierarquia nas salas.
async function _carregarBaseConsistenciaAtivoAmbiente(filtro) {
  // Sem argumento, usa o filtro da Central de Impressões; o Dashboard passa o seu (_dashFiltro).
  const f = filtro || _gerirFiltroLocal;

  const rSalas = await db.from('salas')
    .select('*, setores(id, nome, bloco_id, blocos(id, nome, instituicao_id, instituicoes(id, nome)))')
    .order('nome', { ascending: true });
  if (rSalas.error) throw rSalas.error;
  let salas = rSalas.data || [];

  if (f.salaId) {
    salas = salas.filter(s => String(s.id) === String(f.salaId));
  } else if (f.setorId) {
    salas = salas.filter(s => String(s.setor_id) === String(f.setorId));
  } else if (f.blocoId) {
    salas = salas.filter(s => String(s.setores?.bloco_id || '') === String(f.blocoId));
  } else if (f.instituicaoId) {
    salas = salas.filter(s => String(s.setores?.blocos?.instituicao_id || '') === String(f.instituicaoId));
  }

  const rEq = await fetchAll(() => db.from('equipamentos')
    .select('id, tag, produto, marca, categoria, criticidade, extras_tecnico, sala_id, sala, setor, bloco, instituicao_id, bloco_id, setor_id')
    .order('tag', { ascending: true }));
  if (rEq.error) throw rEq.error;
  const equipamentos = rEq.data || [];

  return { salas, equipamentos };
}

// Aplica o mesmo recorte de local aos ativos (usado quando globalEquipamentos não está
// carregado na página — dashboard, por exemplo).
function _filtrarEquipamentosPorFiltroLocal(equipamentos, filtro) {
  return (equipamentos || []).filter(e =>
    (!filtro.salaId        || String(e.sala_id || '')        === String(filtro.salaId)) &&
    (!filtro.setorId       || String(e.setor_id || '')       === String(filtro.setorId)) &&
    (!filtro.blocoId       || String(e.bloco_id || '')       === String(filtro.blocoId)) &&
    (!filtro.instituicaoId || String(e.instituicao_id || '') === String(filtro.instituicaoId))
  );
}

// ----- Relatório 1: Divergência de Criticidade (Ativo × Ambiente) — A4 paisagem -----
async function emitirRelatorioDivergenciaCriticidade() {
  let base;
  try {
    base = await _carregarBaseConsistenciaAtivoAmbiente();
  } catch (err) {
    toast('Erro ao carregar dados do relatório: ' + (err.message || err), 'erro');
    return;
  }

  const equipamentos = _filtrarEquipamentosPorFiltroLocal(base.equipamentos, _gerirFiltroLocal);
  if (!equipamentos.length) {
    toast('Nenhum ativo encontrado para o local selecionado no filtro.');
    return;
  }

  const analises = analisarDivergenciaCriticidade(equipamentos, base.salas);
  const resumo   = resumirDivergenciaCriticidade(analises);

  // O relatório lista apenas o que exige ação do gestor; os alinhados entram só no resumo.
  const listadas = analises
    .filter(a => a.status !== 'alinhado')
    .sort((a, b) => a.info.ordem - b.info.ordem
      || String(a.eq.sala || '').localeCompare(String(b.eq.sala || ''), 'pt-BR')
      || String(a.eq.tag  || '').localeCompare(String(b.eq.tag  || ''), 'pt-BR'));

  if (!listadas.length) {
    toast('Nenhuma divergência encontrada: todos os ativos do escopo estão alinhados à criticidade do ambiente.');
    return;
  }

  const CLS_BADGE = { Alta: 'danger', 'Média': 'warning', Baixa: 'success' };
  const badgeClasse = (classe, origem) => classe
    ? `<span class="tag-badge ${CLS_BADGE[classe] || ''}">${escapeHTML(classe)} (${EQ_CLASSE_LETRA[classe] || '?'})</span>${origem ? `<br><small style="color:#a0aec0;">${origem}</small>` : ''}`
    : '<span style="color:#a0aec0;">—</span>';

  const linhas = listadas.map(a => {
    const tipoInfo = a.sala ? TIPOS_AMBIENTE_SALA.find(t => t.value === a.sala.tipo_ambiente) : null;
    const local    = a.sala
      ? [a.sala.setores?.blocos?.nome, a.sala.setores?.nome].filter(Boolean).join(' / ')
      : [a.eq.bloco, a.eq.setor].filter(Boolean).join(' / ');
    const acao = {
      abaixo:     'Reavaliar a Matriz de Criticidade do ativo — classe inferior à do ambiente reduz indevidamente a prioridade de atendimento',
      acima:      'Verificar se a classe elevada se justifica (ativo reserva, insumo sensível) ou se há excesso de rigor no plano',
      sem_classe: 'Aplicar a Matriz de Criticidade Baseada em Riscos ao ativo',
      sala_indef: 'Cadastrar o Tipo de Ambiente da sala em Locais → Salas',
      sem_sala:   'Vincular o ativo a uma Sala em Gerenciamento de Ativos',
    }[a.status] || '';
    return `<tr>
      <td><strong>${escapeHTML(a.eq.tag || '—')}</strong><br><small style="color:#a0aec0;">${escapeHTML(EQ_CATEGORIA_LABEL_PLANO[a.eq.categoria] || a.eq.categoria || '—')}</small></td>
      <td>${escapeHTML(a.eq.produto || '—')}${a.eq.marca ? `<br><small style="color:#a0aec0;">${escapeHTML(a.eq.marca)}</small>` : ''}</td>
      <td>${escapeHTML(a.sala?.nome || a.eq.sala || '— sem sala —')}<br><small style="color:#a0aec0;">${escapeHTML(local || '—')}</small></td>
      <td>${tipoInfo ? escapeHTML(tipoInfo.label) : '<span style="color:#a0aec0;">— não cadastrado —</span>'}</td>
      <td style="text-align:center;">${badgeClasse(a.classeAtivo, null)}</td>
      <td style="text-align:center;">${badgeClasse(a.classeSala, a.sugestao ? (a.sugestao.origem === 'tipo' ? 'pelo tipo' : 'pelo nome') : null)}</td>
      <td style="text-align:center;"><span class="tag-badge ${a.info.cls}">${a.info.rotulo}</span></td>
      <td style="font-size:9px;color:#4a5568;">${escapeHTML(acao)}</td>
    </tr>`;
  }).join('');

  const card = (cor, bg, valor, rotulo) =>
    `<div style="flex:1;background:${bg};border:1px solid ${cor}44;border-radius:6px;padding:8px 10px;text-align:center;">
       <div style="font-size:20px;font-weight:800;color:${cor};line-height:1;">${valor}</div>
       <div style="font-size:9px;color:#4a5568;text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">${rotulo}</div>
     </div>`;
  const quadro = `<div style="display:flex;gap:8px;margin:2px 0 12px;">
    ${card('#dc2626', '#fef2f2', resumo.abaixo,     'Subclassificados')}
    ${card('#d97706', '#fffbeb', resumo.sem_classe, 'Sem criticidade')}
    ${card('#1e40af', '#eff6ff', resumo.acima,      'Superclassificados')}
    ${card('#718096', '#f7fafc', resumo.sala_indef + resumo.sem_sala, 'Não avaliados')}
    ${card('#059669', '#ecfdf5', resumo.alinhado,   'Alinhados')}
  </div>`;

  const pctAlinhado = resumo.total ? Math.round((resumo.alinhado / resumo.total) * 100) : 0;

  const html = `
  <div class="laudo-wrapper relatorio-livre">
    <div class="laudo-header">
      <div style="display:flex;align-items:center;gap:14px;"><img src="${LOGO_ETIQUETA}" alt="Logo" style="height:40px;width:auto;display:block;"><div><h1 style="font-size:16px;">Divergência de Criticidade — Ativo × Ambiente</h1><p>Classe apurada na Matriz de Riscos do ativo × criticidade esperada do ambiente onde está instalado</p></div></div>
      <div class="laudo-header-meta">
        <strong>Ativos avaliados: ${resumo.total}</strong><br>
        Divergentes: <strong>${resumo.divergentes}</strong> · Sem classificação: <strong>${resumo.sem_classe}</strong><br>
        Aderência ao ambiente: <strong>${pctAlinhado}%</strong><br>
        Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
    <div class="laudo-section">
      ${quadro}
      <table class="laudo-checklist-table">
        <thead>
          <tr>
            <th>TAG / Categoria</th>
            <th>Equipamento</th>
            <th>Sala / Bloco · Setor</th>
            <th>Tipo de Ambiente</th>
            <th style="text-align:center;">Criticidade<br>do Ativo</th>
            <th style="text-align:center;">Esperada<br>do Ambiente</th>
            <th style="text-align:center;">Situação</th>
            <th>Ação recomendada</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#718096;line-height:1.6;">
        <strong>Critério:</strong> a criticidade esperada do ambiente vem do <strong>Tipo de Ambiente</strong> cadastrado na Sala (Locais → Salas) e, na sua ausência, de palavras-chave no nome da sala.
        <span style="color:#dc2626;font-weight:700;">Subclassificado</span> = ativo com classe INFERIOR à do ambiente — divergência de risco, pois reduz a prioridade de atendimento e o MTTR-alvo de um ativo instalado em ambiente sensível.
        <span style="color:#1e40af;font-weight:700;">Superclassificado</span> = classe superior à do ambiente; legítimo quando justificado (ausência de reserva, insumo sensível), mas deve ser conferido para não inflar o plano de manutenção.
        <span style="color:#d97706;font-weight:700;">Sem criticidade</span> = ativo sem a Matriz de Riscos aplicada.
        Ativos alinhados não são listados — constam apenas no quadro-resumo.
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#718096;line-height:1.6;">
        <strong>Uso:</strong> este confronto é um instrumento de auditoria interna. A classe final de cada ativo permanece sendo a apurada pela Matriz de Criticidade Baseada em Riscos (impacto da interrupção, risco à segurança, criticidade operacional e existência de reserva), aplicada ativo a ativo — o Tipo de Ambiente é o indicativo de contexto, não a decisão.
      </div>
      <div style="margin-top:8px;font-size:9px;color:#a0aec0;">Documento gerado pelo Sistema de Gestão Univag · ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>`;

  imprimir('area-relatorio-divergencia-criticidade', html, 'paisagem');
}

// ----- Relatório 2: Conformidade de Exaustão por Sala — A4 paisagem -----
async function emitirRelatorioExaustaoSalas() {
  let base;
  try {
    base = await _carregarBaseConsistenciaAtivoAmbiente();
  } catch (err) {
    toast('Erro ao carregar dados do relatório: ' + (err.message || err), 'erro');
    return;
  }
  if (!base.salas.length) {
    toast('Nenhuma sala encontrada para o local selecionado no filtro.');
    return;
  }

  const analises = analisarConformidadeExaustao(base.salas, base.equipamentos);
  const resumo   = resumirConformidadeExaustao(analises);

  // Lista tudo que demanda ação ou conferência; salas sem exigência e sem exaustor ficam fora.
  const listadas = analises
    .filter(a => a.status !== 'nao_exige')
    .sort((a, b) => a.info.ordem - b.info.ordem
      || String(a.sala.nome || '').localeCompare(String(b.sala.nome || ''), 'pt-BR'));

  if (!listadas.length) {
    toast('Nenhuma sala do escopo exige exaustão mecânica nem possui exaustor cadastrado.');
    return;
  }

  const linhas = listadas.map(a => {
    const tipoInfo = TIPOS_AMBIENTE_SALA.find(t => t.value === a.sala.tipo_ambiente);
    const local    = [a.sala.setores?.blocos?.nome, a.sala.setores?.nome].filter(Boolean).join(' / ') || '—';
    const origem   = { cadastro: 'informado no cadastro', tipo: 'pelo Tipo de Ambiente', indefinido: 'não avaliado' }[a.exigencia.origem] || '';
    const exigeTxt = a.exigencia.exige === true
      ? `<span class="tag-badge danger">Sim</span><br><small style="color:#a0aec0;">${origem}</small>`
      : a.exigencia.exige === false
        ? `<span class="tag-badge success">Não</span><br><small style="color:#a0aec0;">${origem}</small>`
        : '<span style="color:#a0aec0;">— não avaliado —</span>';
    const tags = a.exaustores.length
      ? a.exaustores.map(e => escapeHTML(e.tag || '—')).join(', ')
      : '<span style="color:#a0aec0;">nenhum</span>';
    const acao = {
      pendente:   'Instalar/cadastrar exaustor no ambiente e abrir O.S. de adequação',
      excedente:  'Conferir se o exaustor pertence a esta sala ou marcar a exigência no cadastro',
      indefinido: 'Cadastrar o Tipo de Ambiente ou informar a exigência de exaustão em Locais → Salas',
      conforme:   'Manter o exaustor no escopo do PMOC (limpeza e verificação de vazão)',
    }[a.status] || '';
    return `<tr>
      <td><strong>${escapeHTML(a.sala.nome || '—')}</strong></td>
      <td>${escapeHTML(local)}</td>
      <td>${tipoInfo ? escapeHTML(tipoInfo.label) : '<span style="color:#a0aec0;">— não cadastrado —</span>'}</td>
      <td style="text-align:center;">${exigeTxt}</td>
      <td style="text-align:center;">${a.qtd}</td>
      <td style="font-size:9px;">${tags}</td>
      <td style="text-align:center;"><span class="tag-badge ${a.info.cls}">${a.info.rotulo}</span></td>
      <td style="font-size:9px;color:#4a5568;">${escapeHTML(acao)}</td>
    </tr>`;
  }).join('');

  const card = (cor, bg, valor, rotulo) =>
    `<div style="flex:1;background:${bg};border:1px solid ${cor}44;border-radius:6px;padding:8px 10px;text-align:center;">
       <div style="font-size:20px;font-weight:800;color:${cor};line-height:1;">${valor}</div>
       <div style="font-size:9px;color:#4a5568;text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">${rotulo}</div>
     </div>`;
  const quadro = `<div style="display:flex;gap:8px;margin:2px 0 12px;">
    ${card('#dc2626', '#fef2f2', resumo.pendente,   'Pendentes')}
    ${card('#059669', '#ecfdf5', resumo.conforme,   'Conformes')}
    ${card('#1e40af', '#eff6ff', resumo.excedente,  'Sem exigência')}
    ${card('#d97706', '#fffbeb', resumo.indefinido, 'Não avaliadas')}
    ${card('#718096', '#f7fafc', resumo.nao_exige,  'Dispensadas')}
  </div>`;

  const html = `
  <div class="laudo-wrapper relatorio-livre">
    <div class="laudo-header">
      <div style="display:flex;align-items:center;gap:14px;"><img src="${LOGO_ETIQUETA}" alt="Logo" style="height:40px;width:auto;display:block;"><div><h1 style="font-size:16px;">Conformidade de Exaustão Mecânica por Sala</h1><p>Ambientes que exigem exaustão × exaustores efetivamente cadastrados</p></div></div>
      <div class="laudo-header-meta">
        <strong>Salas avaliadas: ${resumo.total}</strong><br>
        Exigem exaustão: <strong>${resumo.pendente + resumo.conforme}</strong> · Pendentes: <strong>${resumo.pendente}</strong><br>
        Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
    <div class="laudo-section">
      ${quadro}
      <table class="laudo-checklist-table">
        <thead>
          <tr>
            <th>Sala</th>
            <th>Bloco / Setor</th>
            <th>Tipo de Ambiente</th>
            <th style="text-align:center;">Exige<br>exaustão?</th>
            <th style="text-align:center;">Exaustores</th>
            <th>TAGs</th>
            <th style="text-align:center;">Situação</th>
            <th>Ação recomendada</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#718096;line-height:1.6;">
        <strong>Critério:</strong> a exigência de exaustão vem do campo <strong>Exaustão mecânica</strong> do cadastro da Sala (Locais → Salas); quando deixado em "Herdar do Tipo de Ambiente", é inferida do Tipo cadastrado.
        <span style="color:#dc2626;font-weight:700;">Pendente</span> = ambiente exige exaustão e não possui exaustor cadastrado.
        <span style="color:#1e40af;font-weight:700;">Sem exigência</span> = há exaustor instalado em ambiente que não a demanda — conferir vínculo de sala ou revisar a exigência.
        <span style="color:#d97706;font-weight:700;">Não avaliada</span> = sala sem Tipo de Ambiente e sem exigência informada.
        Considera exaustores os ativos de categoria Ventilador/Exaustor (VEN) cuja <strong>Função</strong> cadastrada seja "Exaustão". Registros antigos, sem Função preenchida, são reconhecidos pelo Tipo construtivo ("Exaustor de Parede"/"Exaustor de Teto") ou pelo texto da TAG.
      </div>
      <div style="margin-top:8px;font-size:9px;color:#a0aec0;">Documento gerado pelo Sistema de Gestão Univag · ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>`;

  imprimir('area-relatorio-exaustao-salas', html, 'paisagem');
}

// ----- Adequação térmica: fonte única de classificação -----
// AUDITORIA 2026. O piso de adequação existia duplicado: plano-pmoc.html usava 0,96 e o
// relatório de divergência usava 100% (app.js). Na faixa 96,0%–99,9% o MESMO ambiente saía
// "Adequada" no documento entregue à fiscalização e "Subdimensionada" no relatório interno.
// O piso de 96% é o adotado: ambientes raramente operam em carga de pico simultânea, e a
// margem cobre o arredondamento das capacidades comerciais (9.000/12.000/18.000 BTU/h).
const ADEQUACAO_TERMICA_PISO  = 0.96; // abaixo disto → Subdimensionada
const ADEQUACAO_TERMICA_TETO  = 1.30; // acima disto  → Superdimensionada

// Classifica a capacidade instalada de um ambiente contra a carga térmica calculada.
// Retorna { status, cls, ordem, pct }. Os limites são parametrizáveis (a tela permite
// ajustá-los), mas o PADRÃO é único e compartilhado por todos os documentos do sistema.
function classificarAdequacaoCarga(prevista, instalada, pisoRatio, tetoRatio) {
  const p = parseFloat(prevista)  || 0;
  const q = parseFloat(instalada) || 0;
  const piso = Number.isFinite(pisoRatio) && pisoRatio > 0 ? pisoRatio : ADEQUACAO_TERMICA_PISO;
  const teto = Number.isFinite(tetoRatio) && tetoRatio >= piso ? tetoRatio : ADEQUACAO_TERMICA_TETO;
  const pct  = p > 0 ? (q / p) * 100 : 0;
  if (q <= 0)         return { status: 'Sem climatização',  cls: '',          ordem: 1, pct };
  if (q < p * piso)   return { status: 'Subdimensionada',   cls: 'danger',    ordem: 0, pct };
  if (q > p * teto)   return { status: 'Superdimensionada', cls: 'andamento', ordem: 3, pct };
  return                     { status: 'Adequada',          cls: 'success',   ordem: 2, pct };
}

// Relatório de Adequação da Carga Térmica por Sala (impressão/PDF, A4 paisagem).
// Compara a carga térmica prevista de cada sala (carga_termica_btu, calculada em Locais → Salas)
// com a capacidade de climatização instalada — soma da capacidade (BTU/h) dos aparelhos de
// ar-condicionado (categoria AC) vinculados à sala — e classifica cada sala em:
// Adequada, Subdimensionada, Superdimensionada ou Sem climatização.
async function emitirRelatorioAdequacaoSalas() {
  let salas, eqs;
  try {
    const rSalas = await db.from('salas')
      .select('*, setores(id, nome, bloco_id, blocos(id, nome, instituicao_id, instituicoes(id, nome)))')
      .order('nome', { ascending: true });
    if (rSalas.error) throw rSalas.error;
    salas = rSalas.data || [];
    const rEq = await fetchAll(() => db.from('equipamentos').select('sala_id, categoria, potencia'));
    if (rEq.error) throw rEq.error;
    eqs = rEq.data || [];
  } catch (err) {
    toast('Erro ao carregar dados do relatório: ' + (err.message || err), 'erro');
    return;
  }

  // Respeita o filtro de local (Instituição/Bloco/Setor/Sala) selecionado na Central de
  // Impressões — mesma fonte de estado (_gerirFiltroLocal) usada por obterEquipamentosFiltrados().
  if (_gerirFiltroLocal.salaId) {
    salas = salas.filter(s => String(s.id) === String(_gerirFiltroLocal.salaId));
  } else if (_gerirFiltroLocal.setorId) {
    salas = salas.filter(s => String(s.setor_id) === String(_gerirFiltroLocal.setorId));
  } else if (_gerirFiltroLocal.blocoId) {
    salas = salas.filter(s => String(s.setores?.bloco_id || '') === String(_gerirFiltroLocal.blocoId));
  } else if (_gerirFiltroLocal.instituicaoId) {
    salas = salas.filter(s => String(s.setores?.blocos?.instituicao_id || '') === String(_gerirFiltroLocal.instituicaoId));
  }

  const listaSalas = salas.filter(s => (parseFloat(s.carga_termica_btu) || 0) > 0);
  if (!listaSalas.length) {
    const filtroAtivo = _gerirFiltroLocal.salaId || _gerirFiltroLocal.setorId || _gerirFiltroLocal.blocoId || _gerirFiltroLocal.instituicaoId;
    toast(filtroAtivo
      ? 'Nenhuma sala com carga térmica prevista foi encontrada para o local selecionado no filtro.'
      : 'Nenhuma sala com carga térmica prevista foi encontrada.\n\nInforme a área e os parâmetros das salas em Locais → Salas para que a carga seja calculada.');
    return;
  }

  // Capacidade instalada (BTU/h) e nº de ACs por sala — considera apenas categoria AC.
  const capMap = {}, acCountMap = {};
  eqs.forEach(e => {
    if (e.categoria !== 'AC' || !e.sala_id) return;
    acCountMap[e.sala_id] = (acCountMap[e.sala_id] || 0) + 1;
    capMap[e.sala_id]     = (capMap[e.sala_id] || 0) + parseCapacidadeBTU(e.potencia);
  });

  // Intervalos de classificação definidos pelo usuário (em % da carga prevista), com
  // validação e valores padrão (100% a 130%) caso os campos estejam ausentes/ inválidos.
  // O PADRÃO vem de ADEQUACAO_TERMICA_PISO/TETO — as mesmas constantes usadas na Seção 5.4
  // do Plano PMOC — para que relatório e documento oficial nunca classifiquem o ambiente de
  // formas diferentes. Antes o padrão daqui era 100%, divergindo do 96% do plano.
  let minPct = parseInt($('adeq-limite-min')?.value);
  let maxPct = parseInt($('adeq-limite-max')?.value);
  if (!Number.isFinite(minPct) || minPct < 1)      minPct = Math.round(ADEQUACAO_TERMICA_PISO * 100);
  if (!Number.isFinite(maxPct) || maxPct < minPct) maxPct = Math.max(minPct, Math.round(ADEQUACAO_TERMICA_TETO * 100));
  const minRatio = minPct / 100;
  const maxRatio = maxPct / 100;

  let nOk = 0, nSub = 0, nSuper = 0, nSem = 0;
  const dados = listaSalas.map(s => {
    const prevista  = Math.round(parseFloat(s.carga_termica_btu) || 0);
    const instalada = Math.round(capMap[s.id] || 0);
    const nAC       = acCountMap[s.id] || 0;
    const { status, cls, ordem, pct } = classificarAdequacaoCarga(prevista, instalada, minRatio, maxRatio);
    if      (status === 'Sem climatização')  nSem++;
    else if (status === 'Subdimensionada')   nSub++;
    else if (status === 'Superdimensionada') nSuper++;
    else                                     nOk++;
    const local     = [s.setores?.blocos?.nome, s.setores?.nome].filter(Boolean).join(' / ') || '—';
    const sugestao  = obterCriticidadeSugeridaSala(s);
    return { s, prevista, instalada, nAC, pct, status, cls, ordem, local, sugestao, saldo: instalada - prevista };
  }).sort((a, b) => a.ordem - b.ordem || a.pct - b.pct);

  // Acumulados (totais gerais) exibidos no cabeçalho e no rodapé da tabela.
  const totPrevista  = dados.reduce((a, d) => a + d.prevista, 0);
  const totInstalada = dados.reduce((a, d) => a + d.instalada, 0);
  const totACs       = dados.reduce((a, d) => a + d.nAC, 0);
  const totArea      = dados.reduce((a, d) => a + (parseFloat(d.s.area_m2) || 0), 0);
  const totSaldo     = totInstalada - totPrevista;
  const pctGlobal    = totPrevista > 0 ? (totInstalada / totPrevista) * 100 : 0;
  const sinalSaldo   = totSaldo >= 0 ? '+' : '−';
  const corSaldoHdr  = totSaldo < 0 ? '#fecaca' : '#bbf7d0'; // tons claros, legíveis sobre o azul do cabeçalho
  const corSaldoFoot = totSaldo < 0 ? '#dc2626' : '#059669';

  const CLS_BADGE_SUGESTAO = { Alta: 'danger', Média: 'warning', Baixa: 'success' };
  const linhas = dados.map(d => {
    const temAC    = d.instalada > 0;
    const saldoTxt = temAC ? `${d.saldo >= 0 ? '+' : '−'}${Math.abs(d.saldo).toLocaleString('pt-BR')}` : '—';
    const saldoCor = !temAC ? '#a0aec0' : d.saldo < 0 ? '#dc2626' : '#059669';
    const sugestaoTxt = d.sugestao
      ? `<span class="tag-badge ${CLS_BADGE_SUGESTAO[d.sugestao.classe] || ''}" title="${escapeHTML(d.sugestao.motivo)}">${escapeHTML(d.sugestao.classe)} (${EQ_CLASSE_LETRA[d.sugestao.classe] || '?'})</span><br><small style="color:#a0aec0;">${d.sugestao.origem === 'tipo' ? 'pelo tipo' : 'pelo nome'}</small>`
      : '<span style="color:#a0aec0;">— não classificado —</span>';
    return `<tr>
      <td><strong>${escapeHTML(d.s.nome)}</strong></td>
      <td>${escapeHTML(d.local)}</td>
      <td style="text-align:right;">${d.s.area_m2 ? Number(d.s.area_m2).toLocaleString('pt-BR') : '—'}</td>
      <td style="text-align:right;">${d.prevista.toLocaleString('pt-BR')}</td>
      <td style="text-align:right;">${temAC ? d.instalada.toLocaleString('pt-BR') : '—'}</td>
      <td style="text-align:center;">${d.nAC}</td>
      <td style="text-align:right;color:${saldoCor};font-weight:600;">${saldoTxt}</td>
      <td style="text-align:center;">${temAC ? d.pct.toFixed(0) + '%' : '—'}</td>
      <td style="text-align:center;"><span class="tag-badge ${d.cls}">${d.status}</span></td>
      <td style="text-align:center;">${sugestaoTxt}</td>
    </tr>`;
  }).join('');

  const card = (cor, bg, valor, rotulo) =>
    `<div style="flex:1;background:${bg};border:1px solid ${cor}44;border-radius:6px;padding:8px 10px;text-align:center;">
       <div style="font-size:20px;font-weight:800;color:${cor};line-height:1;">${valor}</div>
       <div style="font-size:9px;color:#4a5568;text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">${rotulo}</div>
     </div>`;
  const resumo = `<div style="display:flex;gap:8px;margin:2px 0 12px;">
    ${card('#059669', '#ecfdf5', nOk,    'Adequadas')}
    ${card('#dc2626', '#fef2f2', nSub,   'Subdimensionadas')}
    ${card('#1e40af', '#eff6ff', nSuper, 'Superdimensionadas')}
    ${card('#718096', '#f7fafc', nSem,   'Sem climatização')}
  </div>`;

  const html = `
  <div class="laudo-wrapper relatorio-livre">
    <div class="laudo-header">
      <div style="display:flex;align-items:center;gap:14px;"><img src="${LOGO_ETIQUETA}" alt="Logo" style="height:40px;width:auto;display:block;"><div><h1 style="font-size:16px;">Adequação da Carga Térmica por Sala</h1><p>Carga prevista × capacidade de climatização instalada (ar-condicionado)</p></div></div>
      <div class="laudo-header-meta">
        <strong>Salas avaliadas: ${dados.length}</strong> · ${totACs} ar-condicionado(s)<br>
        Carga prevista total: <strong>${totPrevista.toLocaleString('pt-BR')} BTU/h</strong><br>
        Capacidade instalada: <strong>${totInstalada.toLocaleString('pt-BR')} BTU/h</strong><br>
        Saldo acumulado: <strong style="color:${corSaldoHdr};">${sinalSaldo}${Math.abs(totSaldo).toLocaleString('pt-BR')} BTU/h (${pctGlobal.toFixed(0)}%)</strong><br>
        Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
    <div class="laudo-section">
      ${resumo}
      <table class="laudo-checklist-table">
        <thead>
          <tr>
            <th>Sala</th><th>Bloco / Setor</th>
            <th style="text-align:right;">Área (m²)</th>
            <th style="text-align:right;">Carga Prevista (BTU/h)</th>
            <th style="text-align:right;">Instalada (BTU/h)</th>
            <th style="text-align:center;">ACs</th>
            <th style="text-align:right;">Saldo (BTU/h)</th>
            <th style="text-align:center;">Atend.</th>
            <th style="text-align:center;">Situação</th>
            <th style="text-align:center;">Criticidade Sugerida<br><small style="font-weight:400;">(Tipo de Ambiente / nome da sala)</small></th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr style="font-weight:700;background:#eef2f7;">
            <td>ACUMULADO</td>
            <td style="text-align:right;color:#718096;">${dados.length} sala(s)</td>
            <td style="text-align:right;">${totArea > 0 ? totArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
            <td style="text-align:right;">${totPrevista.toLocaleString('pt-BR')}</td>
            <td style="text-align:right;">${totInstalada.toLocaleString('pt-BR')}</td>
            <td style="text-align:center;">${totACs}</td>
            <td style="text-align:right;color:${corSaldoFoot};">${sinalSaldo}${Math.abs(totSaldo).toLocaleString('pt-BR')}</td>
            <td style="text-align:center;">${pctGlobal.toFixed(0)}%</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#718096;line-height:1.6;">
        <strong>Critério (intervalos definidos: ${minPct}% a ${maxPct}% da carga prevista):</strong>
        <span style="color:#059669;font-weight:700;">Adequada</span> = capacidade instalada entre ${minPct}% e ${maxPct}% da carga prevista.
        <span style="color:#dc2626;font-weight:700;">Subdimensionada</span> = abaixo de ${minPct}%.
        <span style="color:#1e40af;font-weight:700;">Superdimensionada</span> = acima de ${maxPct}% (revisar eficiência/consumo).
        <span style="color:#718096;font-weight:700;">Sem climatização</span> = nenhum ar-condicionado vinculado à sala.
        Considera apenas ativos de categoria Ar-Condicionado (AC) com capacidade em BTU/h informada. Carga prevista calculada pelo método prático NBR 16401 / ASHRAE.
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#718096;line-height:1.6;">
        <strong>Criticidade Sugerida:</strong> orientação automática — prioriza o <strong>Tipo de Ambiente</strong> cadastrado na Sala (Locais → Salas); quando ausente ("Outro" ou registros antigos), usa palavras-chave no nome da sala (ex.: "Laboratório", "CPD", "Sala de Aula", "Corredor") como alternativa.
        Não substitui a Matriz de Criticidade Baseada em Riscos aplicada a cada ativo em Novo Ativo/Gerenciamento de Ativos.
        Salas sem Tipo de Ambiente e sem indício no nome exibem "— não classificado —".
      </div>
      <div style="margin-top:8px;font-size:9px;color:#a0aec0;">Documento gerado pelo Sistema de Gestão Univag · ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>`;

  imprimir('area-relatorio-adequacao-salas', html, 'paisagem');
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
    toast('Biblioteca de exportação (XLSX) não carregada. Recarregue a página e tente novamente.');
    return;
  }
  const items = obterEquipamentosFiltrados();
  if (!items.length) { toast('Nenhum ativo encontrado para exportar com os filtros atuais.'); return; }

  // ----- Aba 1: Inventário -----
  const linhas = items.map(eq => {
    const extras = parseExtras(eq.extras_tecnico);
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
      'Quantidade de Gás (KG)':    (extras['gas-qtd'] || '').replace('.', ','),
      'Potência (BTU/h)':          isAC ? (() => { const n = parseFloat((eq.potencia || '').replace(/\s*BTU\/h/i, '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? '' : n; })() : '',
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
      toast('⚠️ A coluna "qrcode_token" ainda não existe no banco.\n\nExecute o script fix_qrcode_token.sql no Supabase (SQL Editor) antes de gerar os QR Codes.');
    } else {
      toast('Erro ao gerar QR Code: ' + error.message, 'erro');
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
  if (!semToken.length) { toast('Todos os ativos já possuem QR Code.'); return; }
  if (!confirm(`Gerar QR Code para ${semToken.length} ativo(s) sem token?`)) return;
  for (const eq of semToken) {
    const token = crypto.randomUUID();
    const { error } = await db.from('equipamentos').update({ qrcode_token: token }).eq('id', eq.id);
    if (!error) eq.qrcode_token = token;
  }
  filtrarEquipamentos(0);
  toast(`✓ QR Code gerado para ${semToken.length} ativo(s).`);
}

async function atualizarSelectEquipamentos() {
  const { data } = await fetchAll(() => db.from('equipamentos').select('id, tag, produto, categoria').order('tag', { ascending: true }));
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
  const { data } = await fetchAll(() => db.from('colaboradores').select('id, nome, assinatura_url, assinatura_digital'));
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
  const { data } = await fetchAll(() => db.from('colaboradores').select('*, funcoes(nome)').order('nome', { ascending: true }));
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
  const { data: colabs }  = await fetchAll(() => db.from('colaboradores').select('funcao_id'));
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
  const { data } = await fetchAll(() => db.from('blocos').select('id, nome').eq('instituicao_id', instituicaoId).order('nome', { ascending: true }));
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
  // Bloco mudou → Setor e Sala (dependentes) precisam ser reiniciados também
  await popularSelectSetores('', 'eq-setor-id');
  await popularSelectSalas('', 'eq-sala-id');
}

// Popula um <select> de Setores filtrado pelo Bloco escolhido (cascata).
// Sem blocoId, o select fica vazio e desabilitado.
async function popularSelectSetores(blocoId, selectId) {
  const sel = $(selectId); if (!sel) return;
  if (!blocoId) {
    sel.innerHTML = '<option value="">— Selecione o bloco primeiro —</option>';
    sel.disabled = true;
    return;
  }
  const { data } = await fetchAll(() => db.from('setores').select('id, nome').eq('bloco_id', blocoId).order('nome', { ascending: true }));
  sel.disabled = false;
  sel.innerHTML = '<option value="">— Selecione —</option>'
    + (data || []).map(s => `<option value="${s.id}">${escapeHTML(s.nome)}</option>`).join('');
}

// Popula um <select> de Salas filtrado pelo Setor escolhido (cascata).
// Sem setorId, o select fica vazio e desabilitado.
async function popularSelectSalas(setorId, selectId) {
  const sel = $(selectId); if (!sel) return;
  if (!setorId) {
    sel.innerHTML = '<option value="">— Selecione o setor primeiro —</option>';
    sel.disabled = true;
    return;
  }
  // tipo_ambiente e exige_exaustao viajam como data-attributes da <option> para que o cadastro
  // de Ativos possa validar a instalação de exaustores sem uma segunda consulta ao banco.
  const { data } = await fetchAll(() => db.from('salas').select('id, nome, tipo_ambiente, exige_exaustao').eq('setor_id', setorId).order('nome', { ascending: true }));
  sel.disabled = false;
  sel.innerHTML = '<option value="">— Selecione —</option>'
    + (data || []).map(s => `<option value="${s.id}" data-tipo-ambiente="${escapeHTML(s.tipo_ambiente || '')}" data-exige-exaustao="${escapeHTML(s.exige_exaustao || '')}">${escapeHTML(s.nome)}</option>`).join('');
}

// Lê a sala selecionada no cadastro de Ativos a partir dos data-attributes da <option>,
// devolvendo um objeto no mesmo formato consumido por obterExigenciaExaustaoSala().
function obterSalaSelecionadaEquipamento() {
  const sel = $('eq-sala-id');
  const opt = sel && sel.value ? sel.selectedOptions[0] : null;
  if (!opt) return null;
  return {
    id:             sel.value,
    nome:           opt.textContent,
    tipo_ambiente:  opt.dataset.tipoAmbiente  || null,
    exige_exaustao: opt.dataset.exigeExaustao || null,
  };
}

// Aviso em tela (equipamentos.html) quando um EXAUSTOR está sendo cadastrado em uma sala que
// não exige exaustão mecânica — ou quando a sala escolhida a exige e o ativo não é exaustor.
// Não bloqueia por si só: a confirmação obrigatória acontece no clique de salvar.
function atualizarAvisoExaustaoSala() {
  const el = $('aviso-exaustao-sala'); if (!el) return;
  const cat  = $('eq-categoria')?.value || '';
  const sala = obterSalaSelecionadaEquipamento();
  if (cat !== 'VEN' || !sala) { el.style.display = 'none'; el.innerHTML = ''; return; }

  const tipoVen  = $('eq-tipo-ven')?.value || '';
  const funcao   = _normalizarTextoSugestaoCriticidade($('eq-funcao-ven')?.value || '');
  // Mesma precedência de ehEquipamentoExaustor(): Função declarada vence; Tipo é só fallback.
  const exaustor = funcao ? funcao.includes('exaust')
                          : _normalizarTextoSugestaoCriticidade(tipoVen).includes('exaustor');
  const r        = obterExigenciaExaustaoSala(sala);

  let cor = '', texto = '';
  if (exaustor && r.exige === true) {
    cor = '#059669';
    texto = `✓ Ambiente com exaustão obrigatória. ${escapeHTML(r.motivo)}`;
  } else if (exaustor && r.exige === false) {
    cor = '#c2410c';
    texto = `⚠ A sala <strong>${escapeHTML(sala.nome)}</strong> não está marcada como ambiente que exige exaustão mecânica. ${escapeHTML(r.motivo)} Ajuste o cadastro da sala em Locais → Salas ou confirme a exceção ao salvar.`;
  } else if (exaustor && r.exige === null) {
    cor = '#b45309';
    texto = `⚠ A sala <strong>${escapeHTML(sala.nome)}</strong> não tem Tipo de Ambiente nem exigência de exaustão cadastrados — não é possível validar a obrigatoriedade.`;
  } else if (!exaustor && r.exige === true) {
    cor = '#1e40af';
    texto = `ℹ Este ambiente exige exaustão mecânica. ${escapeHTML(r.motivo)}`;
  } else {
    el.style.display = 'none'; el.innerHTML = ''; return;
  }
  el.style.display = 'block';
  el.style.color   = cor;
  el.innerHTML     = texto;
}

// Disparado pelo onchange do select de Bloco em equipamentos.html
async function atualizarSelectSetoresCascata(manterValor) {
  const blocoId = $('eq-bloco-id')?.value || '';
  const setorAnterior = manterValor ? $('eq-setor-id')?.value : '';
  await popularSelectSetores(blocoId, 'eq-setor-id');
  if (setorAnterior) $('eq-setor-id').value = setorAnterior;
  // Setor mudou → Sala (dependente) precisa ser reiniciada também
  await popularSelectSalas('', 'eq-sala-id');
}

// Disparado pelo onchange do select de Setor em equipamentos.html
async function atualizarSelectSalasCascata(manterValor) {
  const setorId = $('eq-setor-id')?.value || '';
  const salaAnterior = manterValor ? $('eq-sala-id')?.value : '';
  await popularSelectSalas(setorId, 'eq-sala-id');
  if (salaAnterior) $('eq-sala-id').value = salaAnterior;
  atualizarAvisoExaustaoSala();
}

// ----- CRUD: Instituições / Unidades -----
let _instituicoesCache = [];

async function carregarInstituicoes() {
  const tbody = $('tbody-instituicoes'); if (!tbody) return;
  const { data: instituicoes } = await db.from('instituicoes').select('*').order('nome', { ascending: true });
  const { data: blocosTodos }  = await fetchAll(() => db.from('blocos').select('instituicao_id'));
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
  if (error) { toast('Não foi possível remover: ' + error.message, 'erro'); return; }
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
  const { data: blocos } = await fetchAll(() => query);
  _blocosCache = blocos || [];
  const countMap = await contarEquipamentosPorLocal('bloco');   // T4.4
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
  if (error) { toast('Não foi possível remover: ' + error.message, 'erro'); return; }
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

// ----- CRUD: Setores -----
let _setoresCache = [];

async function carregarSetores() {
  const tbody = $('tbody-setores'); if (!tbody) return;
  const filtroBloco = $('filtro-setor-bloco')?.value || '';
  let query = db.from('setores').select('*, blocos(nome, instituicoes(nome))').order('nome', { ascending: true });
  if (filtroBloco) query = query.eq('bloco_id', filtroBloco);
  const { data: setores } = await fetchAll(() => query);
  _setoresCache = setores || [];
  const countMap = await contarEquipamentosPorLocal('setor');   // T4.4
  tbody.innerHTML = _setoresCache.length ? _setoresCache.map(s => `<tr>
      <td><strong>${escapeHTML(s.nome)}</strong></td>
      <td>${escapeHTML(s.blocos?.nome)} <span style="color:#a0aec0;">(${escapeHTML(s.blocos?.instituicoes?.nome)})</span></td>
      <td style="text-align:center;"><span class="tag-badge">${countMap[s.id] || 0}</span></td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarSetor('${s.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirSetor('${s.id}')">✕</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4" class="td-loading">Sem registros.</td></tr>';
}

function editarSetor(id) {
  const s = _setoresCache.find(x => x.id === id); if (!s) return;
  $('setor-id-edicao').value = s.id;
  $('setor-bloco').value = s.bloco_id || '';
  $('setor-nome').value = s.nome || '';
  $('btn-salvar-setor').textContent = '💾 Atualizar Setor';
  $('btn-cancelar-setor').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetarFormSetor() {
  $('setor-id-edicao').value = '';
  $('setor-bloco').value = '';
  $('setor-nome').value = '';
  $('btn-salvar-setor').textContent = '💾 Salvar Setor';
  $('btn-cancelar-setor').style.display = 'none';
}

async function excluirSetor(id) {
  if (!confirm('Remover este Setor? Só será possível se não houver Salas ou Ativos vinculados a ele.')) return;
  const { error } = await db.from('setores').delete().eq('id', id);
  if (error) { toast('Não foi possível remover: ' + error.message, 'erro'); return; }
  carregarSetores();
}

if ($('btn-salvar-setor')) {
  $('btn-salvar-setor').addEventListener('click', async () => {
    const bloco_id = $('setor-bloco')?.value;
    const nome = $('setor-nome')?.value.trim();
    if (!bloco_id || !nome) { msgForm('msg-setor', 'Selecione o Bloco e informe o nome do Setor.', 'red'); return; }
    msgForm('msg-setor', 'Salvando...', 'blue');
    const idEd = $('setor-id-edicao')?.value;
    const { error } = idEd
      ? await db.from('setores').update({ bloco_id, nome }).eq('id', idEd)
      : await db.from('setores').insert([{ bloco_id, nome }]);
    if (error) { msgForm('msg-setor', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-setor', idEd ? '✓ Setor atualizado!' : '✓ Setor salvo!', 'green');
    resetarFormSetor();
    carregarSetores();
  });
}

// Cascata Instituição → Bloco usada no formulário de cadastro de Setor (locais.html)
async function atualizarSelectBlocosCascataSetor() {
  const instId = $('setor-instituicao')?.value || '';
  await popularSelectBlocos(instId, 'setor-bloco');
}

// Cascata Instituição → Bloco usada no filtro de listagem de Setores (locais.html)
async function atualizarSelectBlocosCascataFiltroSetor() {
  const instId = $('filtro-setor-instituicao')?.value || '';
  await popularSelectBlocos(instId, 'filtro-setor-bloco');
  carregarSetores();
}

// ----- CRUD: Salas -----
let _salasCache = [];

// Fator climático de referência absoluta do sistema. Cuiabá-MT (zona bioclimática 5B/7,
// NBR 15220-3) é a cidade-base de calibração — fator = 1,00. Caso o sistema passe a atender
// unidades em outras cidades/regiões no futuro, basta adicionar entradas a este mapa e
// expor um campo de seleção de cidade no formulário de Sala (hoje fixo, sem campo na UI).
const FATOR_CLIMATICO_REGIAO = {
  'cuiaba-mt': 1.00, // referência absoluta — TBSm ≈ 26,7°C, zona bioclimática 5B
};
const CIDADE_REFERENCIA_PADRAO = 'cuiaba-mt';

// Fator de cobertura/isolamento térmico do ambiente. Ambientes com cobertura exposta ao sol
// (telhado/laje de topo) ganham mais calor por radiação que ambientes entre andares,
// que por sua vez têm troca térmica adicional pela proteção de pavimentos acima/abaixo.
const FATOR_COBERTURA = {
  entre_andares: 0.95, // protegido por lajes acima e abaixo — menor ganho térmico
  laje:          1.00, // referência — laje de cobertura sem exposição direta ao telhado
  telhado:       1.10, // cobertura exposta diretamente ao telhado — maior ganho por radiação
};

// Ganho térmico pelas janelas (envidraçamento). O vidro é a principal via de ganho solar:
// é quase transparente à radiação, então uma janela ensolarada ganha muito mais que uma à sombra.
// Coeficientes práticos (BTU/h por m² de vidro simples) conforme a exposição solar das janelas:
//   - à sombra / sem incidência direta: apenas condução + luz difusa
//   - sol da manhã (face leste): insolação moderada
//   - sol da tarde (face oeste): pior caso no clima 5B (Cuiabá/Rondonópolis-MT)
const BTU_JANELA_INCIDENCIA = {
  sem:   165, // vidro à sombra — condução + radiação difusa
  manha: 450, // sol da manhã (face leste)
  tarde: 700, // sol da tarde (face oeste) — pior caso
};
const AREA_JANELA_PADRAO_M2 = 1.2; // área média assumida por janela quando a área total não é informada

// Calcula a carga térmica estimada (BTU/h) de uma Sala, usando o método prático
// baseado em NBR 16401 / ASHRAE (referência conceitual; cálculo simplificado por
// ausência de dados climáticos horários completos por cidade):
//   Envoltória opaca: area_m2 × btu_m2_base (padrão 600 BTU/m²)
//     × Fator solar (paredes/cobertura): sem = 1,00 | manhã = 1,10 | tarde = 1,20
//     × Fator cobertura: entre andares = 0,95 | laje = 1,00 | telhado exposto = 1,10
//   + Ganhos internos (NÃO dependem do sol):
//     + 600 BTU por pessoa prevista
//     + 3,41 BTU por Watt de equipamentos do ambiente
//   + Ganho pelas janelas: área de vidro × coeficiente próprio conforme exposição solar
//     das janelas (sombra = 165 | manhã = 450 | tarde = 700 BTU/m²)
//   × Fator climático regional: Cuiabá-MT (referência absoluta) = 1,00
function calcularCargaTermicaBTU({ area_m2, pessoas_previstas, equip_watts, incidencia_solar, btu_m2_base, cobertura, num_janelas, area_janelas_m2, incidencia_janelas }) {
  const area     = parseFloat(area_m2) || 0;
  const pessoas  = parseInt(pessoas_previstas) || 0;
  const watts    = parseFloat(equip_watts) || 0;
  const baseM2   = parseFloat(btu_m2_base) || 600;
  const FATOR_SOLAR = { sem: 1.00, manha: 1.10, tarde: 1.20 };
  const fatorSolar     = FATOR_SOLAR[incidencia_solar] || 1.00;
  const fatorCobertura = FATOR_COBERTURA[cobertura] || 1.00;
  const fatorClimatico = FATOR_CLIMATICO_REGIAO[CIDADE_REFERENCIA_PADRAO];

  // Área de janelas: usa a área informada; se ausente, estima pela quantidade × área padrão.
  const qtdJanelas = parseInt(num_janelas) || 0;
  let areaJanelas  = parseFloat(area_janelas_m2) || 0;
  if (areaJanelas <= 0 && qtdJanelas > 0) areaJanelas = qtdJanelas * AREA_JANELA_PADRAO_M2;

  // Coeficiente do vidro conforme a exposição solar das janelas (a sensibilidade solar
  // do vidro já está embutida aqui — por isso o fatorSolar NÃO é reaplicado às janelas).
  const coefJanela = BTU_JANELA_INCIDENCIA[incidencia_janelas] ?? BTU_JANELA_INCIDENCIA.sem;

  // Envoltória opaca (paredes/laje/piso): sensível ao sol e à cobertura.
  const btuEnvoltoria = area * baseM2 * fatorSolar * fatorCobertura;
  // Ganhos internos: independem do sol.
  const btuPessoas = pessoas * 600;
  const btuEquip   = watts * 3.41;
  // Ganho pelas janelas: coeficiente próprio já embute a sensibilidade solar.
  const btuJanelas = areaJanelas * coefJanela;

  const total = (btuEnvoltoria + btuPessoas + btuEquip + btuJanelas) * fatorClimatico;
  return Math.round(total);
}

// ----- Validação de plausibilidade dos dados de carga térmica -----
// AUDITORIA 2026. calcularCargaTermicaBTU() aceitava qualquer entrada: área negativa
// produzia carga negativa, e um erro de digitação na área (300 em vez de 30) ou na
// ocupação virava dado oficial no PMOC sem nenhum aviso. A densidade resultante
// (BTU/h por m²) é o indicador que detecta esses casos: ambientes climatizados reais
// ficam entre ~400 e ~2.500 BTU/h·m² mesmo em clima 5B (Cuiabá-MT).
const CARGA_DENSIDADE_MIN = 400;   // BTU/h·m² — abaixo disto, provável área superestimada
const CARGA_DENSIDADE_MAX = 2500;  // BTU/h·m² — acima disto, provável área subestimada
const CARGA_AREA_MAX_M2   = 2000;  // m²  — acima disto, provável erro de digitação
const CARGA_PESSOAS_MAX   = 500;   // pessoas — acima disto, provável erro de digitação

// Retorna { erros: [], avisos: [] }. "erros" impedem o salvamento (dado impossível);
// "avisos" apenas alertam o usuário, que decide se confirma (dado improvável, mas legítimo).
function validarPlausibilidadeSala({ area_m2, pessoas_previstas, equip_watts, carga_termica_btu }) {
  const erros = [], avisos = [];
  const area    = parseFloat(area_m2) || 0;
  const pessoas = parseInt(pessoas_previstas) || 0;
  const watts   = parseFloat(equip_watts) || 0;
  const btu     = parseFloat(carga_termica_btu) || 0;

  if (area < 0)    erros.push('A área não pode ser negativa.');
  if (pessoas < 0) erros.push('A ocupação prevista não pode ser negativa.');
  if (watts < 0)   erros.push('A carga de equipamentos não pode ser negativa.');
  if (btu < 0)     erros.push('A carga térmica calculada ficou negativa — revise os valores informados.');

  if (area > CARGA_AREA_MAX_M2)
    avisos.push(`Área de ${area.toLocaleString('pt-BR')} m² é atípica para um ambiente climatizado — confira se não há erro de digitação.`);
  if (pessoas > CARGA_PESSOAS_MAX)
    avisos.push(`Ocupação de ${pessoas.toLocaleString('pt-BR')} pessoas é atípica — confira o valor.`);

  if (area > 0 && btu > 0) {
    const dens = btu / area;
    if (dens > CARGA_DENSIDADE_MAX)
      avisos.push(`Densidade de ${Math.round(dens).toLocaleString('pt-BR')} BTU/h·m² acima da faixa técnica usual (até ${CARGA_DENSIDADE_MAX.toLocaleString('pt-BR')}). Verifique se a área está subestimada ou se a ocupação/carga de equipamentos está superestimada.`);
    else if (dens < CARGA_DENSIDADE_MIN)
      avisos.push(`Densidade de ${Math.round(dens).toLocaleString('pt-BR')} BTU/h·m² abaixo da faixa técnica usual (a partir de ${CARGA_DENSIDADE_MIN.toLocaleString('pt-BR')}). Verifique se a área não foi informada em excesso.`);
  }
  if (area <= 0 && btu > 0)
    avisos.push('Área não informada: a carga foi calculada sem o componente de envoltória e o ambiente será excluído do indicador de adequação térmica no PMOC.');

  return { erros, avisos };
}

// ----- Lista de equipamentos por Sala (carga interna com fator de uso) -----
// Cada item: { nome, potencia, quantidade, fator_uso }. A carga efetiva de um item é
// potencia × quantidade × fator_uso, e a soma alimenta o campo equip_watts do cálculo de BTU.
let _salaEquipCarga = [];

// Parsing defensivo: a coluna equipamentos_carga é jsonb, mas normaliza também string/valores vazios.
function parseEquipCarga(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

// Carga efetiva de um único item (W)
function wattsEfetivosItem(it) {
  const pot = parseFloat(it?.potencia) || 0;
  const qtd = parseInt(it?.quantidade) || 0;
  let fator = parseFloat(it?.fator_uso);
  if (!isFinite(fator)) fator = 1;
  fator = Math.max(0, Math.min(1, fator)); // limita entre 0 e 1
  return pot * qtd * fator;
}

// Soma da carga interna efetiva de todos os itens; atualiza o hidden equip_watts e o total exibido.
function calcularWattsEfetivosSala() {
  const total = _salaEquipCarga.reduce((s, it) => s + wattsEfetivosItem(it), 0);
  const hidden = $('sala-equip-watts'); if (hidden) hidden.value = Math.round(total);
  const lbl = $('sala-equip-total'); if (lbl) lbl.textContent = `${Math.round(total).toLocaleString('pt-BR')} W`;
  return total;
}

// Renderiza as linhas da lista de equipamentos no formulário de Sala.
function renderSalaEquipCarga() {
  const tbody = $('tbody-sala-equip'); if (!tbody) return;
  if (!_salaEquipCarga.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="td-loading">Nenhum equipamento informado.</td></tr>';
    calcularWattsEfetivosSala();
    return;
  }
  tbody.innerHTML = _salaEquipCarga.map((it, i) => `
    <tr>
      <td><input type="text" value="${escapeHTML(it.nome || '')}" placeholder="Ex: Computador" style="width:100%;" oninput="atualizarSalaEquipLinha(${i},'nome',this.value)"></td>
      <td><input type="number" step="1" min="0" value="${it.potencia ?? ''}" placeholder="Ex: 200" style="width:100%;" oninput="atualizarSalaEquipLinha(${i},'potencia',this.value)"></td>
      <td><input type="number" step="1" min="0" value="${it.quantidade ?? 1}" style="width:100%;" oninput="atualizarSalaEquipLinha(${i},'quantidade',this.value)"></td>
      <td><input type="number" step="0.05" min="0" max="1" value="${it.fator_uso ?? 1}" style="width:100%;" oninput="atualizarSalaEquipLinha(${i},'fator_uso',this.value)"></td>
      <td style="text-align:right;font-weight:600;color:#0369a1;">${Math.round(wattsEfetivosItem(it)).toLocaleString('pt-BR')}</td>
      <td style="text-align:center;"><button type="button" class="btn-excluir" onclick="removerSalaEquipLinha(${i})">✕</button></td>
    </tr>`).join('');
  calcularWattsEfetivosSala();
}

function adicionarSalaEquipLinha() {
  _salaEquipCarga.push({ nome: '', potencia: '', quantidade: 1, fator_uso: 1 });
  renderSalaEquipCarga();
}

function removerSalaEquipLinha(idx) {
  _salaEquipCarga.splice(idx, 1);
  renderSalaEquipCarga();
  atualizarPreviaCargaTermicaSala();
}

// Atualiza um campo de um item sem re-renderizar toda a tabela (preserva o foco no input),
// recalculando apenas o efetivo da linha, o total e a prévia de carga térmica.
function atualizarSalaEquipLinha(idx, campo, valor) {
  if (!_salaEquipCarga[idx]) return;
  _salaEquipCarga[idx][campo] = valor;
  // Atualiza a célula "Efetivo" da própria linha sem recriar os inputs
  const tbody = $('tbody-sala-equip');
  const linha = tbody?.querySelectorAll('tr')[idx];
  const cel = linha?.children?.[4];
  if (cel) cel.textContent = Math.round(wattsEfetivosItem(_salaEquipCarga[idx])).toLocaleString('pt-BR');
  calcularWattsEfetivosSala();
  atualizarPreviaCargaTermicaSala();
}

async function carregarSalas() {
  const tbody = $('tbody-salas'); if (!tbody) return;
  const filtroSetor = $('filtro-sala-setor')?.value || '';
  let query = db.from('salas').select('*, setores(nome, blocos(nome, instituicoes(nome)))').order('nome', { ascending: true });
  if (filtroSetor) query = query.eq('setor_id', filtroSetor);
  const { data: salas } = await fetchAll(() => query);
  _salasCache = salas || [];
  const countMap = await contarEquipamentosPorLocal('sala');   // T4.4
  tbody.innerHTML = _salasCache.length ? _salasCache.map(s => {
    const nJan = parseInt(s.num_janelas) || 0;
    const nEquip = parseEquipCarga(s.equipamentos_carga).length;
    const tipoInfo = TIPOS_AMBIENTE_SALA.find(t => t.value === s.tipo_ambiente);
    const exaust   = obterExigenciaExaustaoSala(s);
    const infos = [];
    if (tipoInfo)   infos.push(`🏷️ ${escapeHTML(tipoInfo.label)}`);
    if (exaust.exige === true) infos.push(`💨 <strong style="color:#c2410c;">exige exaustão</strong>`);
    if (nJan > 0)   infos.push(`🪟 ${nJan} janela${nJan > 1 ? 's' : ''}`);
    if (nEquip > 0) infos.push(`💡 ${nEquip} equip.`);
    const sub = infos.length ? `<br><small style="color:#a0aec0;">${infos.join(' · ')}</small>` : '';
    return `<tr>
      <td><strong>${escapeHTML(s.nome)}</strong>${sub}</td>
      <td>${escapeHTML(s.setores?.nome)} <span style="color:#a0aec0;">(${escapeHTML(s.setores?.blocos?.nome)})</span></td>
      <td style="text-align:center;">${s.carga_termica_btu ? `<span class="tag-badge">${Number(s.carga_termica_btu).toLocaleString('pt-BR')} BTU/h</span>` : '<span style="color:#a0aec0;">—</span>'}</td>
      <td style="text-align:center;"><span class="tag-badge">${countMap[s.id] || 0}</span></td>
      <td style="display:flex;gap:4px;">
        <button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="editarSala('${s.id}')">✏️ Editar</button>
        <button class="btn-excluir" onclick="excluirSala('${s.id}')">✕</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="td-loading">Sem registros.</td></tr>';
}

function editarSala(id) {
  const s = _salasCache.find(x => x.id === id); if (!s) return;
  $('sala-id-edicao').value = s.id;
  $('sala-setor').value = s.setor_id || '';
  $('sala-nome').value = s.nome || '';
  if ($('sala-area'))      $('sala-area').value      = s.area_m2 ?? '';
  if ($('sala-pessoas'))   $('sala-pessoas').value    = s.pessoas_previstas ?? 0;
  if ($('sala-incidencia-solar')) $('sala-incidencia-solar').value = s.incidencia_solar || 'sem';
  if ($('sala-cobertura')) $('sala-cobertura').value = s.cobertura || 'laje';
  if ($('sala-btu-m2-base')) $('sala-btu-m2-base').value = s.btu_m2_base ?? 600;
  if ($('sala-num-janelas')) $('sala-num-janelas').value = s.num_janelas ?? 0;
  if ($('sala-area-janelas')) $('sala-area-janelas').value = s.area_janelas_m2 ?? 0;
  if ($('sala-incidencia-janelas')) $('sala-incidencia-janelas').value = s.incidencia_janelas || 'sem';
  if ($('sala-tipo-ambiente')) $('sala-tipo-ambiente').value = s.tipo_ambiente || '';
  if ($('sala-exige-exaustao')) $('sala-exige-exaustao').value = s.exige_exaustao || '';
  atualizarDicaExaustaoSala();

  // Lista de equipamentos: usa equipamentos_carga se existir; caso contrário, migra o valor
  // antigo de equip_watts para um único item genérico (compatibilidade retroativa).
  _salaEquipCarga = parseEquipCarga(s.equipamentos_carga);
  if (!_salaEquipCarga.length && (parseFloat(s.equip_watts) || 0) > 0) {
    _salaEquipCarga = [{ nome: 'Equipamentos diversos', potencia: parseFloat(s.equip_watts), quantidade: 1, fator_uso: 1 }];
  }
  renderSalaEquipCarga();
  atualizarPreviaCargaTermicaSala();
  $('btn-salvar-sala').textContent = '💾 Atualizar Sala';
  $('btn-cancelar-sala').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetarFormSala() {
  $('sala-id-edicao').value = '';
  $('sala-setor').value = '';
  $('sala-nome').value = '';
  if ($('sala-area'))      $('sala-area').value      = '';
  if ($('sala-pessoas'))   $('sala-pessoas').value    = 0;
  if ($('sala-equip-watts')) $('sala-equip-watts').value = 0;
  if ($('sala-incidencia-solar')) $('sala-incidencia-solar').value = 'sem';
  if ($('sala-cobertura')) $('sala-cobertura').value = 'laje';
  if ($('sala-btu-m2-base')) $('sala-btu-m2-base').value = 600;
  if ($('sala-num-janelas')) $('sala-num-janelas').value = 0;
  if ($('sala-area-janelas')) $('sala-area-janelas').value = 0;
  if ($('sala-incidencia-janelas')) $('sala-incidencia-janelas').value = 'sem';
  if ($('sala-tipo-ambiente')) $('sala-tipo-ambiente').value = '';
  if ($('sala-exige-exaustao')) $('sala-exige-exaustao').value = '';
  atualizarDicaExaustaoSala();
  _salaEquipCarga = [];
  renderSalaEquipCarga();
  atualizarPreviaCargaTermicaSala();
  $('btn-salvar-sala').textContent = '💾 Salvar Sala';
  $('btn-cancelar-sala').style.display = 'none';
}

// Atualiza, em tempo real, a dica exibida sob o campo "Exaustão mecânica" no formulário de Sala
// (locais.html). Mostra exatamente o que valerá para os relatórios: a decisão explícita do gestor
// quando informada, ou a regra herdada do Tipo de Ambiente selecionado.
function atualizarDicaExaustaoSala() {
  const el = $('sala-exaustao-dica'); if (!el) return;
  const r = obterExigenciaExaustaoSala({
    tipo_ambiente:  $('sala-tipo-ambiente')?.value  || null,
    exige_exaustao: $('sala-exige-exaustao')?.value || null,
  });
  if (r.exige === true) {
    el.style.color = '#c2410c';
    el.innerHTML = `💨 <strong>Exige exaustão mecânica.</strong> ${escapeHTML(r.motivo)}${r.origem === 'tipo' ? ' <em>(herdado do Tipo de Ambiente)</em>' : ''}`;
  } else if (r.exige === false) {
    el.style.color = '#718096';
    el.innerHTML = `✓ Não exige exaustão mecânica. ${escapeHTML(r.motivo)}`;
  } else {
    el.style.color = '#a0aec0';
    el.innerHTML = 'Selecione o Tipo de Ambiente ou informe a exigência manualmente para que a sala entre no relatório de Conformidade de Exaustão.';
  }
}

// Recalcula e exibe em tempo real a prévia da carga térmica no formulário de Sala (locais.html)
function atualizarPreviaCargaTermicaSala() {
  const el = $('sala-carga-termica-previa'); if (!el) return;
  const btu = calcularCargaTermicaBTU({
    area_m2:           $('sala-area')?.value,
    pessoas_previstas: $('sala-pessoas')?.value,
    equip_watts:       $('sala-equip-watts')?.value,
    incidencia_solar:  $('sala-incidencia-solar')?.value,
    btu_m2_base:        $('sala-btu-m2-base')?.value,
    cobertura:          $('sala-cobertura')?.value,
    num_janelas:        $('sala-num-janelas')?.value,
    area_janelas_m2:    $('sala-area-janelas')?.value,
    incidencia_janelas: $('sala-incidencia-janelas')?.value,
  });
  el.textContent = btu > 0 ? `${btu.toLocaleString('pt-BR')} BTU/h` : '—';
}

async function excluirSala(id) {
  if (!confirm('Remover esta Sala? Só será possível se não houver Ativos vinculados a ela.')) return;
  const { error } = await db.from('salas').delete().eq('id', id);
  if (error) { toast('Não foi possível remover: ' + error.message, 'erro'); return; }
  carregarSalas();
}

if ($('btn-salvar-sala')) {
  $('btn-salvar-sala').addEventListener('click', async () => {
    const setor_id = $('sala-setor')?.value;
    const nome = $('sala-nome')?.value.trim();
    if (!setor_id || !nome) { msgForm('msg-sala', 'Selecione o Setor e informe o nome da Sala.', 'red'); return; }
    msgForm('msg-sala', 'Salvando...', 'blue');
    const area_m2           = $('sala-area')?.value ? parseFloat($('sala-area').value) : null;
    const pessoas_previstas = parseInt($('sala-pessoas')?.value) || 0;
    const incidencia_solar  = $('sala-incidencia-solar')?.value || 'sem';
    const cobertura          = $('sala-cobertura')?.value || 'laje';
    const btu_m2_base       = parseFloat($('sala-btu-m2-base')?.value) || 600;
    const num_janelas       = parseInt($('sala-num-janelas')?.value) || 0;
    const area_janelas_m2   = parseFloat($('sala-area-janelas')?.value) || 0;
    const incidencia_janelas = $('sala-incidencia-janelas')?.value || 'sem';
    const tipo_ambiente      = $('sala-tipo-ambiente')?.value || null;
    // Exaustão mecânica: '' = herda a regra do Tipo de Ambiente (grava NULL); 'sim'/'nao' = decisão
    // explícita do gestor, que sempre prevalece sobre a sugestão do tipo.
    const exige_exaustao     = $('sala-exige-exaustao')?.value || null;

    // Normaliza a lista de equipamentos e recalcula a carga interna efetiva (equip_watts).
    const equipamentos_carga = _salaEquipCarga
      .map(it => ({
        nome:       (it.nome || '').trim(),
        potencia:   parseFloat(it.potencia) || 0,
        quantidade: parseInt(it.quantidade) || 0,
        fator_uso:  Math.max(0, Math.min(1, isFinite(parseFloat(it.fator_uso)) ? parseFloat(it.fator_uso) : 1)),
      }))
      .filter(it => it.potencia > 0 && it.quantidade > 0);
    const equip_watts = Math.round(equipamentos_carga.reduce((s, it) => s + wattsEfetivosItem(it), 0));

    const carga_termica_btu = calcularCargaTermicaBTU({ area_m2, pessoas_previstas, equip_watts, incidencia_solar, btu_m2_base, cobertura, num_janelas, area_janelas_m2, incidencia_janelas });

    // Barreira de plausibilidade: a carga térmica alimenta a Seção 5.4 do PMOC e o
    // relatório de divergência. Dado impossível é bloqueado; dado improvável exige
    // confirmação explícita do usuário antes de virar registro oficial.
    const { erros, avisos } = validarPlausibilidadeSala({ area_m2, pessoas_previstas, equip_watts, carga_termica_btu });
    if (erros.length) { msgForm('msg-sala', erros.join(' '), 'red'); return; }
    if (avisos.length && !confirm('Verifique os pontos abaixo antes de salvar:\n\n• ' + avisos.join('\n\n• ') + '\n\nDeseja salvar assim mesmo?')) {
      msgForm('msg-sala', 'Salvamento cancelado — revise os dados do ambiente.', 'red');
      return;
    }

    const payload = { setor_id, nome, area_m2, pessoas_previstas, equip_watts, incidencia_solar, cobertura, btu_m2_base, num_janelas, area_janelas_m2, incidencia_janelas, tipo_ambiente, exige_exaustao, equipamentos_carga, carga_termica_btu };
    const idEd = $('sala-id-edicao')?.value;
    const { error } = idEd
      ? await db.from('salas').update(payload).eq('id', idEd)
      : await db.from('salas').insert([payload]);
    if (error) { msgForm('msg-sala', 'Erro: ' + error.message, 'red'); return; }
    msgForm('msg-sala', idEd ? '✓ Sala atualizada!' : '✓ Sala salva!', 'green');
    resetarFormSala();
    carregarSalas();
  });
}

// Cascata Instituição → Bloco → Setor usada no formulário de cadastro de Sala (locais.html)
async function atualizarSelectBlocosCascataSala() {
  const instId = $('sala-instituicao')?.value || '';
  await popularSelectBlocos(instId, 'sala-bloco');
  await popularSelectSetores('', 'sala-setor');
}
async function atualizarSelectSetoresCascataSala() {
  const blocoId = $('sala-bloco')?.value || '';
  await popularSelectSetores(blocoId, 'sala-setor');
}

// Cascata Instituição → Bloco → Setor usada no filtro de listagem de Salas (locais.html)
async function atualizarSelectBlocosCascataFiltroSala() {
  const instId = $('filtro-sala-instituicao')?.value || '';
  await popularSelectBlocos(instId, 'filtro-sala-bloco');
  await popularSelectSetores('', 'filtro-sala-setor');
  carregarSalas();
}
async function atualizarSelectSetoresCascataFiltroSala() {
  const blocoId = $('filtro-sala-bloco')?.value || '';
  await popularSelectSetores(blocoId, 'filtro-sala-setor');
  carregarSalas();
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
// Valores do select #eq-instalacao-ac (Novo Ativo) que caracterizam sistema de água aberto —
// usados no memorial descritivo e no plano de atividades do Plano PMOC para aplicar/dispensar
// itens do checklist ligados a controle microbiológico de água (torre de resfriamento,
// condensador evaporativo, chiller com circuito de água), conforme ABNT NBR 17037 e NBR 16824.
const AC_INSTALACOES_AGUA_ABERTA = ['Água Gelada (Chiller)', 'Torre de Resfriamento/Condensador Evaporativo'];

// Valores do select #eq-instalacao-ac que caracterizam sistema centralizado/de maior porte com
// TRANSMISSÃO POR CORREIAS/POLIAS (dutado, self-contained, chiller, torre de resfriamento).
// Usado exclusivamente para o item MEC-03 (correias e polias), inexistente em equipamentos de
// transmissão direta. NÃO deve ser usado para determinar aplicabilidade de rotinas de dutos e
// plenum — ver AC_INSTALACOES_COM_PLENUM.
const AC_INSTALACOES_PORTE_MAIOR = ['Split Duto', 'Self-Contained', 'VRF', 'Água Gelada (Chiller)', 'Torre de Resfriamento/Condensador Evaporativo'];

// Valores do select #eq-instalacao-ac que possuem COMPONENTES DE TRATAMENTO E DISTRIBUIÇÃO DE AR
// (caixa de plenum, rede de dutos, bocas de ar remotas) e, portanto, estão sujeitos às rotinas
// da série DUT.
//
// NOTA TÉCNICA (auditoria 2026): a unidade tipo CASSETE integra esta lista. Por construção, possui
// caixa de plenum de retorno instalada acima do forro (sob pressão negativa), difusor multidirecional
// de insuflamento (tipicamente 4 vias), bandeja de condensado permanentemente úmida e, na
// generalidade dos modelos comerciais, flange pré-perfurada para admissão de ar exterior. Tratá-la
// como "split individual sem dutos" excluía indevidamente o principal sítio de formação de biofilme
// do parque do escopo de inspeção e higienização, em desacordo com o item 5 do Anexo I da
// Portaria MS nº 3.523/1998. O mesmo se aplica a unidades comerciais de maior porte (ex.: linha
// airCore, 58.000 BTU/h ≈ 17 kW), cuja vazão de ar (~2.900 a 3.400 m³/h) é incompatível com
// distribuição por difusor único respeitando o limite de 0,20 m/s da ABNT NBR 17037 (5.2.3).
const AC_INSTALACOES_COM_PLENUM = ['Split Cassete', 'Split Duto', 'Self-Contained', 'VRF', 'Água Gelada (Chiller)', 'Torre de Resfriamento/Condensador Evaporativo'];

// Mapa de itens do checklist PMOC (categoria AC) cuja aplicabilidade depende do tipo de
// instalação cadastrado no parque de equipamentos. Chaves idênticas às de CHECKLIST_PMOC_DEFS.AC.
// Valores:
//   'agua_aberta' — só se aplica quando há sistema de água aberto (torre/chiller/cond. evaporativo);
//   'plenum'      — só se aplica a sistemas com plenum, dutos ou bocas de ar remotas;
//   'porte_maior' — só se aplica a sistemas com transmissão por correias/polias.
//
// NOTA TÉCNICA (auditoria 2026): DUT-03 e DUT-05 foram tornados INCONDICIONAIS.
//   • DUT-03 passou a cobrir o isolamento térmico das LINHAS FRIGORÍGENAS (entreforro, prumadas
//     e trechos externos), presente em toda instalação de expansão direta.
//   • DUT-05 verifica a EXISTÊNCIA e a vazão efetiva de tomada de ar exterior. A ausência de
//     renovação de ar em ambiente de ocupação permanente NÃO é hipótese de inaplicabilidade —
//     é NÃO CONFORMIDADE DE PROJETO (Portaria MS nº 3.523/1998; ABNT NBR 17037). Marcar
//     "NA" neutralizava documentalmente o achado mais relevante do parque.
const CHECKLIST_ITEM_CONDICIONAL = {
  bio_04: 'agua_aberta',
  dut_01: 'plenum',
  dut_02: 'plenum',
  dut_04: 'plenum',
  mec_03: 'porte_maior',
};

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
      ['dut_01', '[DUT-01] Dutos, Caixas de Plenum e Câmaras de Mistura — Sujidade, Umidade, Danos e Corrosão'],
      ['dut_02', '[DUT-02] Vedação de Portas de Inspeção, Conexões e Interface Plenum/Entreforro'],
      ['dut_03', '[DUT-03] Isolamento Térmico de Dutos, Plenums e Linhas Frigorígenas — Integridade e Condensação'],
      ['dut_04', '[DUT-04] Bocas de Ar e Difusores (Insuflamento/Retorno) — Sujidade, Fixação e Medição de Vazão'],
      ['dut_05', '[DUT-05] Tomada de Ar Exterior, Registros (Dampers) e Automação VRF — Existência, Vazão e Funcionamento'],
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

// Guia de execução dos itens de verificação (Anexo POP-PMOC-001 do Plano PMOC).
// Keyed identicamente a CHECKLIST_PMOC_DEFS (mesmas chaves, cross-validadas contra os 79 itens).
// Cada entrada: exec (como executar), c/nc/na (critérios objetivos de avaliação),
// ferramenta e seguranca (opcionais). Fonte única — usada apenas pelo Plano PMOC (documento).
const CHECKLIST_EXECUCAO_GUIA = {
  // ── AC — mensal ──
  bio_01: { exec: 'Remover a bandeja, retirar resíduos e biofilme com escova/pano, lavar com solução sanitizante compatível (ex.: quaternário de amônio) e reinstalar verificando o escoamento livre.', c: 'Bandeja limpa, sem biofilme, sanitizante aplicado e escoamento livre.', nc: 'Presença de sujidade, lodo, mau odor ou escoamento obstruído.', na: 'Equipamento sem bandeja de condensados no momento da vistoria.', ferramenta: 'Escova de cerdas macias, pano, sanitizante próprio para superfícies', seguranca: 'Desligar o equipamento antes de manusear componentes internos.' },
  bio_02: { exec: 'Verificar mangueira/tubulação de dreno quanto a dobras, sujeira ou obstrução; testar o escoamento despejando água na bandeja e observando o fluxo até a saída.', c: 'Escoamento livre e contínuo, sem retenção de água.', nc: 'Dreno obstruído, com retorno de água ou vazamento na conexão.', na: 'Sistema sem geração relevante de condensado — registrar justificativa.' },
  fil_01: { exec: 'Remover o(s) filtro(s), avaliar o grau de sujidade, lavar (quando lavável) ou substituir por filtro de mesma classe de eficiência, e reinstalar corretamente.', c: 'Filtro limpo/substituído, sem rasgos, bem vedado na moldura.', nc: 'Filtro saturado, rasgado, mal vedado ou ausente.', na: 'Equipamento sem filtro de ar próprio.' },
  mec_01: { exec: 'Ligar o equipamento e ouvir ruídos anormais (atrito, folga); verificar coxins de borracha/antivibratórios e reapertar parafusos/fixadores do motoventilador.', c: 'Funcionamento silencioso, coxins íntegros, fixação firme.', nc: 'Ruído anormal, vibração excessiva, coxim rompido ou fixador solto.', na: '—' },
  // ── AC — trimestral ──
  amb_01: { exec: 'Inspecionar visualmente o ambiente quanto a acúmulo de poeira/sujidade nas grelhas e superfícies, identificar odores anormais e possíveis fontes de ruído do sistema.', c: 'Ambiente limpo, sem odores anormais e sem ruído perceptível do sistema.', nc: 'Sujidade visível, odor desagradável ou ruído incômodo identificado.', na: '—' },
  amb_02: { exec: 'Verificar manchas de umidade/infiltração em paredes e teto próximos ao equipamento, e checar se há produtos químicos voláteis armazenados no ambiente climatizado.', c: 'Sem sinais de infiltração e sem armazenagem inadequada de produtos químicos.', nc: 'Infiltração identificada ou produtos químicos voláteis próximos à captação de ar.', na: '—' },
  amb_03: { exec: 'Identificar possíveis fontes de radiação (equipamentos eletrônicos, impressoras a laser) ou outros riscos à QAI próximos à tomada de ar do sistema.', c: 'Nenhuma fonte de risco relevante identificada próxima à captação de ar.', nc: 'Fonte de risco identificada — registrar e comunicar ao responsável pelo ambiente.', na: '—' },
  amb_04: { exec: 'Avaliar de forma geral a limpeza, conservação de forros, piso e mobiliário do ambiente climatizado.', c: 'Ambiente em boas condições gerais de limpeza e conservação.', nc: 'Condições inadequadas identificadas — registrar detalhes.', na: '—' },
  bio_03: { exec: 'Aplicar produto de limpeza específico para serpentinas (alcalino ou neutro conforme material), deixar agir e enxaguar com água a baixa pressão, sem danificar as aletas.', c: 'Serpentina visualmente limpa, aletas alinhadas, sem obstrução por sujidade.', nc: 'Serpentina suja/obstruída, aletas amassadas ou com corrosão visível.', na: '—', ferramenta: 'Produto de limpeza para serpentinas, pente de aletas, EPI (luvas, óculos)', seguranca: 'Usar EPI ao manusear produto químico; desligar o equipamento.' },
  ele_01: { exec: 'Medir corrente elétrica (amperímetro) e tensão de alimentação dos compressores e motores em operação, comparando com os valores nominais de placa.', c: 'Valores medidos dentro da faixa nominal (±10%).', nc: 'Valores fora da faixa nominal — investigar causa (sobrecarga, desbalanceamento de fase).', na: '—', ferramenta: 'Alicate amperímetro / multímetro', seguranca: 'Medição com equipamento energizado — usar EPI adequado e seguir a NR-10.' },
  ele_02: { exec: 'Com o equipamento desenergizado, reapertar todos os parafusos de bornes de comando e potência no painel elétrico.', c: 'Todos os bornes firmes, sem sinais de superaquecimento (oxidação/enegrecimento).', nc: 'Borne solto, oxidado ou com marca de superaquecimento.', na: '—', seguranca: 'Bloquear e sinalizar (LOTO) antes de qualquer intervenção elétrica.' },
  fil_02: { exec: 'Medir a diferença de pressão antes/depois do filtro com manômetro diferencial e comparar com o limite de saturação do fabricante.', c: 'ΔP dentro do limite recomendado pelo fabricante.', nc: 'ΔP acima do limite — indicativo de filtro saturado, providenciar troca.', na: 'Sistema sem ponto de medição de pressão diferencial instalado.', ferramenta: 'Manômetro diferencial' },
  mec_02: { exec: 'Aplicar graxa/óleo lubrificante nos pontos de lubrificação do motoventilador conforme especificação do fabricante.', c: 'Pontos lubrificados, sem ruído de atrito seco.', nc: 'Ponto de lubrificação sem graxa/óleo ou ruído de atrito identificado.', na: 'Rolamentos selados/sem ponto de lubrificação (motor blindado).' },
  // ── AC — semestral ──
  bio_04: { exec: 'Coletar amostra de água do sistema (torre de resfriamento/condensador evaporativo/água gelada) em frasco estéril, seguindo protocolo do laboratório, e enviar para análise microbiológica (Legionella e contagem bacteriana).', c: 'Amostra coletada e enviada dentro do prazo, resultado compatível com o histórico de análises do local. A ABNT NBR 17037 (5.1) não fixa VMA pré-determinado para contaminação microbiológica em água e biofilme de bandeja/serpentina — a avaliação é feita contra o histórico. Para legionelose, aplicar a ABNT NBR 16824.', nc: 'Resultado fora dos limites — acionar tratamento biocida e nova coleta de confirmação.', na: 'Sistema não possui circuito de água aberto.', ferramenta: 'Frasco estéril de coleta, EPI' },
  dut_01: { exec: 'Abrir portas de inspeção ou remover o painel/grelha frontal e inspecionar o interior da rede de dutos, da CAIXA DE PLENUM DE RETORNO das unidades Cassete (acima do forro), do plenum de insuflamento de unidades dutadas/VRF e da câmara de mistura de ar exterior, quando existente. Verificar deposição de particulado, fibras do forro aspiradas para o plenum, manchas de umidade, colônias visíveis, danos mecânicos e corrosão. Conferir a bandeja de condensado quanto a lâmina d\'água estagnada. Registro fotográfico obrigatório de cada plenum inspecionado.', c: 'Superfícies internas isentas de deposição significativa, sem umidade estagnada, sem colônias visíveis, sem dano estrutural ou corrosão relevante.', nc: 'Deposição de particulado, presença de fibras, umidade ou manchas de proliferação microbiológica, dano estrutural ou corrosão. Executar higienização completa com saneante regularizado e corrigir a causa da umidade.', na: 'Exclusivamente para Split Hi-Wall, Piso-Teto, Janeleiro ou Portátil, sem plenum e sem rede de dutos — registrar a justificativa. NÃO se aplica a Cassete, que possui plenum de retorno integrado.', ferramenta: 'Lanterna, câmera fotográfica, saneante regularizado na ANVISA, EPI', seguranca: 'Desenergizar o equipamento; usar EPI respiratório ao inspecionar plenum com deposição.' },
  dut_02: { exec: 'Verificar a integridade de gaxetas, fitas de vedação e fixadores das portas e alçapões de inspeção, das juntas e conexões dos trechos de duto e das passagens de tubulação/cabos. Testar a ESTANQUEIDADE DA CAIXA DE PLENUM DE RETORNO DAS UNIDADES CASSETE contra o entreforro, identificando aspiração de ar não filtrado proveniente do plenum de forro.', c: 'Vedações íntegras; ausência de infiltração de ar não filtrado; plenum de retorno estanque em relação ao entreforro.', nc: 'Gaxeta rompida, folga em porta de inspeção, junta desconectada ou aspiração de ar do entreforro. Refazer a vedação e reinspecionar. NOTA: a vedação deficiente converte o entreforro em via de admissão de ar não filtrado, arrastando poeira e fibras minerais do forro diretamente para a serpentina — compromete a QAI mesmo com filtragem conforme.', na: 'Exclusivamente para equipamentos sem portas de inspeção e sem plenum (Hi-Wall, Piso-Teto, Janeleiro, Portátil) — registrar a justificativa.' },
  dut_03: { exec: 'Inspecionar o isolamento térmico externo de dutos e plenums E o isolamento das LINHAS FRIGORÍGENAS de líquido e sucção (trechos de entreforro, prumadas, shafts e áreas externas), além das linhas de dreno em ambiente climatizado. Verificar rasgos, descolamento, ausência de trechos, encharcamento, ressecamento por UV e condensação superficial. Reparar ou substituir o trecho comprometido.', c: 'Isolamento íntegro e contínuo, seco, sem condensação superficial em qualquer trecho.', nc: 'Trecho ausente, rasgado, descolado, encharcado ou com condensação. Substituir o trecho e investigar sobrecarga térmica local. NOTA: em VRF, a linha de sucção descoberta em entreforro é a causa mais frequente de gotejamento e mancha de umidade em forro atribuídos erroneamente a vazamento de dreno.', na: 'Somente para linhas em ambiente não climatizado sem previsão de isolamento em projeto — registrar a justificativa.' },
  dut_04: { exec: 'Limpar a face, o núcleo e as aletas direcionais dos difusores multidirecionais (4 vias) das unidades Cassete, difusores lineares, grelhas de retorno e bocas de sistemas dutados/VRF. Verificar fixação, alinhamento e livre movimentação das aletas motorizadas. MEDIR A VAZÃO DE AR POR BOCA com anemômetro de fio quente ou balômetro e comparar com a vazão nominal do fabricante ou de projeto. Verificar a velocidade resultante na zona de ocupação.', c: 'Bocas limpas e bem fixadas; aletas com movimentação livre; vazão medida dentro de ±10% do valor nominal ou de projeto; velocidade na zona de ocupação ≤ 0,20 m/s (ABNT NBR 17037, 5.2.3).', nc: 'Sujidade acumulada, fixação solta, aleta travada, vazão fora da tolerância de ±10% ou velocidade acima de 0,20 m/s na zona de ocupação. Limpar, rebalancear e investigar causa (filtro colmatado, serpentina obstruída, ventilador degradado, obstrução de duto/plenum).', na: 'Exclusivamente para equipamentos com insuflamento e retorno diretos na face do gabinete (Hi-Wall, Piso-Teto, Janeleiro, Portátil) — registrar a justificativa.', ferramenta: 'Anemômetro de fio quente ou balômetro (capture hood) com certificado de calibração vigente' },
  dut_05: { exec: '1) VERIFICAR A EXISTÊNCIA de tomada de ar exterior no ambiente; nas unidades Cassete, conferir se a flange de ar exterior está ativada, obturada ou desconectada. 2) Inspecionar e desobstruir a captação (folhas, ninhos, insetos, tela colmatada, vegetação) e verificar o afastamento em relação a descargas de exaustão e fontes de contaminação. 3) MEDIR A VAZÃO EFETIVA DE AR EXTERIOR por anemometria e confrontar com o requerido (mínimo 27 m³/h·pessoa — Portaria MS nº 3.523/1998; valor superior pela NBR 16401-3 Nível 2 em setores assistenciais). 4) Testar movimentação e posicionamento de todos os dampers manuais e motorizados, atuadores e fins de curso. 5) AUTOMAÇÃO VRF: verificar comunicação da rede de controle e integridade da controladora, conferir parametrização de setpoints, limites e agendamento, extrair e analisar o histórico de alarmes e códigos de erro das unidades externas, e testar o intertravamento entre climatização e exaustão.', c: 'Tomada de ar exterior existente, desobstruída e com vazão medida igual ou superior à requerida; dampers com movimentação livre e posicionamento correto; automação operante, parametrizada e sem alarmes ativos ou recorrentes.', nc: 'Captação obstruída, mal posicionada ou com vazão inferior à requerida; damper travado, atuador inoperante ou flange de ar exterior obturada; falha de comunicação, parametrização incorreta ou alarmes recorrentes. ATENÇÃO — DEFICIÊNCIA DE PROJETO: a INEXISTÊNCIA de tomada de ar exterior em ambiente de ocupação permanente deve ser registrada como NC (vedada a marcação NA), com abertura de O.S. de adequação e submissão do ambiente ao Plano de Ação e Contingência da Seção 7 do Plano PMOC.', na: 'Exclusivamente para ambientes SEM OCUPAÇÃO PERMANENTE (depósitos, casas de máquinas, salas técnicas não ocupadas) e sem damper instalado — registrar a justificativa. É VEDADO marcar NA por ausência de tomada de ar exterior em ambiente ocupado: essa hipótese é NC.', ferramenta: 'Anemômetro calibrado, interface/controladora do sistema VRF, lanterna' },
  ele_03: { exec: 'Medir a resistência de isolamento entre enrolamentos e carcaça dos motores com megôhmetro, com o motor desenergizado.', c: 'Resistência de isolamento acima de 1 MΩ (ou valor mínimo do fabricante).', nc: 'Resistência abaixo do mínimo — risco de falha elétrica, motor deve ser avaliado.', na: '—', ferramenta: 'Megôhmetro', seguranca: 'Motor totalmente desenergizado e descarregado antes do teste.' },
  ele_04: { exec: 'Testar a atuação dos pressostatos de alta/baixa pressão e termostatos de segurança, simulando condição de disparo quando possível.', c: 'Dispositivos atuam corretamente dentro do setpoint especificado.', nc: 'Dispositivo não atua, atua fora do setpoint ou está bypassado.', na: '—' },
  ins_01: { exec: 'Verificar suportes e fixações das unidades (condensadora/evaporadora) e o isolamento térmico das linhas frigorígenas quanto a integridade.', c: 'Suportes firmes, isolamento das linhas íntegro e sem degradação.', nc: 'Suporte comprometido, corrosão estrutural ou isolamento das linhas danificado.', na: '—' },
  mec_03: { exec: 'Verificar tensão, alinhamento e desgaste de correias e polias do motoventilador, substituindo quando necessário.', c: 'Correias com tensão correta, sem trincas, polias alinhadas.', nc: 'Correia frouxa, trincada ou polia desalinhada/desgastada.', na: 'Sistema com transmissão direta (sem correias/polias) — comum em splits individuais.' },
  ref_01: { exec: 'Conectar manifold ao sistema e medir as pressões de alta e baixa em operação, comparando com a tabela PT do gás refrigerante utilizado.', c: 'Pressões dentro da faixa esperada para o gás e condição ambiente.', nc: 'Pressão baixa (indício de vazamento/carga insuficiente) ou alta (excesso de carga/restrição).', na: '—', ferramenta: 'Manifold, termômetro, tabela PT do gás', seguranca: 'Manuseio de gás refrigerante sob pressão — usar óculos e luvas de proteção.' },
  ref_02: { exec: 'Percorrer todo o circuito frigorífico com detector eletrônico de vazamento, verificando conexões, válvulas e solda.', c: 'Nenhum vazamento detectado.', nc: 'Vazamento detectado — localizar ponto, reparar e recarregar o sistema.', na: '—', ferramenta: 'Detector eletrônico de vazamento de gás' },
  // ── AC — anual ──
  bio_05: { exec: 'Realizar higienização completa de todos os componentes do sistema de climatização (serpentinas, bandejas, dutos acessíveis) e emitir laudo microbiológico do ar conforme ABNT NBR 17037 (fungos ≤ 750 UFC/m³ e I/E ≤ 1,5; bactérias mesófilas ≤ 500 UFC/m³).', c: 'Higienização concluída e laudo dentro dos padrões aceitáveis.', nc: 'Laudo fora do padrão — repetir higienização e nova coleta.', na: '—' },
  ele_05: { exec: 'Inspecionar capacitores (estufamento, vazamento) e contatores (contatos queimados, desgaste mecânico), substituindo os comprometidos.', c: 'Capacitores e contatores sem sinais de desgaste ou falha iminente.', nc: 'Capacitor estufado/vazando ou contator com contatos queimados.', na: '—' },
  ele_06: { exec: 'Realizar varredura termográfica com câmera infravermelha no painel elétrico e cabos de alimentação, em plena carga, identificando pontos quentes anormais.', c: 'Sem pontos quentes anormais (diferença de temperatura dentro do aceitável).', nc: 'Ponto quente identificado — indicativo de mau contato/sobrecarga, requer intervenção imediata.', na: '—', ferramenta: 'Câmera termográfica' },
  ins_02: { exec: 'Revisar toda a documentação do PMOC (plano, fichas, histórico), atualizar o cadastro de equipamentos e renovar/emitir nova ART/TRT quando aplicável.', c: 'Documentação atualizada e ART vigente.', nc: 'Documentação desatualizada ou ART vencida/ausente.', na: '—' },
  ins_03: { exec: 'Medir temperaturas de entrada/saída de ar no evaporador (Delta T) e calcular indicadores de eficiência (COP aproximado) comparando com valores de projeto/fabricante.', c: 'Delta T e eficiência dentro da faixa esperada para o equipamento.', nc: 'Delta T ou eficiência abaixo do esperado — investigar causa (carga de gás, sujidade, dimensionamento).', na: '—', ferramenta: 'Termômetro/termo-higrômetro' },
  mec_04: { exec: 'Substituir rolamentos, buchas e selos mecânicos que apresentem desgaste identificado nas inspeções anteriores.', c: 'Componentes substituídos, funcionamento sem ruído/vibração.', nc: 'Componente com desgaste não substituído.', na: 'Nenhum componente com desgaste identificado no período.' },
  mec_05: { exec: 'Limpar externamente o compressor, verificar nível e aspecto do óleo através do visor (quando existente) e checar vazamentos na carcaça.', c: 'Óleo em nível e aspecto adequados, sem vazamentos aparentes.', nc: 'Óleo baixo, contaminado (espumoso/escuro) ou vazamento identificado.', na: 'Compressor hermético sem visor de óleo.' },
  ref_03: { exec: 'Quando indicado por vazamento ou carga insuficiente confirmada, recolher o gás remanescente, evacuar o sistema, recarregar com a quantidade correta e registrar em boletim/ART.', c: 'Sistema recarregado com carga correta e boletim/ART emitido.', nc: 'Recarga sem registro de boletim ou carga incorreta.', na: 'Sistema com carga de gás adequada, sem necessidade de substituição no período.', seguranca: 'Recolhimento do gás em recipiente adequado — não liberar refrigerante para a atmosfera.' },

  // ── BEB — mensal ──
  beb_01: { exec: 'Limpar externamente o gabinete, torneiras e bica com pano úmido e detergente neutro, sem uso de produtos abrasivos.', c: 'Superfícies externas limpas, sem resíduos ou oxidação visível.', nc: 'Sujidade acumulada ou resíduo de calcário nas torneiras/bica.', na: '—' },
  beb_02: { exec: 'Medir a temperatura da água na saída e comparar com a faixa recomendada (aproximadamente 8–12°C).', c: 'Temperatura dentro da faixa recomendada.', nc: 'Temperatura fora da faixa — verificar termostato/gás/compressor.', na: '—', ferramenta: 'Termômetro' },
  beb_03: { exec: 'Verificar visualmente conexões hidráulicas e tubulações internas quanto a vazamentos ou umidade.', c: 'Sem vazamentos ou umidade identificada.', nc: 'Vazamento ou umidade identificada — reparar conexão.', na: '—' },
  beb_04: { exec: 'Remover e higienizar a bandeja coletora de respingos com solução sanitizante.', c: 'Bandeja limpa e sanitizada, sem acúmulo de resíduos.', nc: 'Bandeja suja ou com acúmulo de sujidade/mau odor.', na: '—' },
  // ── BEB — trimestral ──
  beb_05: { exec: "Drenar o reservatório, aplicar solução clorada (hipoclorito de sódio em concentração apropriada) internamente, deixar agir pelo tempo indicado e enxaguar bem antes de recolocar em uso.", c: 'Higienização realizada, sistema enxaguado e sem cloro residual perceptível.', nc: 'Higienização não realizada no prazo previsto ou resíduo de cloro perceptível na água.', na: '—', seguranca: 'Interromper o consumo de água durante a higienização; usar EPI ao manusear hipoclorito.' },
  beb_06: { exec: 'Abrir o reservatório interno, remover eventual sedimento/biofilme e limpar as paredes internas.', c: 'Reservatório limpo, sem sedimento ou biofilme visível.', nc: 'Sedimento, biofilme ou corpo estranho identificado no reservatório.', na: '—' },
  beb_07: { exec: 'Verificar o funcionamento do compressor (ciclos de acionamento, ruído) e, se necessário, medir pressões do circuito.', c: 'Compressor funcionando normalmente, temperatura de saída atendida.', nc: 'Compressor com ciclo anormal, ruído excessivo ou temperatura não atingida.', na: '—' },
  beb_08: { exec: 'Verificar a data de instalação/validade do elemento filtrante e seu estado de saturação.', c: 'Filtro dentro da validade e em bom estado.', nc: 'Filtro vencido ou saturado.', na: 'Equipamento sem filtro instalado.' },
  // ── BEB — semestral ──
  beb_09: { exec: 'Substituir o(s) elemento(s) filtrante(s) por peça nova compatível, registrando a data da troca.', c: 'Filtro substituído e data registrada.', nc: 'Filtro não substituído dentro do prazo previsto.', na: 'Equipamento sem sistema de filtragem.' },
  beb_10: { exec: 'Coletar amostra de água na saída do bebedouro em frasco estéril e enviar para laboratório credenciado para análise microbiológica (coliformes e demais parâmetros exigidos).', c: 'Amostra coletada e laudo dentro dos padrões de potabilidade.', nc: 'Laudo fora do padrão — interditar o uso e providenciar higienização/correção imediata.', na: '—' },
  beb_11: { exec: 'Medir a temperatura de saída e ajustar o termostato conforme necessário para atingir a faixa recomendada.', c: 'Temperatura ajustada dentro da faixa recomendada.', nc: 'Temperatura fora da faixa mesmo após ajuste — investigar componente com falha.', na: '—' },
  beb_12: { exec: 'Após a higienização, aplicar lacre de segurança no equipamento e registrar o número de protocolo/data no livro de controle.', c: 'Lacre aplicado e protocolo registrado corretamente.', nc: 'Lacre ausente ou protocolo não registrado.', na: '—' },
  // ── BEB — anual ──
  beb_13: { exec: 'Realizar revisão completa dos componentes de refrigeração: testar compressor, termostato e limpar serpentina de condensação.', c: 'Todos os componentes revisados e em condição adequada de funcionamento.', nc: 'Componente com falha ou desgaste identificado durante a revisão.', na: '—' },
  beb_14: { exec: 'Substituir vedações, O-rings e torneiras que apresentem desgaste, ressecamento ou vazamento.', c: 'Componentes substituídos conforme necessidade identificada.', nc: 'Componente desgastado identificado e não substituído.', na: 'Nenhum componente com desgaste identificado.' },
  beb_15: { exec: 'Consolidar e arquivar toda a documentação sanitária do ano (laudos, protocolos de higienização) no livro de controle exigido pela vigilância sanitária.', c: 'Documentação anual consolidada e arquivada corretamente.', nc: 'Documentação incompleta ou não arquivada.', na: '—' },

  // ── CLIM — mensal ──
  clm_01: { exec: 'Drenar o reservatório, remover lodo/calcário acumulado com escova e produto de limpeza apropriado, enxaguar bem antes de reabastecer.', c: 'Reservatório limpo, sem lodo ou incrustação visível.', nc: 'Lodo, calcário ou biofilme presente no reservatório.', na: '—' },
  clm_02: { exec: 'Limpar o painel evaporativo com água em baixa pressão, sem escova rígida, evitando danificar as células de celulose.', c: 'Painel limpo, células íntegras, sem obstrução.', nc: 'Painel obstruído, com incrustação ou células danificadas/rompidas.', na: '—' },
  clm_03: { exec: 'Verificar o nível de água no reservatório e testar o acionamento da boia/válvula de reposição automática.', c: 'Boia funcionando corretamente, nível de água adequado.', nc: 'Boia travada, com vazamento ou nível fora do especificado.', na: '—' },
  clm_04: { exec: "Ligar a bomba e verificar o fluxo de água nos distribuidores/aspersores, checando ruído e vazamentos.", c: 'Bomba funcionando normalmente, fluxo de distribuição uniforme.', nc: 'Bomba com ruído anormal, vazamento ou fluxo insuficiente.', na: '—' },
  clm_05: { exec: 'Ligar o ventilador e observar ruídos, vibração excessiva e verificar a fixação da hélice/pás.', c: 'Funcionamento silencioso, sem vibração excessiva, hélice bem fixada.', nc: 'Ruído/vibração anormal ou hélice com folga/desbalanceamento.', na: '—' },
  // ── CLIM — trimestral ──
  clm_06: { exec: 'Aplicar produto descalcificante específico no reservatório, seguindo tempo de contato indicado, e enxaguar completamente.', c: 'Reservatório descalcificado, sem resíduo do produto.', nc: 'Incrustação de calcário não removida ou resíduo de produto químico remanescente.', na: '—', seguranca: 'Usar EPI ao manusear produto químico descalcificante.' },
  clm_07: { exec: 'Remover e limpar bicos/aspersores dos distribuidores de água, desobstruindo furos entupidos.', c: 'Distribuidores limpos, distribuição uniforme de água sobre o painel.', nc: 'Bico entupido ou distribuição irregular de água.', na: '—' },
  clm_08: { exec: 'Medir a corrente elétrica do motor do ventilador e da bomba d\'água com amperímetro, comparando com a placa de identificação.', c: 'Corrente dentro da faixa nominal de placa.', nc: 'Corrente acima do nominal — possível sobrecarga ou desgaste mecânico.', na: '—', ferramenta: 'Alicate amperímetro' },
  clm_09: { exec: 'Aplicar lubrificante nos pontos de lubrificação do motor do ventilador e da bomba conforme especificação do fabricante.', c: 'Pontos lubrificados, sem ruído de atrito.', nc: 'Ponto sem lubrificação ou ruído de atrito identificado.', na: 'Componentes com rolamentos selados/sem ponto de lubrificação.' },
  // ── CLIM — semestral ──
  clm_10: { exec: 'Avaliar o estado geral do painel evaporativo (rigidez, incrustação, integridade das células) e definir necessidade de substituição.', c: 'Painel em condições adequadas de uso, sem necessidade de troca.', nc: 'Painel degradado, quebradiço ou com incrustação severa — recomendar substituição.', na: '—' },
  clm_11: { exec: 'Coletar amostra de água do reservatório e enviar para análise microbiológica de Legionella e contagem bacteriana em laboratório credenciado.', c: 'Resultado dentro dos limites aceitáveis.', nc: 'Resultado fora do limite — aplicar tratamento de choque e realizar nova coleta.', na: '—' },
  clm_12: { exec: 'Inspecionar o quadro elétrico do climatizador, testar contactores e verificar dispositivos de proteção (térmico/disjuntor).', c: 'Quadro em bom estado, contactores e proteções funcionando corretamente.', nc: 'Contactor com contatos queimados ou proteção não atuando conforme especificado.', na: '—' },
  clm_13: { exec: 'Aplicar produto biocida/antiincrustante na água do reservatório conforme dosagem recomendada pelo fabricante.', c: 'Tratamento aplicado e registrado.', nc: 'Tratamento não realizado dentro do prazo previsto.', na: '—', seguranca: 'Usar EPI ao manusear produto biocida.' },
  // ── CLIM — anual ──
  clm_14: { exec: 'Remover o painel evaporativo antigo e instalar painel novo de especificação equivalente (celulose ou polipropileno).', c: 'Painel substituído e instalado corretamente.', nc: 'Painel não substituído apesar de estado crítico identificado.', na: 'Painel avaliado em bom estado, sem necessidade de substituição no período.' },
  clm_15: { exec: 'Desmontar a bomba d\'água para inspeção do impelidor, eixo e vedação mecânica, substituindo peças desgastadas.', c: 'Bomba revisada, sem vazamento ou desgaste relevante identificado.', nc: 'Impelidor desgastado, eixo com folga excessiva ou vedação vazando.', na: '—' },
  clm_16: { exec: 'Consolidar os laudos de qualidade da água do ano em relatório técnico anual, arquivando junto à documentação do PMOC.', c: 'Relatório anual elaborado e arquivado.', nc: 'Relatório não elaborado ou incompleto.', na: '—' },

  // ── VEN — mensal ──
  ven_01: { exec: 'Limpar as pás/hélice e a grelha de proteção com pano/escova, removendo poeira e sujidade acumulada.', c: 'Pás e grelha limpas, sem acúmulo de poeira.', nc: 'Acúmulo de poeira/sujidade nas pás ou grelha.', na: '—' },
  ven_02: { exec: 'Ligar o equipamento e verificar ruídos anormais, vibração excessiva e folgas em componentes mecânicos.', c: 'Funcionamento normal, sem ruído ou vibração excessiva.', nc: 'Ruído, vibração ou folga mecânica identificada.', na: '—' },
  ven_03: { exec: 'Verificar e reapertar parafusos, buchas e suportes de fixação do equipamento.', c: 'Fixação firme, sem folgas.', nc: 'Parafuso solto, bucha desgastada ou suporte comprometido.', na: '—' },
  // ── VEN — trimestral ──
  ven_04: { exec: 'Aplicar graxa adequada nos pontos de lubrificação dos rolamentos/buchas conforme especificação do fabricante.', c: 'Pontos lubrificados, sem ruído de atrito.', nc: 'Ponto sem lubrificação ou ruído de atrito identificado.', na: 'Rolamentos selados sem ponto de lubrificação.' },
  ven_05: { exec: 'Medir a corrente do motor em operação com amperímetro e comparar com o valor nominal de placa.', c: 'Corrente medida dentro da faixa nominal.', nc: 'Corrente acima do nominal — possível sobrecarga.', na: '—', ferramenta: 'Alicate amperímetro' },
  ven_06: { exec: 'Com o equipamento desenergizado, reapertar as conexões elétricas no quadro de comando.', c: 'Conexões firmes, sem sinais de superaquecimento.', nc: 'Conexão solta ou com sinal de superaquecimento.', na: '—', seguranca: 'Bloquear e sinalizar (LOTO) antes da intervenção.' },
  // ── VEN — semestral ──
  ven_07: { exec: 'Medir a resistência de isolamento do motor com megôhmetro, motor desenergizado.', c: 'Resistência acima do mínimo especificado pelo fabricante.', nc: 'Resistência abaixo do mínimo — motor requer avaliação/reparo.', na: '—', ferramenta: 'Megôhmetro' },
  ven_08: { exec: 'Medir os níveis de vibração com acelerômetro em pontos padronizados do equipamento, avaliando desbalanceamento.', c: 'Níveis de vibração dentro do padrão aceitável (ISO 10816 ou similar).', nc: 'Nível de vibração acima do aceitável — indicativo de desbalanceamento/desgaste.', na: '—', ferramenta: 'Acelerômetro/analisador de vibração' },
  // ── VEN — anual ──
  ven_09: { exec: 'Substituir rolamentos e buchas que apresentem desgaste identificado nas inspeções do período.', c: 'Componentes substituídos conforme necessidade.', nc: 'Componente desgastado não substituído.', na: 'Nenhum componente com desgaste identificado no período.' },
  ven_10: { exec: 'Realizar balanceamento dinâmico das pás/hélice utilizando equipamento próprio, corrigindo desbalanceamentos identificados.', c: 'Pás/hélice balanceadas, vibração dentro do aceitável após o serviço.', nc: 'Desbalanceamento não corrigido.', na: 'Equipamento sem hélice/pás passíveis de balanceamento dinâmico.' },

  // ── OUT — mensal ──
  ger_01: { exec: 'Realizar inspeção visual geral do equipamento verificando estado de conservação, corrosão e integridade da estrutura.', c: 'Equipamento em bom estado de conservação, sem danos aparentes.', nc: 'Dano estrutural, corrosão ou deterioração identificada.', na: '—' },
  ger_02: { exec: 'Limpar externamente o equipamento, removendo poeira, oxidação superficial e sujidades acumuladas.', c: 'Equipamento limpo, sem acúmulo de sujidade.', nc: 'Sujidade ou oxidação significativa identificada.', na: '—' },
  ger_03: { exec: 'Verificar e reapertar suportes, parafusos e elementos estruturais de fixação do equipamento.', c: 'Fixação firme e estrutura estável.', nc: 'Parafuso solto ou estrutura de fixação comprometida.', na: '—' },
  ger_04: { exec: 'Verificar conexões elétricas, chave geral e dispositivos de proteção do equipamento.', c: 'Conexões firmes, chave geral e proteções funcionando corretamente.', nc: 'Conexão solta, chave com defeito ou proteção não atuante.', na: 'Equipamento sem alimentação elétrica própria.' },
  ger_05: { exec: 'Ligar o equipamento e verificar o funcionamento geral e os parâmetros operacionais especificados pelo fabricante.', c: 'Equipamento funcionando normalmente, parâmetros dentro do especificado.', nc: 'Falha de funcionamento ou parâmetro fora do especificado.', na: '—' },
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

  const COR = { mensal:'#1e3a5f', trimestral:'#5b21b6', semestral:'#0e7490', anual:'#065f46' };

  // Larguras absolutas calculadas para A4 paisagem (~1050px úteis a 96dpi, margem 8mm).
  // Coluna de item + N colunas de período devem somar ≤ 1050px.
  // item=580px + 6×78px=468px → 1048px (6 meses)
  // item=580px + 4×116px=464px → 1044px (4 trimestres)
  // item=580px + 2×232px=464px → 1044px (2 semestres)
  // item=580px + 1×468px=468px → 1048px (1 anual)
  const COL_W   = { 6:78,  4:116, 2:232, 1:468 };
  const ITEM_W  = 580; // px — fixo para todas as tabelas

  // Célula de cabeçalho de coluna (mês / trimestre / semestre / anual)
  function _th(label, cor, w) {
    return `<th style="background:${cor};color:#fff;font-size:9px;font-weight:700;
      padding:4px 2px;text-align:center;width:${w}px;
      border:1px solid rgba(255,255,255,.25);white-space:pre-line;line-height:1.2;">${label}</th>`;
  }

  // Célula de dado: ☐C ☐NC ☐NA
  function _td(w) {
    return `<td style="border:1px solid #dde3ea;padding:2px 1px;text-align:center;
      width:${w}px;white-space:nowrap;font-size:9px;color:#374151;
      vertical-align:middle;overflow:hidden;">☐&nbsp;C&nbsp;☐&nbsp;NC&nbsp;☐&nbsp;NA</td>`;
  }

  // Linha de item verificado
  function _linhaItem(label, nCols, w) {
    return `<tr>
      <td style="border:1px solid #dde3ea;font-size:9px;padding:3px 6px;line-height:1.25;width:${ITEM_W}px;">${escapeHTML(label)}</td>
      ${Array.from({length:nCols}, () => _td(w)).join('')}
    </tr>`;
  }

  // Rodapé: Data Realiz. / Técnico / Fiscal/Validador por coluna — linhas compactas
  function _rodape(nCols, w) {
    const _lr = (label) => `<tr>
      <td style="border:1px solid #dde3ea;font-size:8px;color:#718096;
        padding:2px 6px;text-align:right;white-space:nowrap;width:${ITEM_W}px;">${label}</td>
      ${Array.from({length:nCols}, () =>
        `<td style="border:1px solid #dde3ea;width:${w}px;
          border-bottom:1px dotted #94a3b8;padding:5px 2px 1px;"></td>`).join('')}
    </tr>`;
    return _lr('Data Realiz.') + _lr('Tecnico:') + _lr('Fiscal / Validador');
  }

  // Monta uma tabela completa
  function _tabela(titulo, cor, colunas, itens) {
    const n = colunas.length;
    const w = COL_W[n] || 78;
    return `
    <div style="margin-top:8px;">
      <div style="font-size:9px;font-weight:700;color:${cor};margin-bottom:2px;">${titulo}</div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <colgroup>
          <col style="width:${ITEM_W}px;">
          ${Array.from({length:n}, () => `<col style="width:${w}px;">`).join('')}
        </colgroup>
        <thead>
          <tr>
            <th style="background:${cor};color:#fff;font-size:9px;font-weight:700;
              padding:4px 6px;text-align:left;border:1px solid rgba(255,255,255,.25);width:${ITEM_W}px;">Itens Verificado</th>
            ${colunas.map(c => _th(c, cor, w)).join('')}
          </tr>
        </thead>
        <tbody>
          ${itens.map(([,label]) => _linhaItem(label, n, w)).join('')}
          ${_rodape(n, w)}
        </tbody>
      </table>
    </div>`;
  }

  let html = '';

  // ── PÁGINA 1: MENSAIS + TRIMESTRAIS ─────────────────────────────────────────
  const itensM = defs.mensal || [];
  if (itensM.length) {
    html += _tabela('Rotinas mensais', COR.mensal, ['Jan','Fev','Mar','Abr','Mai','Jun'], itensM);
    html += _tabela('Rotinas mensais', COR.mensal, ['Jul','Ago','Set','Out','Nov','Dez'], itensM);
  }

  const itensT = defs.trimestral || [];
  if (itensT.length) {
    html += _tabela('Rotinas trimestrais', COR.trimestral,
      ['1º Trimestre\n(Jan–Mar)', '2º Trimestre\n(Abr–Jun)', '3º Trimestre\n(Jul–Set)', '4º Trimestre\n(Out–Dez)'],
      itensT);
  }

  // ── QUEBRA ENTRE PÁGINAS ─────────────────────────────────────────────────────
  // Semestrais e Anuais abrem sempre em nova página (página 2 do ativo)
  const temPag2 = (defs.semestral || []).length || (defs.anual || []).length;
  if (temPag2) {
    html += `<div style="break-before:page;page-break-before:always;"></div>`;
  }

  // ── PÁGINA 2: SEMESTRAIS + ANUAIS ───────────────────────────────────────────
  const itensS = defs.semestral || [];
  if (itensS.length) {
    html += _tabela('Rotinas semestrais', COR.semestral,
      ['1º Semestre\n(Jan–Jun)', '2º Semestre\n(Jul–Dez)'],
      itensS);
  }

  const itensA = defs.anual || [];
  if (itensA.length) {
    html += _tabela('Rotinas anuais', COR.anual, ['Anual'], itensA);
  }

  return html;
}

// ===================== CAPA DE SETOR — ORGANIZAÇÃO FÍSICA DOS LAUDOS PMOC =====================
// Gera folhas de rosto padronizadas (A4 retrato) para arquivamento físico dos laudos PMOC,
// uma capa por Setor, respeitando a hierarquia Instituição › Bloco › Setor.
// Cada capa traz: identificação do setor, ano de referência, quadro-resumo por categoria,
// índice de TAGs contidas no volume e quadro de controle documental / assinaturas.
//
// Fonte dos ativos: obterEquipamentosFiltrados() — mesma base usada pela tabela, XLS,
// relatório geral e laudos em branco (mantém coerência com os filtros ativos na tela).

const CAPA_CATEGORIA_NOME = {
  AC:   'Ar Condicionado',
  BEB:  'Bebedouro',
  CLIM: 'Climatizador Evaporativo',
  VEN:  'Ventilador / Exaustor',
  OUT:  'Outros',
};
const CAPA_CATEGORIA_ORDEM = ['AC', 'BEB', 'CLIM', 'VEN', 'OUT'];

// Agrupa a lista de ativos por Instituição › Bloco › Setor.
// Retorna array ordenado alfabeticamente pela hierarquia completa.
function _agruparAtivosPorSetor(items) {
  const mapa = new Map();
  items.forEach(eq => {
    const instituicao = (eq.instituicao || '').trim() || 'Instituição não informada';
    const bloco       = (eq.bloco       || '').trim() || 'Bloco não informado';
    const setor       = (eq.setor       || '').trim() || 'Setor não informado';
    const chave = `${instituicao}||${bloco}||${setor}`;
    if (!mapa.has(chave)) mapa.set(chave, { instituicao, bloco, setor, ativos: [] });
    mapa.get(chave).ativos.push(eq);
  });

  const grupos = Array.from(mapa.values());
  grupos.sort((a, b) =>
    a.instituicao.localeCompare(b.instituicao, 'pt-BR') ||
    a.bloco.localeCompare(b.bloco, 'pt-BR') ||
    a.setor.localeCompare(b.setor, 'pt-BR')
  );
  grupos.forEach(g => g.ativos.sort((a, b) => (a.tag || '').localeCompare(b.tag || '', 'pt-BR')));
  return grupos;
}

// Quadro-resumo: contagem de ativos por categoria dentro do setor.
function _capaResumoCategorias(ativos) {
  const contagem = {};
  ativos.forEach(eq => {
    const cat = CAPA_CATEGORIA_ORDEM.includes(eq.categoria) ? eq.categoria : 'OUT';
    contagem[cat] = (contagem[cat] || 0) + 1;
  });

  const linhas = CAPA_CATEGORIA_ORDEM
    .filter(cat => contagem[cat])
    .map(cat => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;">${escapeHTML(CAPA_CATEGORIA_NOME[cat])}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;font-weight:700;color:#1e3a5f;">${contagem[cat]}</td>
      </tr>`).join('');

  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
    <thead>
      <tr style="background:#1e3a5f;color:#fff;">
        <th style="padding:6px 10px;text-align:left;font-size:10px;letter-spacing:.06em;text-transform:uppercase;">Categoria de Ativo</th>
        <th style="padding:6px 10px;text-align:center;font-size:10px;letter-spacing:.06em;text-transform:uppercase;width:70px;">Qtd.</th>
      </tr>
    </thead>
    <tbody>
      ${linhas}
      <tr style="background:#f8fafc;">
        <td style="padding:7px 10px;font-size:11px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:.05em;">Total do Setor</td>
        <td style="padding:7px 10px;font-size:13px;font-weight:700;color:#1e3a5f;text-align:center;">${ativos.length}</td>
      </tr>
    </tbody>
  </table>`;
}

// Índice de ativos do volume (chips de TAG). Limita a exibição para preservar a capa em 1 página.
function _capaIndiceTags(ativos, limite = 72) {
  const visiveis = ativos.slice(0, limite);
  const restante = ativos.length - visiveis.length;

  const chips = visiveis.map(eq => `
    <span style="display:inline-block;border:1px solid #cbd5e0;border-radius:3px;
                 padding:2px 6px;margin:0 3px 3px 0;font-size:8.5px;font-weight:600;
                 color:#2d3748;background:#f8fafc;">${escapeHTML(eq.tag || '—')}</span>`).join('');

  const nota = restante > 0
    ? `<div style="font-size:8px;color:#a0aec0;margin-top:4px;font-style:italic;">
         + ${restante} ativo${restante > 1 ? 's' : ''} não listado${restante > 1 ? 's' : ''} nesta capa — consultar o Relatório Geral de Ativos.
       </div>`
    : '';

  return `<div style="line-height:1.6;">${chips}</div>${nota}`;
}

// Monta a capa (A4 retrato) de um setor.
function montarCapaSetorHTML(grupo, ano, ultimoDaLista) {
  const classeQ  = ultimoDaLista ? '' : ' laudo-pagebreak';
  const emissao  = new Date().toLocaleDateString('pt-BR');
  const codVolume = `PMOC-${ano}-${(grupo.bloco || 'XX').replace(/\s+/g, '').slice(0, 6).toUpperCase()}-${(grupo.setor || 'XX').replace(/\s+/g, '').slice(0, 8).toUpperCase()}`;

  return `
  <div class="laudo-wrapper${classeQ}" style="min-height:265mm;display:flex;flex-direction:column;">

    <!-- FAIXA SUPERIOR -->
    <div style="background:#1e3a5f;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:14px;border-radius:5px 5px 0 0;">
      <img src="${LOGO_ETIQUETA}" alt="Logo" style="height:34px;width:auto;display:block;filter:brightness(0) invert(1);">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.04em;line-height:1.2;">Plano de Manutenção, Operação e Controle</div>
        <div style="font-size:9px;opacity:.82;margin-top:2px;letter-spacing:.06em;text-transform:uppercase;">Dossiê de Laudos Técnicos — Arquivo Físico</div>
      </div>
      <div style="text-align:right;font-size:9px;opacity:.9;line-height:1.5;">
        Exercício<br><span style="font-size:20px;font-weight:700;letter-spacing:.02em;">${escapeHTML(String(ano))}</span>
      </div>
    </div>

    <!-- IDENTIFICAÇÃO DO SETOR (bloco de destaque) -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:26px 18px;text-align:center;background:#fafbfc;">
      <div style="font-size:9px;color:#718096;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px;">Setor</div>
      <div style="font-size:30px;font-weight:700;color:#1e3a5f;line-height:1.15;word-break:break-word;">${escapeHTML(grupo.setor)}</div>
      <div style="margin-top:12px;font-size:11px;color:#4a5568;font-weight:600;">
        ${escapeHTML(grupo.instituicao)} &nbsp;›&nbsp; ${escapeHTML(grupo.bloco)}
      </div>
      <div style="margin-top:14px;display:inline-block;border:1px dashed #1e3a5f;border-radius:4px;padding:5px 14px;">
        <span style="font-size:8px;color:#718096;letter-spacing:.1em;text-transform:uppercase;">Código do Volume</span><br>
        <span style="font-size:11px;font-weight:700;color:#1e3a5f;letter-spacing:.04em;">${escapeHTML(codVolume)}</span>
      </div>
    </div>

    <!-- RESUMO + CONTROLE DOCUMENTAL -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:12px 18px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
        <div>
          <div style="font-size:9px;font-weight:700;color:#1e3a5f;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">Composição do Volume</div>
          ${_capaResumoCategorias(grupo.ativos)}
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:#1e3a5f;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">Controle de Arquivamento</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;">
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Volume nº</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Total de folhas</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Abertura do volume</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Encerramento</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div style="grid-column:1 / -1;"><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Responsável Técnico (PMOC)</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">CREA-MT nº</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">ART nº</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div style="grid-column:1 / -1;"><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Fiscal / Preposto do Contrato</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ÍNDICE DE ATIVOS -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:10px 18px;flex:1;">
      <div style="font-size:9px;font-weight:700;color:#1e3a5f;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">
        Índice de Ativos Contidos no Volume &nbsp;·&nbsp; ${grupo.ativos.length} TAG${grupo.ativos.length > 1 ? 's' : ''}
      </div>
      ${_capaIndiceTags(grupo.ativos)}
    </div>

    <!-- ASSINATURAS -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:16px 18px 10px;">
      <div style="display:flex;gap:26px;">
        <div style="flex:1;text-align:center;">
          <div style="height:26px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:8px;color:#4a5568;margin-top:3px;">Responsável Técnico — CREA / ART</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:26px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:8px;color:#4a5568;margin-top:3px;">Fiscal / Validador do Serviço</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:26px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:8px;color:#4a5568;margin-top:3px;">Responsável pelo Arquivamento</div>
        </div>
      </div>
    </div>

    <!-- RODAPÉ NORMATIVO -->
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 5px 5px;padding:8px 18px;background:#f8fafc;">
      <div style="font-size:7.5px;color:#718096;line-height:1.5;">
        Documento elaborado em conformidade com a <strong>Portaria nº 3.523/98 – MS</strong>, <strong>ABNT NBR 16401</strong> e <strong>ABNT NBR 15220-3</strong>.
        Este volume deve permanecer disponível para consulta da fiscalização e das autoridades sanitárias durante todo o período de vigência.
      </div>
      <div style="font-size:7.5px;color:#a0aec0;margin-top:4px;">
        Capa gerada pelo Sistema de Gestão Univag em ${escapeHTML(emissao)} · ${escapeHTML(codVolume)}
      </div>
    </div>

  </div>`;
}

// Emite, em um único documento de impressão (A4 retrato), uma capa por setor,
// agrupando os ativos que passam pelos filtros ativos na tela de Gerenciamento de Ativos.
function emitirCapasSetorPMOC() {
  const items = obterEquipamentosFiltrados();
  if (!items.length) { toast('Nenhum ativo encontrado para gerar capas de setor com os filtros atuais.'); return; }

  const anoPadrao = new Date().getFullYear();
  const entrada   = prompt('Ano de referência das capas PMOC:', String(anoPadrao));
  if (entrada === null) return;                     // usuário cancelou
  const ano = /^\d{4}$/.test(entrada.trim()) ? entrada.trim() : String(anoPadrao);

  const grupos = _agruparAtivosPorSetor(items);
  const html   = grupos.map((g, i) => montarCapaSetorHTML(g, ano, i === grupos.length - 1)).join('');
  imprimir('area-capas-setor', html, 'retrato');
}

// ===================== CAPA DE SETOR — ORGANIZAÇÃO FÍSICA DE ORDENS DE SERVIÇO =====================
// Capa genérica por Setor (mesmo padrão visual da capa PMOC), para uso como folha de rosto
// de arquivamento físico de O.S. preenchidas manualmente. Não lista O.S. do banco — é uma
// capa "em branco" por setor, servindo de separador/identificação do volume onde as O.S.
// físicas daquele setor serão anexadas pelo técnico/fiscal.
// Reaproveita _agruparAtivosPorSetor / _capaResumoCategorias / _capaIndiceTags para manter
// a mesma hierarquia (Instituição › Bloco › Setor) e o mesmo índice de ativos da capa PMOC.
function montarCapaOSSetorHTML(grupo, ano, ultimoDaLista) {
  const classeQ  = ultimoDaLista ? '' : ' laudo-pagebreak';
  const emissao  = new Date().toLocaleDateString('pt-BR');
  const codVolume = `OS-${ano}-${(grupo.bloco || 'XX').replace(/\s+/g, '').slice(0, 6).toUpperCase()}-${(grupo.setor || 'XX').replace(/\s+/g, '').slice(0, 8).toUpperCase()}`;

  return `
  <div class="laudo-wrapper${classeQ}" style="min-height:265mm;display:flex;flex-direction:column;">

    <!-- FAIXA SUPERIOR -->
    <div style="background:#1e3a5f;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:14px;border-radius:5px 5px 0 0;">
      <img src="${LOGO_ETIQUETA}" alt="Logo" style="height:34px;width:auto;display:block;filter:brightness(0) invert(1);">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.04em;line-height:1.2;">Ordens de Serviço</div>
        <div style="font-size:9px;opacity:.82;margin-top:2px;letter-spacing:.06em;text-transform:uppercase;">Dossiê de O.S. — Arquivo Físico</div>
      </div>
      <div style="text-align:right;font-size:9px;opacity:.9;line-height:1.5;">
        Exercício<br><span style="font-size:20px;font-weight:700;letter-spacing:.02em;">${escapeHTML(String(ano))}</span>
      </div>
    </div>

    <!-- IDENTIFICAÇÃO DO SETOR (bloco de destaque) -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:26px 18px;text-align:center;background:#fafbfc;">
      <div style="font-size:9px;color:#718096;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px;">Setor</div>
      <div style="font-size:30px;font-weight:700;color:#1e3a5f;line-height:1.15;word-break:break-word;">${escapeHTML(grupo.setor)}</div>
      <div style="margin-top:12px;font-size:11px;color:#4a5568;font-weight:600;">
        ${escapeHTML(grupo.instituicao)} &nbsp;›&nbsp; ${escapeHTML(grupo.bloco)}
      </div>
      <div style="margin-top:14px;display:inline-block;border:1px dashed #1e3a5f;border-radius:4px;padding:5px 14px;">
        <span style="font-size:8px;color:#718096;letter-spacing:.1em;text-transform:uppercase;">Código do Volume</span><br>
        <span style="font-size:11px;font-weight:700;color:#1e3a5f;letter-spacing:.04em;">${escapeHTML(codVolume)}</span>
      </div>
    </div>

    <!-- RESUMO + CONTROLE DOCUMENTAL -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:12px 18px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
        <div>
          <div style="font-size:9px;font-weight:700;color:#1e3a5f;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">Ativos do Setor</div>
          ${_capaResumoCategorias(grupo.ativos)}
        </div>
        <div>
          <div style="font-size:9px;font-weight:700;color:#1e3a5f;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">Controle de Arquivamento</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;">
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Volume nº</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Total de folhas</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Abertura do volume</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Encerramento</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div style="grid-column:1 / -1;"><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Responsável pela Manutenção / Encarregado</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Registro / Matrícula</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Nº do Contrato</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
            <div style="grid-column:1 / -1;"><div style="font-size:8px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Fiscal / Preposto do Contrato</div><div style="border-bottom:1px solid #cbd5e0;min-height:17px;"></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ÍNDICE DE ATIVOS -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:10px 18px;flex:1;">
      <div style="font-size:9px;font-weight:700;color:#1e3a5f;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;">
        Índice de Ativos do Setor &nbsp;·&nbsp; ${grupo.ativos.length} TAG${grupo.ativos.length > 1 ? 's' : ''}
      </div>
      ${_capaIndiceTags(grupo.ativos)}
      <div style="margin-top:10px;font-size:8px;color:#a0aec0;font-style:italic;">
        As Ordens de Serviço referentes aos ativos acima devem ser anexadas fisicamente a este volume, em ordem cronológica.
      </div>
    </div>

    <!-- ASSINATURAS -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:16px 18px 10px;">
      <div style="display:flex;gap:26px;">
        <div style="flex:1;text-align:center;">
          <div style="height:26px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:8px;color:#4a5568;margin-top:3px;">Responsável pela Manutenção</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:26px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:8px;color:#4a5568;margin-top:3px;">Fiscal / Validador do Serviço</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:26px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:8px;color:#4a5568;margin-top:3px;">Responsável pelo Arquivamento</div>
        </div>
      </div>
    </div>

    <!-- RODAPÉ NORMATIVO -->
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 5px 5px;padding:8px 18px;background:#f8fafc;">
      <div style="font-size:7.5px;color:#718096;line-height:1.5;">
        Volume de arquivamento físico das Ordens de Serviço do setor, em conformidade com a <strong>Portaria nº 3.523/98 – MS</strong>.
        Este volume deve permanecer disponível para consulta da fiscalização e das autoridades sanitárias durante todo o período de vigência.
      </div>
      <div style="font-size:7.5px;color:#a0aec0;margin-top:4px;">
        Capa gerada pelo Sistema de Gestão Univag em ${escapeHTML(emissao)} · ${escapeHTML(codVolume)}
      </div>
    </div>

  </div>`;
}

// Emite, em um único documento de impressão (A4 retrato), uma capa genérica de O.S. por setor,
// agrupando os ativos que passam pelos filtros ativos na tela de Gerenciamento de Ativos.
// Mesma fonte e mesmos filtros da capa PMOC — mantém as duas central de impressões em sincronia.
function emitirCapasSetorOS() {
  const items = obterEquipamentosFiltrados();
  if (!items.length) { toast('Nenhum ativo encontrado para gerar capas de setor com os filtros atuais.'); return; }

  const anoPadrao = new Date().getFullYear();
  const entrada   = prompt('Ano de referência das capas de O.S.:', String(anoPadrao));
  if (entrada === null) return;                     // usuário cancelou
  const ano = /^\d{4}$/.test(entrada.trim()) ? entrada.trim() : String(anoPadrao);

  const grupos = _agruparAtivosPorSetor(items);
  const html   = grupos.map((g, i) => montarCapaOSSetorHTML(g, ano, i === grupos.length - 1)).join('');
  imprimir('area-capas-os-setor', html, 'retrato');
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
    <div style="background:#1e3a5f;color:#fff;padding:5px 10px;display:flex;align-items:center;gap:10px;border-radius:4px 4px 0 0;">
      <img src="${LOGO_ETIQUETA}" alt="Logo" style="height:22px;width:auto;display:block;filter:brightness(0) invert(1);">
      <div>
        <div style="font-size:10px;font-weight:700;line-height:1.2;">Plano de Manutenção, Operação e Controle (PMOC)</div>
        <div style="font-size:8px;opacity:.8;margin-top:1px;">Checklist de Manutenção Preventiva — ${anoAtual}</div>
      </div>
    </div>

    <!-- IDENTIFICAÇÃO DO ATIVO — compacto em 2 linhas -->
    <div style="border:1px solid #e2e8f0;border-top:2px solid #1e3a5f;padding:4px 10px;background:#fafbfc;">
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px 10px;">
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">TAG</div><div style="font-size:9px;font-weight:700;color:#1e3a5f;">${escapeHTML(eq.tag)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Equipamento</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.produto || categoria)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Marca</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.marca)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Nº Série</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.nr_serie)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Patrimônio</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.patrimonio)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Potência</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.potencia || '—')}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Bloco</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.bloco)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Setor</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.setor)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Sala/Local</div><div style="font-size:9px;font-weight:600;">${escapeHTML(eq.sala)}</div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Técnico</div><div style="border-bottom:1px solid #cbd5e0;min-height:13px;"></div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Data da Inspeção</div><div style="border-bottom:1px solid #cbd5e0;min-height:13px;"></div></div>
        <div><div style="font-size:7px;color:#718096;text-transform:uppercase;letter-spacing:.05em;">Fiscal/Validador</div><div style="border-bottom:1px solid #cbd5e0;min-height:13px;"></div></div>
      </div>
    </div>

    <!-- CHECKLIST compacto -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:3px 8px 4px;">
      <div style="font-size:7px;font-weight:700;color:#1e3a5f;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px;padding-bottom:2px;border-bottom:1px solid #e2e8f0;">Checklist de Manutenção · Marque C / NC / NA · Registre Data e Técnico</div>
      ${checklistHTML}
    </div>

    <!-- OBSERVAÇÕES + ASSINATURAS -->
    <div style="border:1px solid #e2e8f0;border-top:none;padding:3px 8px;">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="flex:2;">
          <div style="font-size:7px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Observações Técnicas</div>
          <div style="border:1px solid #e2e8f0;height:26px;border-radius:2px;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:24px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:7px;color:#4a5568;margin-top:2px;">Técnico Executor</div>
        </div>
        <div style="flex:1;text-align:center;">
          <div style="height:24px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:7px;color:#4a5568;margin-top:2px;">Fiscal / Validador</div>
        </div>
        <div style="flex:1.4;text-align:center;">
          <div style="height:24px;border-bottom:1px solid #2d3748;"></div>
          <div style="font-size:7px;color:#4a5568;margin-top:2px;">Resp. Técnico — CREA / ART nº ________</div>
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
  if (!items.length) { toast('Nenhum ativo encontrado para gerar laudos em branco com os filtros atuais.'); return; }
  const html = items.map((eq, i) => montarLaudoAnualAgrupadoHTML(eq, i === items.length - 1)).join('');
  imprimir('area-laudos-em-branco', html, 'paisagem');
}

async function emitirRelatorioPMOC(b64) {
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

  const checklistHTML = montarSecoesChecklistPMOC(tipo, freq, checklist);

  // Responsável Técnico (CREA) — registro ativo cadastrado em Empresas › Responsáveis
  let respTecnico = null;
  try {
    const { data } = await db.from('responsaveis_seguranca').select('nome, crea').eq('ativo', true).maybeSingle();
    respTecnico = data || null;
  } catch (e) { respTecnico = null; }

  const assinaturaTecnicoHTML = _assinaturaImg(lerAssinaturaURL(f,'assinatura_tecnico_url','assinatura_digital'),'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');
  const assinaturaFiscalHTML  = _assinaturaImg(lerAssinaturaURL(f,'assinatura_fiscal_url','assinatura_fiscal'), 'max-width:200px;max-height:65px;display:block;margin:0 auto 4px;');
  const urlValidacao = gerarUrlValidacao(f.id, 'pmoc');
  const qrCodeHTML   = gerarQrCodeSVG(urlValidacao, 100);
  const codigoLaudo  = `L-PMOC-${f.id.toString().slice(0,6).toUpperCase()}`;
  const fotoHTML = galeriaFotosHTML(f);

  const html = `
  <div class="laudo-wrapper">
    <div class="laudo-header">
      <div style="display:flex;align-items:center;gap:14px;"><img src="${LOGO_ETIQUETA}" alt="Logo" style="height:40px;width:auto;display:block;"><div><h1 style="font-size:16px;">Plano de Manutenção, Operação e Controle</h1><p style="font-size:11px;opacity:.85;margin-top:2px;">Checklist de Manutenção Preventiva</p></div></div>
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
    ${checklistHTML ? `
    <div class="laudo-section laudo-section-checklist">
      <div class="laudo-section-title">Checklist de Manutenção — Por Periodicidade</div>
      ${checklistHTML}
    </div>` : ''}
    ${obsLimpa ? `
    <div class="laudo-section">
      <div class="laudo-section-title">Observações Técnicas</div>
      <p style="font-size:12px;line-height:1.6;">${escapeHTML(obsLimpa)}</p>
    </div>` : ''}
    ${fotoHTML}
    <div class="laudo-section">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;">
        <div style="display:flex;gap:32px;align-items:flex-end;flex:1;flex-wrap:wrap;">
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaTecnicoHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(f.tecnico_nome)}<br>Técnico Executor</div>
          </div>
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            ${assinaturaFiscalHTML}
            <div class="laudo-assinatura-linha">${escapeHTML(fiscalNome)}<br>Fiscal / Validador do Serviço</div>
          </div>
          ${respTecnico ? `
          <div class="laudo-assinatura-box" style="min-width:160px;text-align:center;">
            <div style="height:65px;"></div>
            <div class="laudo-assinatura-linha">${escapeHTML(respTecnico.nome)}<br>Responsável Técnico${respTecnico.crea ? ' — CREA-MT ' + escapeHTML(respTecnico.crea) : ''}</div>
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
        Documento gerado pelo Sistema de Gestão Univag · ${new Date().toLocaleString('pt-BR')} · Verificação: ${urlValidacao}
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
  const { data } = await fetchAll(() => db.from('ordens_servico_geral').select('*').order('created_at', { ascending: false }));
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
  // T2.1 — antes o .limit(20) vinha SEM ORDER BY: o PostgREST devolvia 20 linhas
  // arbitrárias, que só depois eram ordenadas por data no navegador. A tabela de
  // "atividade recente" mostrava registros aleatórios, não os mais recentes.
  const { data: ac } = await db.from('ordens_servico')
    .select('id,created_at,tipo_os,status_os,descricao_defeito')
    .order('created_at', { ascending: false }).limit(20);
  const { data: g  } = await db.from('ordens_servico_geral')
    .select('id,created_at,tipo_manutencao,status_os,servico_requisitado,numero_os')
    .order('created_at', { ascending: false }).limit(20);
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
  const { data: perfis } = await fetchAll(() => db.from('profiles').select('*').order('email', { ascending: true }));
  let lista = perfis || [];
  // T1.2 — antes, quando o perfil do usuário logado não aparecia na lista, um
  // registro sintético já promovido a administrador era injetado. Isso mascarava
  // exatamente o sintoma que denunciaria o perfil ausente. Agora exibimos um aviso.
  const perfilProprioAusente = !!userAtual?.email && !lista.some(u => u.email === userAtual.email);
  if (userAtual?.email && !perfilProprioAusente) {
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
  const avisoPerfilAusente = perfilProprioAusente
    ? `<tr><td colspan="5" style="background:#fffbeb;color:#92400e;font-weight:600;padding:12px;border-left:4px solid #d97706;">
         ⚠️ Seu perfil (${escapeHTML(userAtual.email)}) não foi localizado na base — contate o administrador.
       </td></tr>`
    : '';
  tbody.innerHTML = avisoPerfilAusente + lista.map(u => {
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
    const { data } = await fetchAll(() => db.from('equipamentos').select('*').order('tag', { ascending: true }));
    globalEquipamentos = data || [];
  }
  const comToken = globalEquipamentos.filter(e => e.qrcode_token);
  if (!comToken.length) { toast('Nenhum ativo com QR Code cadastrado.'); return; }
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
  <title>Etiqueta${lista.length > 1 ? 's' : ''} — Univag</title>
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
  if (!win) { toast('Permita pop-ups neste site para abrir a etiqueta de impressão.'); return; }
  win.document.write(html);
  win.document.close();
}

// ===================== IMPRESSÃO =====================
function imprimir(areaId, html, orientacao) {
  const orient = orientacao === 'retrato' ? 'portrait' : 'landscape';
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast('Permita pop-ups para imprimir os laudos.'); return; }
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Univag — Impressão</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}@page{margin:6mm 8mm;size:A4 ${orient}}html,body{font-family:'Inter',Arial,sans-serif;font-size:10px;color:#1a202c;background:#fff}.laudo-wrapper{width:100%}.laudo-header{background:#1a56db;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0}.laudo-header h1{font-size:16px;font-weight:700}.laudo-header p{font-size:10px;margin-top:4px;opacity:.85}.laudo-header-meta{text-align:right;font-size:10px}.laudo-section{border:1px solid #e2e8f0;border-top:none;padding:12px 16px;break-inside:avoid;page-break-inside:avoid}.laudo-section:last-child{border-radius:0 0 6px 6px}.laudo-section-title{font-size:10px;font-weight:700;color:#1a56db;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;break-after:avoid;page-break-after:avoid}.laudo-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.laudo-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px}.laudo-field{margin-bottom:4px}.laudo-field label{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:.06em;display:block}.laudo-field span{font-size:10px;font-weight:600;color:#1a202c}.laudo-checklist-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:10px;break-inside:avoid;page-break-inside:avoid}.laudo-checklist-table th{background:#1a56db;color:#fff;padding:5px 8px;text-align:left;font-size:10px}.laudo-checklist-table td{padding:4px 8px;border-bottom:1px solid #e2e8f0;font-size:10px}.laudo-checklist-table tr{break-inside:avoid;page-break-inside:avoid}.laudo-checklist-table tr:nth-child(even) td{background:#f8fafc}.ok{color:#059669;font-weight:700}.nok{color:#dc2626;font-weight:700}.na{color:#a0aec0}.laudo-assinatura-box{text-align:center;min-width:180px;break-inside:avoid;page-break-inside:avoid}.laudo-assinatura-linha{border-top:1px solid #1a202c;margin-top:8px;padding-top:4px;font-size:10px;color:#4a5568}img{max-width:100%;height:auto;display:block}.tag-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:#e2e8f0;color:#2d3748}.tag-badge.success{background:#d1fae5;color:#065f46}.tag-badge.warning{background:#fef3c7;color:#92400e}.tag-badge.danger{background:#fee2e2;color:#991b1b}.tag-badge.andamento{background:#dbeafe;color:#1e40af}.laudo-field-em-branco{font-size:9px;color:#a0aec0;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px dotted #cbd5e0;padding-bottom:20px;}.laudo-pagebreak{break-after:page;page-break-after:always;}.laudo-checkbox-status{white-space:nowrap;font-size:10px;color:#4a5568;}.laudo-section-checklist{break-inside:auto !important;page-break-inside:auto !important;padding:6px 10px !important;}.exec-label{font-size:9px;color:#b0b8c4;display:block;line-height:1.4;border-bottom:1px dotted #cbd5e0;padding-bottom:8px;margin-bottom:1px;}.relatorio-livre .laudo-section{break-inside:auto !important;page-break-inside:auto !important;}.relatorio-livre .laudo-checklist-table{break-inside:auto !important;page-break-inside:auto !important;}.relatorio-livre .laudo-checklist-table tr{break-inside:avoid;page-break-inside:avoid;}
${orient === 'landscape' ? `
.laudo-section{padding:6px 10px !important;}
.laudo-grid-3{gap:3px 12px !important;}
.laudo-field{margin-bottom:2px !important;}
.laudo-field label{font-size:8px !important;}
.laudo-field span{font-size:10px !important;}
.laudo-section-title{font-size:9px !important;margin-bottom:4px !important;padding-bottom:2px !important;}
table.chk-anual{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;}
table.chk-anual th,table.chk-anual td{border:1px solid #e2e8f0;overflow:hidden;}
table.chk-anual th:first-child,table.chk-anual td:first-child{width:auto;text-align:left;}
table.chk-anual th:not(:first-child),table.chk-anual td:not(:first-child){width:36px;min-width:28px;text-align:center;}
` : ''}
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
        fetchAll(() => db.from('ordens_servico').select('status_os')),
        fetchAll(() => db.from('ordens_servico_geral').select('status_os')),
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
      const { data: eqCrit } = await fetchAll(() => db.from('equipamentos').select('criticidade'));
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
      const { data: osFac } = await fetchAll(() => db.from('ordens_servico_geral').select('status_os'));
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
// ===================== DASHBOARD — FILTROS DE LOCALIZAÇÃO (cascata) =====================
// Estado global do filtro aplicado ao Dashboard. Vazio = sem filtro (todos os locais).
let _dashFiltro = { instituicaoId: '', blocoId: '', setorId: '', salaId: '' };

// Popula um <select> de Blocos com um rótulo "Todos" customizado (uso em filtros, não cascata de formulário).
async function popularSelectBlocosComTodos(instituicaoId, selectId, labelTodos) {
  const sel = $(selectId); if (!sel) return;
  if (!instituicaoId) {
    sel.innerHTML = `<option value="">${labelTodos}</option>`;
    sel.disabled = false;
    return;
  }
  const { data } = await fetchAll(() => db.from('blocos').select('id, nome').eq('instituicao_id', instituicaoId).order('nome', { ascending: true }));
  sel.disabled = false;
  sel.innerHTML = `<option value="">${labelTodos}</option>` + (data || []).map(b => `<option value="${b.id}">${escapeHTML(b.nome)}</option>`).join('');
}

// Popula um <select> de Setores com um rótulo "Todos" customizado (uso em filtros, não cascata de formulário).
async function popularSelectSetoresComTodos(blocoId, selectId, labelTodos) {
  const sel = $(selectId); if (!sel) return;
  if (!blocoId) {
    sel.innerHTML = `<option value="">${labelTodos}</option>`;
    sel.disabled = false;
    return;
  }
  const { data } = await fetchAll(() => db.from('setores').select('id, nome').eq('bloco_id', blocoId).order('nome', { ascending: true }));
  sel.disabled = false;
  sel.innerHTML = `<option value="">${labelTodos}</option>` + (data || []).map(s => `<option value="${s.id}">${escapeHTML(s.nome)}</option>`).join('');
}

// Popula um <select> de Salas com um rótulo "Todos" customizado (uso em filtros do dashboard).
async function popularSelectSalasComTodos(setorId, selectId, labelTodos) {
  const sel = $(selectId); if (!sel) return;
  if (!setorId) {
    sel.innerHTML = `<option value="">${labelTodos}</option>`;
    sel.disabled = false;
    return;
  }
  const { data } = await fetchAll(() => db.from('salas').select('id, nome').eq('setor_id', setorId).order('nome', { ascending: true }));
  sel.disabled = false;
  sel.innerHTML = `<option value="">${labelTodos}</option>` + (data || []).map(s => `<option value="${s.id}">${escapeHTML(s.nome)}</option>`).join('');
}

async function inicializarFiltrosDashboard() {
  await popularSelectInstituicoes('dash-filtro-instituicao', true);
  await popularSelectBlocosComTodos('', 'dash-filtro-bloco', 'Todos os Blocos');
  await popularSelectSetoresComTodos('', 'dash-filtro-setor', 'Todos os Setores');
  await popularSelectSalasComTodos('', 'dash-filtro-sala', 'Todas as Salas');
}

async function dashAoMudarInstituicao() {
  _dashFiltro.instituicaoId = $('dash-filtro-instituicao')?.value || '';
  _dashFiltro.blocoId = ''; _dashFiltro.setorId = ''; _dashFiltro.salaId = '';
  await popularSelectBlocosComTodos(_dashFiltro.instituicaoId, 'dash-filtro-bloco', 'Todos os Blocos');
  await popularSelectSetoresComTodos('', 'dash-filtro-setor', 'Todos os Setores');
  await popularSelectSalasComTodos('', 'dash-filtro-sala', 'Todas as Salas');
  recarregarDashboardComFiltro();
}

async function dashAoMudarBloco() {
  _dashFiltro.blocoId = $('dash-filtro-bloco')?.value || '';
  _dashFiltro.setorId = ''; _dashFiltro.salaId = '';
  await popularSelectSetoresComTodos(_dashFiltro.blocoId, 'dash-filtro-setor', 'Todos os Setores');
  await popularSelectSalasComTodos('', 'dash-filtro-sala', 'Todas as Salas');
  recarregarDashboardComFiltro();
}

async function dashAoMudarSetor() {
  _dashFiltro.setorId = $('dash-filtro-setor')?.value || '';
  _dashFiltro.salaId = '';
  await popularSelectSalasComTodos(_dashFiltro.setorId, 'dash-filtro-sala', 'Todas as Salas');
  recarregarDashboardComFiltro();
}

function dashAoMudarSala() {
  _dashFiltro.salaId = $('dash-filtro-sala')?.value || '';
  recarregarDashboardComFiltro();
}

async function dashLimparFiltros() {
  _dashFiltro = { instituicaoId: '', blocoId: '', setorId: '', salaId: '' };
  if ($('dash-filtro-instituicao')) $('dash-filtro-instituicao').value = '';
  await inicializarFiltrosDashboard();
  recarregarDashboardComFiltro();
}

// Retorna a query base de equipamentos já filtrada pela Instituição/Bloco/Setor
// selecionados no Dashboard (cascata). Sem filtro selecionado, retorna a query sem .eq().
function aplicarFiltroLocalizacaoQuery(query) {
  if (_dashFiltro.salaId)        return query.eq('sala_id', _dashFiltro.salaId);
  if (_dashFiltro.setorId)       return query.eq('setor_id', _dashFiltro.setorId);
  if (_dashFiltro.blocoId)       return query.eq('bloco_id', _dashFiltro.blocoId);
  if (_dashFiltro.instituicaoId) return query.eq('instituicao_id', _dashFiltro.instituicaoId);
  return query;
}

function recarregarDashboardComFiltro() {
  carregarKPIsExtras();
  carregarInventarioGas();
  carregarDistribuicaoCategoria();
  carregarConformidadeFiltros();
  carregarCoberturaPMOC();
  carregarKpiCargaTermica();
  carregarConsistenciaAtivoAmbiente();
}

// ===================== DASHBOARD — KPI: CARGA INSTALADA × CARGA NECESSÁRIA =====================
// Compara a soma da potência (BTU/h) dos ACs instalados com a soma da carga térmica
// prevista (BTU/h) das Salas cadastradas, respeitando o filtro de localização ativo.
async function carregarKpiCargaTermica() {
  const elInstalada  = $('dash-txt-carga-instalada');
  const elNecessaria = $('dash-txt-carga-necessaria');
  const elBadge       = $('dash-badge-carga-termica');
  if (!elInstalada && !elNecessaria) return;

  // Carga instalada: soma da potência dos equipamentos AC, respeitando o filtro de localização
  let queryEq = db.from('equipamentos').select('potencia').eq('categoria', 'AC');
  queryEq = aplicarFiltroLocalizacaoQuery(queryEq);
  const { data: eqsAC } = await fetchAll(() => queryEq);
  const cargaInstalada = (eqsAC || []).reduce((soma, e) => {
    const n = parseFloat((e.potencia || '').toString().replace(/\s*BTU\/h/i, '').replace(/\./g, '').replace(',', '.'));
    return soma + (isNaN(n) ? 0 : n);
  }, 0);

  // Carga necessária: soma da carga_termica_btu das Salas, respeitando o filtro de localização.
  // Salas não têm instituicao_id/bloco_id diretos — resolve em etapas via setores/blocos.
  let querySalas = db.from('salas').select('carga_termica_btu, setor_id');
  if (_dashFiltro.salaId) {
    querySalas = querySalas.eq('id', _dashFiltro.salaId);
  } else if (_dashFiltro.setorId) {
    querySalas = querySalas.eq('setor_id', _dashFiltro.setorId);
  } else if (_dashFiltro.blocoId) {
    const { data: setoresDoBloco } = await fetchAll(() => db.from('setores').select('id').eq('bloco_id', _dashFiltro.blocoId));
    const idsSetores = (setoresDoBloco || []).map(s => s.id);
    querySalas = idsSetores.length ? querySalas.in('setor_id', idsSetores) : querySalas.eq('setor_id', '00000000-0000-0000-0000-000000000000');
  } else if (_dashFiltro.instituicaoId) {
    const { data: blocosDaInst } = await fetchAll(() => db.from('blocos').select('id').eq('instituicao_id', _dashFiltro.instituicaoId));
    const idsBlocos = (blocosDaInst || []).map(b => b.id);
    if (idsBlocos.length) {
      const { data: setoresDosBlocos } = await fetchAll(() => db.from('setores').select('id').in('bloco_id', idsBlocos));
      const idsSetores = (setoresDosBlocos || []).map(s => s.id);
      querySalas = idsSetores.length ? querySalas.in('setor_id', idsSetores) : querySalas.eq('setor_id', '00000000-0000-0000-0000-000000000000');
    } else {
      querySalas = querySalas.eq('setor_id', '00000000-0000-0000-0000-000000000000');
    }
  }
  const { data: salasFiltradas } = await fetchAll(() => querySalas);
  const cargaNecessaria = (salasFiltradas || []).reduce((soma, s) => soma + (parseFloat(s.carga_termica_btu) || 0), 0);

  if (elInstalada)  elInstalada.textContent  = cargaInstalada  > 0 ? `${Math.round(cargaInstalada).toLocaleString('pt-BR')} BTU/h`  : '—';
  if (elNecessaria) elNecessaria.textContent = cargaNecessaria > 0 ? `${Math.round(cargaNecessaria).toLocaleString('pt-BR')} BTU/h` : '—';

  if (elBadge) {
    if (!cargaNecessaria) {
      elBadge.textContent = 'Sem dados de carga prevista para o filtro atual';
      elBadge.style.color = '#a0aec0';
    } else {
      const diffPct = Math.round(((cargaInstalada - cargaNecessaria) / cargaNecessaria) * 100);
      if (diffPct >= 0) {
        elBadge.textContent = `✓ Carga instalada ${diffPct}% acima da necessária`;
        elBadge.style.color = '#10b981';
      } else {
        elBadge.textContent = `⚠ Carga instalada ${Math.abs(diffPct)}% abaixo da necessária`;
        elBadge.style.color = '#ef4444';
      }
    }
  }
}

// ===================== DASHBOARD — CONSISTÊNCIA ATIVO × AMBIENTE =====================
// Painel de auditoria que cruza o cadastro de Ativos com o de Salas, respeitando o filtro de
// localização ativo. Reaproveita integralmente as funções de análise (single source of truth)
// usadas pelos relatórios impressos da Central de Impressões.
async function carregarConsistenciaAtivoAmbiente() {
  const elCrit  = $('dash-consist-criticidade');
  const elExa   = $('dash-consist-exaustao');
  const elLista = $('dash-consist-lista');
  if (!elCrit && !elExa) return;

  let base;
  try {
    base = await _carregarBaseConsistenciaAtivoAmbiente(_dashFiltro);
  } catch (err) {
    if (elCrit) elCrit.innerHTML = `<span style="color:#ef4444;">Erro ao carregar: ${escapeHTML(err.message || String(err))}</span>`;
    return;
  }

  const equipamentos = _filtrarEquipamentosPorFiltroLocal(base.equipamentos, _dashFiltro);
  const analisesCrit = analisarDivergenciaCriticidade(equipamentos, base.salas);
  const resumoCrit   = resumirDivergenciaCriticidade(analisesCrit);
  const analisesExa  = analisarConformidadeExaustao(base.salas, base.equipamentos);
  const resumoExa    = resumirConformidadeExaustao(analisesExa);

  const linha = (cor, rotulo, valor, sufixo) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;">
       <span style="font-size:12px;color:#4a5568;"><span style="color:${cor};font-size:14px;">●</span> ${rotulo}</span>
       <strong style="font-size:13px;color:${cor};">${valor}${sufixo || ''}</strong>
     </div>`;

  if (elCrit) {
    const pct = resumoCrit.total ? Math.round((resumoCrit.alinhado / resumoCrit.total) * 100) : 0;
    elCrit.innerHTML = resumoCrit.total
      ? linha('#ef4444', 'Subclassificados <small style="color:#a0aec0;">(risco)</small>', resumoCrit.abaixo, '')
        + linha('#f59e0b', 'Sem criticidade aplicada', resumoCrit.sem_classe, '')
        + linha('#3b82f6', 'Superclassificados', resumoCrit.acima, '')
        + linha('#94a3b8', 'Ambiente não classificado', resumoCrit.sala_indef + resumoCrit.sem_sala, '')
        + linha('#10b981', 'Alinhados ao ambiente', `${resumoCrit.alinhado} (${pct}%)`, '')
      : '<span style="color:#a0aec0;">Nenhum ativo no escopo do filtro atual.</span>';
  }

  if (elExa) {
    elExa.innerHTML = resumoExa.total
      ? linha('#ef4444', 'Exigem exaustão e não possuem', resumoExa.pendente, '')
        + linha('#10b981', 'Exigem e possuem exaustor', resumoExa.conforme, '')
        + linha('#3b82f6', 'Exaustor sem exigência', resumoExa.excedente, '')
        + linha('#f59e0b', 'Sem tipo/exigência cadastrada', resumoExa.indefinido, '')
        + linha('#94a3b8', 'Dispensadas de exaustão', resumoExa.nao_exige, '')
      : '<span style="color:#a0aec0;">Nenhuma sala no escopo do filtro atual.</span>';
  }

  // Top 8 divergências de maior prioridade (subclassificados primeiro, depois sem criticidade).
  if (elLista) {
    const criticas = analisesCrit
      .filter(a => a.info.prioridade)
      .sort((a, b) => a.info.ordem - b.info.ordem)
      .slice(0, 8);
    elLista.innerHTML = criticas.length
      ? criticas.map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;">
          <div style="min-width:0;">
            <strong style="font-size:12px;color:#9a3412;">${escapeHTML(a.eq.tag || '—')}</strong>
            <span style="font-size:11px;color:#78716c;"> · ${escapeHTML(a.sala?.nome || a.eq.sala || 'sem sala')}</span>
          </div>
          <span style="font-size:11px;font-weight:700;color:#c2410c;white-space:nowrap;">
            ${a.classeAtivo ? escapeHTML(a.classeAtivo) : 'sem classe'} → ${a.classeSala ? escapeHTML(a.classeSala) : '—'}
          </span>
        </div>`).join('')
      : '<span style="font-size:12px;color:#10b981;">✓ Nenhuma divergência de risco no escopo atual.</span>';
  }
}

async function carregarKPIsExtras() {
  const elFiltros = $('dash-txt-filtros-vencer');
  const elPmoc    = $('dash-txt-pmoc-vencidos');
  if (!elFiltros && !elPmoc) return;

  const hj    = new Date(); hj.setHours(0,0,0,0);
  const em30  = new Date(hj); em30.setDate(em30.getDate() + 30);
  const hjStr = hj.toISOString().split('T')[0];
  const e30Str = em30.toISOString().split('T')[0];

  let queryBebs  = db.from('equipamentos').select('validade').eq('categoria','BEB').not('validade','is',null).lte('validade', e30Str);
  queryBebs = aplicarFiltroLocalizacaoQuery(queryBebs);
  const [{ data: bebs }, { data: pmocs }] = await Promise.all([
    fetchAll(() => queryBebs),
    fetchAll(() => db.from('fichas_pmoc').select('proxima_manutencao').not('proxima_manutencao','is',null).lt('proxima_manutencao', hjStr)),
  ]);

  if (elFiltros) elFiltros.textContent = (bebs||[]).length;
  if (elPmoc)    elPmoc.textContent    = (pmocs||[]).length;
}

// ===================== DASHBOARD — INVENTÁRIO DE GÁS REFRIGERANTE =====================
async function carregarInventarioGas() {
  const el    = $('dash-inv-gas');
  const elTot = $('dash-gas-total');
  if (!el) return;

  let queryEqs = db.from('equipamentos').select('extras_tecnico').eq('categoria','AC');
  queryEqs = aplicarFiltroLocalizacaoQuery(queryEqs);
  const { data: eqs } = await fetchAll(() => queryEqs);
  const mapa = {};
  let totalKg = 0;

  (eqs||[]).forEach(e => {
    const extras = parseExtras(e.extras_tecnico);
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

  let queryEqs = db.from('equipamentos').select('categoria,criticidade');
  queryEqs = aplicarFiltroLocalizacaoQuery(queryEqs);
  const { data: eqs } = await fetchAll(() => queryEqs);
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
  let queryBebs = db.from('equipamentos').select('tag,validade,bloco').eq('categoria','BEB');
  queryBebs = aplicarFiltroLocalizacaoQuery(queryBebs);
  const { data: bebs } = await fetchAll(() => queryBebs);

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

  let queryEqs = db.from('equipamentos').select('id,categoria');
  queryEqs = aplicarFiltroLocalizacaoQuery(queryEqs);
  const [{ data: eqs }, { data: fichas }] = await Promise.all([
    fetchAll(() => queryEqs),
    fetchAll(() => db.from('fichas_pmoc').select('equipamento_id')),
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
    fetchAll(() => db.from('fichas_pmoc').select('proxima_manutencao, equipamentos(tag,bloco,produto,categoria)')
      .not('proxima_manutencao','is',null)
      .lte('proxima_manutencao', em30.toISOString().split('T')[0])
      .order('proxima_manutencao', { ascending: true })),
    fetchAll(() => db.from('equipamentos').select('tag,bloco,categoria,produto,validade').not('validade','is',null)),
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
  if (!ficha) { toast('Ficha não encontrada no cache. Recarregue a página.'); return; }
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
  if (error) { toast('Erro ao excluir: ' + error.message, 'erro'); return; }
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
  if (error) { toast('Erro ao excluir: ' + error.message, 'erro'); return; }
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
  if (error) { toast('Erro ao excluir: ' + error.message, 'erro'); return; }
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

// ===================== NAVEGAÇÃO — Central de Impressões =====================
// Insere o item "🖨️ Central de Impressões" na sidebar de todas as páginas, logo após
// "Programação PMOC", sem precisar editar o HTML de cada uma. Marca o item como ativo
// quando a página corrente for impressoes.html.
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.sidebar nav');
  if (!nav || nav.querySelector('[data-nav="impressoes"]')) return;

  const item = document.createElement('div');
  item.className = 'nav-item';
  item.dataset.nav = 'impressoes';
  item.setAttribute('onclick', "location.href='impressoes.html'");
  item.innerHTML = '<span>🖨️</span> Central de Impressões';
  if (location.pathname.endsWith('impressoes.html')) {
    item.classList.add('active');
    nav.querySelectorAll('.nav-item.active').forEach(el => {
      if (el !== item) el.classList.remove('active');
    });
  }

  const ancora = Array.from(nav.querySelectorAll('.nav-item'))
    .find(el => (el.getAttribute('onclick') || '').includes('programacao-pmoc.html'));

  if (ancora) ancora.insertAdjacentElement('afterend', item);
  else nav.appendChild(item);
});
