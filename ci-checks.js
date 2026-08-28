const fs=require('fs'),path=require('path'),cp=require('child_process');
const DIR='/mnt/project';
const htmls=fs.readdirSync(DIR).filter(f=>f.endsWith('.html')).sort();
let falhas=0;
const ok=(n,c)=>{console.log((c?'✅':'❌')+' '+n);if(!c)falhas++;};

// 1 node --check app.js
try{cp.execSync('node --check '+DIR+'/app.js',{stdio:'pipe'});ok('1. node --check app.js',true);}
catch(e){ok('1. node --check app.js',false);console.log(String(e.stderr));}

const RE_INLINE=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const inline={};
for(const f of htmls){const s=fs.readFileSync(path.join(DIR,f),'utf8');const b=[];let m;
  RE_INLINE.lastIndex=0;while((m=RE_INLINE.exec(s)))b.push(m[1]);inline[f]=b;}

// 2 blocos inline
let badBlocks=[];
for(const f of htmls)inline[f].forEach((b,i)=>{try{new Function(b);}catch(e){badBlocks.push(f+'#'+(i+1)+': '+e.message);}});
ok('2. blocos <script> inline válidos ('+htmls.length+' páginas)',badBlocks.length===0);
badBlocks.forEach(x=>console.log('   '+x));

// 3 handlers órfãos
const appSrc=fs.readFileSync(path.join(DIR,'app.js'),'utf8');
const defsDe=src=>{const s=new Set();let m;
  const r1=/function\s+([A-Za-z_$][\w$]*)\s*\(/g;while((m=r1.exec(src)))s.add(m[1]);
  const r2=/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g;while((m=r2.exec(src)))s.add(m[1]);
  const r3=/window\.([A-Za-z_$][\w$]*)\s*=/g;while((m=r3.exec(src)))s.add(m[1]);
  return s;};
const defsApp=defsDe(appSrc);
const topo=src=>{const s=new Set();let m;
  const r1=/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;while((m=r1.exec(src)))s.add(m[1]);
  const r2=/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;while((m=r2.exec(src)))s.add(m[1]);
  return s;};
const topoApp=topo(appSrc);
const GLOBAIS=new Set(['location','window','document','alert','confirm','print','history','this','event','open','parseInt','parseFloat','Math','JSON','console','navigator']);
let orfaos=[];
for(const f of htmls){
  const s=fs.readFileSync(path.join(DIR,f),'utf8');
  const carregaApp=/<script[^>]*src=["']app\.js["']/.test(s);
  const defs=new Set([...(carregaApp?defsApp:[]),...defsDe(inline[f].join('\n'))]);
  let m;const rh=/\son(?:click|change|input|submit|keyup|keydown|blur|focus)\s*=\s*"([^"]*)"/gi;
  while((m=rh.exec(s))){
    let c;const rc=/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    while((c=rc.exec(m[1]))){const n=c[2];
      if(!GLOBAIS.has(n)&&!defs.has(n)&&!/^(location|window|document)\./.test(m[1]))orfaos.push(f+' → '+n+'()');}
  }
}
orfaos=[...new Set(orfaos)];
ok('3. handlers onclick/onchange/oninput sem função definida',orfaos.length===0);
orfaos.forEach(x=>console.log('   '+x));

// 4 colisões app.js x páginas
let colisoes=[];
for(const f of htmls){
  const s=fs.readFileSync(path.join(DIR,f),'utf8');
  if(!/<script[^>]*src=["']app\.js["']/.test(s))continue;
  for(const n of topo(inline[f].join('\n')))if(topoApp.has(n))colisoes.push(f+' redefine '+n);
}
ok('4. funções/constantes redefinidas entre app.js e páginas',colisoes.length===0);
colisoes.forEach(x=>console.log('   '+x));

// 5 IDs duplicados
let dups=[];
for(const f of htmls){const s=fs.readFileSync(path.join(DIR,f),'utf8');const vis={};let m;
  const r=/\sid\s*=\s*["']([^"']+)["']/g;while((m=r.exec(s)))vis[m[1]]=(vis[m[1]]||0)+1;
  Object.entries(vis).filter(([,c])=>c>1).forEach(([k,c])=>dups.push(f+' → #'+k+' ('+c+'x)'));}
ok('5. IDs HTML duplicados por página',dups.length===0);
dups.forEach(x=>console.log('   '+x));

// 6 consistência do menu
const menus={};
for(const f of htmls){const s=fs.readFileSync(path.join(DIR,f),'utf8');
  const nav=(s.match(/<nav[\s\S]*?<\/nav>/)||[''])[0];
  menus[f]=(nav.match(/location\.href='([^']+)'/g)||[]).join('|');}
// Páginas públicas/utilitárias legitimamente não têm o menu do sistema: index (login),
// verificar (QR público) e diagnostico (ferramenta isolada). Comparar só as que têm nav.
const SEM_MENU=new Set(['index.html','verificar.html','diagnostico.html']);
const comMenu=htmls.filter(f=>!SEM_MENU.has(f)&&menus[f]);
const ref=menus[comMenu[0]];const divergentes=comMenu.filter(f=>menus[f]!==ref);
ok('6. consistência dos itens de menu entre as páginas ('+(ref.split('|').length)+' itens, '+comMenu.length+' páginas)',divergentes.length===0);
divergentes.forEach(f=>console.log('   diverge: '+f));

// 7 sincronia do checklist PMOC: defs (app.js) x formulário (pmoc.html) x guia de execução
// AUDITORIA 2026 — este check existe porque 9 itens (AMB-01..04, DUT-01..05) estavam
// declarados no plano e no guia mas NÃO tinham campo no formulário. O laudo os imprimia
// como "N/A" automático, inclusive o DUT-05, cuja marcação NA o item 5.2 do plano veda.
function blocoTopo(src,prefixo){
  const L=src.split('\n');const i=L.findIndex(l=>l.startsWith(prefixo));
  if(i<0)return null;
  for(let j=i+1;j<L.length;j++)if(L[j]==='}'||L[j]==='};'||L[j]===']；'||L[j]==='];')return L.slice(i,j+1).join('\n');
  return null;
}
let sincOK=false,sincMsg='';
try{
  const defsBloco=blocoTopo(appSrc,'const CHECKLIST_PMOC_DEFS');
  const guiaBloco=blocoTopo(appSrc,'const CHECKLIST_EXECUCAO_GUIA');
  const defs=eval('('+defsBloco.replace(/^const CHECKLIST_PMOC_DEFS\s*=\s*/,'').replace(/;$/,'')+')');
  const guia=eval('('+guiaBloco.replace(/^const CHECKLIST_EXECUCAO_GUIA\s*=\s*/,'').replace(/;$/,'')+')');
  const chaves=new Set();
  for(const per of Object.values(defs))for(const arr of Object.values(per))for(const [k] of arr)chaves.add(k);
  const formSrc=fs.readFileSync(path.join(DIR,'pmoc.html'),'utf8');
  const campos=new Set();let mm;const rr=/<input type="radio" name="([a-z]{3}_[0-9]{2})"/g;
  while((mm=rr.exec(formSrc)))campos.add(mm[1]);
  const semCampo=[...chaves].filter(k=>!campos.has(k));
  const semDef=[...campos].filter(k=>!chaves.has(k));
  const semGuia=[...chaves].filter(k=>!(k in guia));
  const guiaOrfa=Object.keys(guia).filter(k=>!chaves.has(k));
  sincOK=!semCampo.length&&!semDef.length&&!semGuia.length&&!guiaOrfa.length;
  sincMsg=`${chaves.size} itens definidos / ${campos.size} campos no formulário / ${Object.keys(guia).length} no guia`;
  if(semCampo.length) console.log('   sem campo no formulário: '+semCampo.join(', '));
  if(semDef.length)   console.log('   campo sem definição: '+semDef.join(', '));
  if(semGuia.length)  console.log('   sem guia de execução: '+semGuia.join(', '));
  if(guiaOrfa.length) console.log('   guia sem item correspondente: '+guiaOrfa.join(', '));
}catch(e){sincMsg='erro ao avaliar: '+e.message;}
ok('7. sincronia checklist PMOC: defs x formulário x guia ('+sincMsg+')',sincOK);

// 8 fontes únicas: constantes que não podem ser redeclaradas como literal fora do app.js
const FONTES_UNICAS=[
  {nome:'ADEQUACAO_TERMICA_PISO',proibido:/const\s+PLANO_ADEQUACAO_MINIMA\s*=\s*0?\.\d+\s*;/,arquivo:'plano-pmoc.html'},
];
let dupConst=[];
for(const c of FONTES_UNICAS){
  const s=fs.readFileSync(path.join(DIR,c.arquivo),'utf8');
  if(c.proibido.test(s))dupConst.push(c.arquivo+' redeclara literal em vez de usar '+c.nome+' (app.js)');
}
ok('8. piso de adequação térmica com fonte única',dupConst.length===0);
dupConst.forEach(x=>console.log('   '+x));

// 9 rotinas de impressão referenciadas por NOME (string) em acaoImpressao('...')
// AUDITORIA 2026 — o check 3 só valida chamadas diretas em onclick. Um botão que faz
// acaoImpressao('emitirX') passa pelo check 3 (acaoImpressao existe) mesmo que emitirX
// não exista em lugar nenhum: o erro só aparece para o usuário em runtime, como alert.
let rotinasFaltando=[];
for(const f of htmls){
  const s=fs.readFileSync(path.join(DIR,f),'utf8');
  const carregaApp=/<script[^>]*src=["']app\.js["']/.test(s);
  const defs=new Set([...(carregaApp?defsApp:[]),...defsDe(inline[f].join('\n'))]);
  let m;const rr=/acaoImpressao\(\s*['"]([A-Za-z_$][\w$]*)['"]\s*\)/g;
  while((m=rr.exec(s)))if(!defs.has(m[1]))rotinasFaltando.push(f+' → '+m[1]+'() não existe');
}
rotinasFaltando=[...new Set(rotinasFaltando)];
ok('9. rotinas de impressão chamadas por nome existem',rotinasFaltando.length===0);
rotinasFaltando.forEach(x=>console.log('   '+x));

console.log('\n'+(falhas?'⚠ '+falhas+' check(s) com falha':'LINHA DE BASE: 9/9 OK'));
process.exit(falhas?1:0);
