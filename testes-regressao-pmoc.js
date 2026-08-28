const fs = require('fs');
const h  = require('/home/claude/testes/harness.js');
let falhas = 0;
const t = (nome, cond, detalhe='') => { console.log((cond?'✅':'❌')+' '+nome+(detalhe?'  → '+detalhe:'')); if(!cond) falhas++; };

console.log('=== TESTES DE REGRESSÃO — pós-correção ===\n');

// --- R1: laudo não pode gerar N/A automático ---
console.log('R1. Laudo PMOC com todos os campos do formulário preenchidos');
const formSrc = fs.readFileSync('/mnt/project/pmoc.html','utf8');
const campos = new Set(); let m;
const re = /<input type="radio" name="([a-z]{3}_[0-9]{2})"/g;
while ((m = re.exec(formSrc))) campos.add(m[1]);
const chk = {}; campos.forEach(k => chk[k] = 'C');
for (const freq of ['Mensal','Trimestral','Semestral','Anual']) {
  const html = h.montarSecoesChecklistPMOC('AC', freq, chk);
  const rows = [...html.matchAll(/<tr><td>(.*?)<\/td><td[^>]*>(.*?)<\/td><\/tr>/g)];
  const na = rows.filter(r => r[2].includes('N/A'));
  t(`   freq ${freq.padEnd(11)} — ${rows.length} itens, ${na.length} N/A automático`, na.length === 0,
    na.map(r=>r[1].match(/\[[A-Z]{3}-\d{2}\]/)?.[0]).join(' '));
}

// --- R2: DUT-05 tem campo próprio ---
console.log('\nR2. Itens que o plano proíbe marcar como NA têm campo no formulário');
['dut_05','dut_01','dut_02','dut_03','dut_04','amb_01','amb_02','amb_03','amb_04']
  .forEach(k => t('   campo presente: '+k, campos.has(k)));

// --- R3: BIO-05 semestral, BIO-06 anual ---
console.log('\nR3. Alinhamento Seção 6 × Anexo I (QAI semestral)');
const AC = h.CHECKLIST_PMOC_DEFS.AC;
t('   BIO-05 (QAI/laudos) está no bloco SEMESTRAL', AC.semestral.some(([k])=>k==='bio_05'));
t('   BIO-05 saiu do bloco anual',                  !AC.anual.some(([k])=>k==='bio_05'));
t('   BIO-06 (higienização completa) está no ANUAL', AC.anual.some(([k])=>k==='bio_06'));

// --- R4: criticidade não é mais destruída na edição ---
console.log('\nR4. Matriz de criticidade — edição de ativo existente');
const appSrc = fs.readFileSync('/mnt/project/app.js','utf8');
t('   respostas persistidas em extras_tecnico.crit_respostas', /extras\.crit_respostas\s*=\s*critRespostas/.test(appSrc));
t('   reidratação chamada ao carregar para edição',            /reidratarCriticidadeFluxograma\(eq\)/.test(appSrc));
t('   ativos legados preservam a classe já gravada',           /CRIT_RESPOSTAS_EQUIVALENTES/.test(appSrc));
const eqHtml = fs.readFileSync('/mnt/project/equipamentos.html','utf8');
t('   rótulo inicial coerente com os defaults (Baixa)',        /label-criticidade-calculada[^>]*>Classe Baixa \(C\)/.test(eqHtml));

// --- R5: validação de plausibilidade ---
console.log('\nR5. Plausibilidade da carga térmica');
const v = (p) => {
  const btu = h.calcularCargaTermicaBTU({incidencia_solar:'sem', cobertura:'laje', ...p});
  return { btu, ...h.validarPlausibilidadeSala({...p, carga_termica_btu: btu}) };
};
let r;
r = v({area_m2:-30, pessoas_previstas:8, equip_watts:500});
t('   área negativa é BLOQUEADA', r.erros.length > 0, r.erros[0]);
r = v({area_m2:0.1, pessoas_previstas:50, equip_watts:500});
t('   densidade absurda gera AVISO', r.avisos.length > 0, r.avisos[0].slice(0,58)+'...');
r = v({area_m2:30, pessoas_previstas:99999, equip_watts:0});
t('   ocupação absurda gera AVISO', r.avisos.length > 0);
r = v({area_m2:30, pessoas_previstas:8, equip_watts:500});
t('   caso normal passa sem erro nem aviso', r.erros.length===0 && r.avisos.length===0, r.btu+' BTU/h');

// --- R6: limiar único ---
console.log('\nR6. Piso de adequação térmica — fonte única');
const cf = h.classificarAdequacaoCarga;
t('   97,0% → Adequada nos dois documentos',  cf(10000, 9700).status === 'Adequada',  cf(10000,9700).status);
t('   95,0% → Subdimensionada nos dois',      cf(10000, 9500).status === 'Subdimensionada', cf(10000,9500).status);
t('   sem AC → Sem climatização',             cf(10000, 0).status === 'Sem climatização');
t('   140%  → Superdimensionada',             cf(10000, 14000).status === 'Superdimensionada');
const planoSrc = fs.readFileSync('/mnt/project/plano-pmoc.html','utf8');
t('   plano-pmoc.html não redeclara o literal', !/const PLANO_ADEQUACAO_MINIMA\s*=\s*0\.96;/.test(planoSrc));

console.log('\n' + (falhas ? '⚠ '+falhas+' teste(s) com falha' : 'TODOS OS TESTES DE REGRESSÃO PASSARAM'));
process.exit(falhas ? 1 : 0);
