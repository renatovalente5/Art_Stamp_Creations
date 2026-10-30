#!/usr/bin/env node
/* A BATERIA DA GUARDA DO CONTEÚDO (do molde da PokeAuto, da AMMA Creative e da
 * LR Motors).
 *
 * Corre em local, NÃO no CI: afirma coisas sobre os dados de HOJE, e um
 * trabalho mal preenchido não pode parar a publicação por causa de um teste.
 *
 *     node .github/test-guardas.mjs
 *
 * O repositório não se toca: cada caso corre numa cópia dos dados numa pasta
 * temporária.
 *
 * O que prova:
 *   · regras.mjs é ES module puro (corre no browser e no Worker do painel:
 *     nada de node:, process ou require);
 *   · os dados de hoje passam sem nada que pare; cada ficheiro sai do
 *     serializar() byte a byte, com a sua terminação (é assim que o painel os
 *     grava: um «Gravar» não reescreve o ficheiro inteiro);
 *   · o que as regras sabem do app.js é o que o app.js faz: os desenhos dos
 *     serviços, as categorias do Catálogo Têxtil, os ficheiros que ele lê;
 *   · as bibliotecas das fotografias: os originais directamente na pasta, as
 *     versões leves (webp/) e as feitas à mão fora; apagar leva as versões;
 *   · cada «bloqueia» que importa tem um caso, com a classe e o ecrã certos, e
 *     os avisos do painel (fotografia em falta, categoria fora da lista…);
 *   · a guarda: 0 com os dados de hoje, 1 com um «bloqueia» (e a anotação
 *     ::error), 2 com uma chamada errada; numa cópia em /tmp corre na mesma
 *     (o caminho real); nenhum dado abre um comando do runner;
 *   · o prerender.yml: a guarda corre antes de tudo o que lê os dados, os
 *     `paths` do push incluem as regras e a guarda, e há workflow_dispatch (o
 *     «Publicar outra vez» do painel). */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as R from './regras.mjs';
import { conferir, anotacoes } from './guardas.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0; let certas = 0;
const certo = (cond, msg) => { if (cond) certas++; else { falhas++; console.log(`  ✗ ${msg}`); } };
const parte = (t) => console.log(`\n${t}`);

/* ------------------------------------------------ 1. o módulo é puro -- */
parte('regras.mjs é ES module puro');
const fonte = readFileSync(join(RAIZ, '.github/regras.mjs'), 'utf8');
certo(!/\bfrom\s+['"]node:/.test(fonte) && !/\brequire\s*\(/.test(fonte) && !/\bprocess\./.test(fonte), 'regras.mjs não importa node:, nem usa require ou process');
certo(!/^\s*import\s/m.test(fonte), 'regras.mjs não importa nada (o painel copia-o sozinho)');
/* As ferramentas de edição trocam alguns escapes (\u2028…) pelo próprio
   carácter, e um separador de linha literal numa expressão regular parte o
   ficheiro no browser (memória bytes-de-controlo-no-codigo). */
certo(!/[\u2028\u2029\u0085\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]/.test(fonte), 'regras.mjs não tem espaços estranhos escritos tal e qual (só os escapes)');

/* --------------------------------------------- 2. os dados de hoje -- */
parte('os dados de hoje');
const hoje = conferir(RAIZ);
const bloq = hoje.lista.filter((p) => p.classe === 'bloqueia');
const avisos = hoje.lista.filter((p) => p.classe === 'avisa' && !p.lembrete);
certo(!bloq.length, `nada pára a publicação (${bloq.map((p) => p.mensagem).join(' | ')})`);
certo(!avisos.length, `nenhum aviso que o painel recusasse (${avisos.map((p) => `${p.ecra}: ${p.mensagem}`).join(' | ')})`);
for (const f of R.ORDEM) {
  const t = readFileSync(join(RAIZ, R.FICHEIROS[f]), 'utf8');
  certo(R.serializar(JSON.parse(t), R.terminacaoDe(t)) === t, `${R.FICHEIROS[f]} sai do serializar() byte a byte`);
}
console.log(`  ${hoje.lista.length} problema(s) hoje: ${hoje.lista.map((p) => p.ecra).join(', ') || 'nenhum'}`);

/* --------------------------- 2b. o que as regras sabem do app.js -- */
parte('o que as regras sabem do app.js é o que o app.js faz');
{
  const app = readFileSync(join(RAIZ, 'assets/js/app.js'), 'utf8');
  for (const nome of Object.keys(R.ICONES)) {
    const linha = app.split('\n').find((l) => l.startsWith(`    ${nome}: '<svg`));
    const corpo = linha && /<svg viewBox="0 0 24 24" ' \+ S \+ '>(.*)<\/svg>'/.exec(linha)?.[1];
    certo(corpo === R.svgDoIcone(nome).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''), `o desenho «${nome}» é o do app.js`);
  }
  const doApp = [...app.matchAll(/^ {4}([a-z]+): '<svg/gm)].map((m) => m[1]);
  certo(doApp.join() === Object.keys(R.ICONES).join(), `os mesmos desenhos, pela mesma ordem (${doApp.join(', ')})`);
  certo(/var S = 'fill="none" stroke="currentColor" stroke-width="1\.7" stroke-linecap="round" stroke-linejoin="round"';/.test(app), 'o traço é o do svgDoIcone');
  const cat = /var CAT_ORDER = (\[[^\]]*\]);/.exec(app)?.[1];
  certo(cat && JSON.stringify(JSON.parse(cat.replace(/'/g, '"'))) === JSON.stringify([R.TODOS, ...R.CATEGORIAS_MODELOS]), `as categorias do Catálogo Têxtil são as do filtro do app.js (${cat})`);
  for (const f of R.ORDEM) certo(app.includes(`'${R.FICHEIROS[f]}'`) || app.includes(`json: '${R.FICHEIROS[f]}'`), `o app.js lê ${R.FICHEIROS[f]}`);
  for (const [f, k] of Object.entries(R.LISTAS)) certo(new RegExp(`\\(d && d\\.${k}\\) \\|\\| \\[\\]|d\\.${k}`).test(app), `a lista de ${f} é «${k}» no app.js`);
  const pre = readFileSync(join(RAIZ, '.github/scripts/prerender.py'), 'utf8');
  certo(/s\['title'\]/.test(pre) && /q\['q'\]/.test(pre) && /q\['a'\]/.test(pre), 'o prerender.py lê s[\'title\'], q[\'q\'] e q[\'a\'] (o que as regras param quando falta a chave)');
  const webp = readFileSync(join(RAIZ, '.github/scripts/webp.py'), 'utf8');
  certo(/^PASTAS = \['trabalhos'\]$/m.test(webp) && R.BIBLIOTECAS.trabalhos.variantes === 'assets/img/trabalhos/webp', 'o webp.py só faz versões leves dos trabalhos, na pasta webp/ (as regras sabem onde)');
}

/* ------------------------------------- 2c. as bibliotecas das fotografias -- */
parte('as bibliotecas das fotografias');
{
  certo(R.bibliotecaDe('assets/img/trabalhos/hoodie-1a2b3c4d.jpg') === 'trabalhos', 'um original dos trabalhos vive directamente em trabalhos/');
  certo(['assets/img/trabalhos/webp/hoodie-1a2b3c4d-480.webp', 'assets/img/trabalhos/hero-hoodie-douro-760.webp', 'assets/img/logo.png', 'assets/img/og.jpg', 'assets/img/trabalhos/notas.txt'].every((c) => R.bibliotecaDe(c) === null),
    'as versões leves, a do topo feita à mão, o logótipo e o cartão de partilha não são da biblioteca');
  certo(R.bibliotecaDe('assets/img/rigidos/caneca-1.jpg') === 'rigidos' && R.bibliotecaDe('assets/img/modelos/luanda.jpg') === 'modelos' && R.bibliotecaDe('assets/img/lonas/rollup.jpg') === 'lonas', 'os catálogos têm cada um a sua pasta');
  const O = 'assets/img/trabalhos/hero-hoodie-douro.webp';
  certo(R.aApagarCom(O, [O, 'assets/img/trabalhos/hero-hoodie-douro-760.webp', 'assets/img/trabalhos/hero-hoodie-douro-2.jpg']).join() === [O, 'assets/img/trabalhos/hero-hoodie-douro-760.webp'].join(), 'apagar leva a versão feita à mão (e não um original parecido)');
  const J = 'assets/img/trabalhos/caneca-1a2b3c4d.jpg';
  certo(R.aApagarCom(J, [J, 'assets/img/trabalhos/webp/caneca-1a2b3c4d-480.webp', 'assets/img/trabalhos/webp/caneca-1a2b3c4d-760.webp', 'assets/img/trabalhos/webp/caneca-1a2b3c4d-2-480.webp']).join() === [J, 'assets/img/trabalhos/webp/caneca-1a2b3c4d-480.webp', 'assets/img/trabalhos/webp/caneca-1a2b3c4d-760.webp'].join(), 'apagar leva as versões do webp.py');
  const fixas = R.fotografiasFixas(readFileSync(join(RAIZ, 'index.html'), 'utf8'));
  certo(R.usosDe(O, [], fixas).length === 1, 'a fotografia do topo escrita no index.html conta como usada (não se apaga)');
  const dados = {}; for (const f of R.ORDEM) dados[f] = readFileSync(join(RAIZ, R.FICHEIROS[f]), 'utf8');
  const usados = R.fotografiasDosDados(dados);
  certo(usados.length > 90 && usados.every((u) => existsSync(join(RAIZ, R.noRepositorio(u.valor)))), `as ${usados.length} fotografias dos dados existem`);
  certo(R.usosDe('assets/img/rigidos/caneca-1.jpg', usados).some((u) => u.ecra === 'Catálogo Rígidos › Caneca'), 'uma fotografia de um artigo diz onde é usada');
  const doTopo = R.usosDe(O, usados, fixas);
  certo(doTopo.length === 1 && doTopo[0].ecra === 'Página › Topo da página', 'a do topo, nos dados e no index.html, diz-se uma vez: no ecrã onde se muda', doTopo);
  const daResposta = (x) => R.problemasDasPerguntas({ items: [{ q: 'Fazem envios?', ...x }] }).filter((p) => /:a:/.test(p.chave));
  certo(daResposta({}).map((p) => `${p.classe} ${p.chave.split(':').pop()}`).join() === 'bloqueia falta' && daResposta({ a: 3 }).map((p) => `${p.classe} ${p.chave.split(':').pop()}`).join() === 'bloqueia tipo',
    'uma resposta em falta, ou escrita como número, diz-se uma vez só (sem o aviso do «vazio» por cima)', [daResposta({}), daResposta({ a: 3 })]);
  const longo = R.nomeDeItem('gallery', { cap: `Caneca ${'personalizada '.repeat(12)}` }, 0);
  certo([...longo].length <= 58 && longo.endsWith('…') && longo.startsWith('Caneca personalizada') && R.nomeDeItem('gallery', { cap: 'Caneca' }, 0) === 'Caneca',
    'o nome de um item com uma legenda comprida corta-se (é para se reconhecer)', longo);
}

/* ----------------------------------------------- 3. os casos -- */
const tmp = mkdtempSync(join(tmpdir(), 'artstamp-guardas-'));
try {
  parte('os casos que param a publicação, e os avisos do painel');
  const copia = join(tmp, 'site');
  const reporCopia = () => {
    rmSync(copia, { recursive: true, force: true });
    mkdirSync(copia, { recursive: true });
    cpSync(join(RAIZ, 'data'), join(copia, 'data'), { recursive: true });
    cpSync(join(RAIZ, 'assets', 'img'), join(copia, 'assets', 'img'), { recursive: true });
  };
  const ler = (f) => JSON.parse(readFileSync(join(copia, R.FICHEIROS[f]), 'utf8'));
  const escrever = (f, o) => writeFileSync(join(copia, R.FICHEIROS[f]), typeof o === 'string' ? o : R.serializar(o, '\n'));
  const caso = (nome, mexer, { ecra, classe = 'bloqueia', chave = null, lembrete = false } = {}) => {
    reporCopia();
    mexer();
    const { lista } = conferir(copia);
    const achado = lista.find((p) => p.classe === classe && Boolean(p.lembrete) === lembrete && (!ecra || String(p.ecra).startsWith(ecra)) && (!chave || String(p.chave).includes(chave)));
    certo(Boolean(achado), `${nome} → ${classe}${lembrete ? ' (lembrete)' : ''}${ecra ? ` em «${ecra}»` : ''}${achado ? '' : ` (deu: ${lista.map((p) => `${p.classe}:${p.chave}`).join(', ') || 'nada'})`}`);
    return lista;
  };
  caso('um ficheiro de dados apagado', () => rmSync(join(copia, R.FICHEIROS.faq)), { ecra: R.ECRAS.faq, chave: 'ficheiro:falta' });
  caso('um JSON partido', () => escrever('gallery', '{ "items": [ '), { ecra: R.ECRAS.gallery, chave: 'ficheiro:json' });
  caso('a lista da galeria com outra forma', () => { const o = ler('gallery'); o.items = 'nada'; escrever('gallery', o); }, { ecra: R.ECRAS.gallery, chave: 'items:forma' });
  caso('um trabalho que não é um objecto', () => { const o = ler('gallery'); o.items[3] = 'x.jpg'; escrever('gallery', o); }, { ecra: R.ECRAS.gallery, chave: ':forma' });
  caso('um serviço sem o campo do nome', () => { const o = ler('services'); delete o.services[0].title; escrever('services', o); }, { ecra: R.ECRAS.services, chave: 'title:falta' });
  caso('uma pergunta sem o campo da resposta', () => { const o = ler('faq'); delete o.items[0].a; escrever('faq', o); }, { ecra: R.ECRAS.faq, chave: 'a:falta' });
  caso('as características de um artigo que não são uma lista', () => { const o = ler('rigidos'); o.products[0].specs = { Material: 'Cerâmica' }; escrever('rigidos', o); }, { ecra: R.ECRAS.rigidos, chave: 'specs:forma' });
  caso('a morada (rua) vazia', () => { const o = ler('site'); o.contacts.address_line1 = ''; escrever('site', o); }, { ecra: 'Página › Contactos', chave: 'address_line1:vazio' });
  caso('o código postal sem código postal', () => { const o = ler('site'); o.contacts.address_line2 = 'Vizela'; escrever('site', o); }, { ecra: 'Página › Contactos', chave: 'address_line2:forma' });
  caso('sem telefone e sem email', () => { const o = ler('site'); o.contacts.phone = ''; o.contacts.email = ''; escrever('site', o); }, { ecra: 'Página › Contactos', chave: 'sem_contacto' });
  caso('o número internacional escrito como número', () => { const o = ler('site'); o.contacts.phone_intl = 351932938467; escrever('site', o); }, { ecra: 'Página › Contactos', chave: 'phone_intl:tipo-ci' });
  caso('uma hora que o prerender.py não lê', () => { const o = ler('site'); o.hours = [{ days: ['Monday'], opens: '9h', closes: '19:00' }]; escrever('site', o); }, { ecra: 'Página › Horário', chave: 'opens:forma' });
  caso('uma fotografia de um trabalho que já não existe', () => { const o = ler('gallery'); o.items[0].img = 'assets/img/trabalhos/nao-existe.jpg'; escrever('gallery', o); }, { classe: 'avisa', ecra: 'Trabalhos › Hoodie com estampagem DTF', chave: 'img:falta' });
  caso('um trabalho sem fotografia', () => { const o = ler('gallery'); o.items[0].img = ''; escrever('gallery', o); }, { classe: 'avisa', chave: 'img:vazia' });
  caso('um trabalho sem legenda', () => { const o = ler('gallery'); o.items[0].cap = ''; escrever('gallery', o); }, { classe: 'avisa', lembrete: true, chave: 'cap:vazia' });
  caso('um desenho de serviço que não existe', () => { const o = ler('services'); o.services[0].icon = 'camisola'; escrever('services', o); }, { classe: 'avisa', ecra: 'Serviços › T-shirts personalizadas', chave: ':icon' });
  caso('um modelo com uma categoria fora da lista', () => { const o = ler('models'); o.models[0].cat = 'Camisolas'; escrever('models', o); }, { classe: 'avisa', ecra: 'Catálogo Têxtil › Luanda', chave: ':cat' });
  caso('o número de cores com texto', () => { const o = ler('models'); o.models[0].colors = 'muitas'; escrever('models', o); }, { classe: 'avisa', chave: ':colors' });
  caso('um artigo com uma categoria que não está nas categorias', () => { const o = ler('lonas'); o.products[0].cat = 'Placas'; escrever('lonas', o); }, { classe: 'avisa', ecra: R.ECRAS.lonas, chave: ':cat' });
  caso('as categorias sem «Todos» à frente', () => { const o = ler('rigidos'); o.cats = o.cats.slice(1); escrever('rigidos', o); }, { classe: 'avisa', ecra: 'Catálogo Rígidos › Categorias', chave: 'cats:todos' });
  caso('um artigo sem fotografias', () => { const o = ler('rigidos'); o.products[0].imgs = []; escrever('rigidos', o); }, { classe: 'avisa', chave: 'imgs:vazia' });
  caso('uma característica por acabar', () => { const o = ler('rigidos'); o.products[0].specs.push({ label: 'Cor', value: '' }); escrever('rigidos', o); }, { classe: 'avisa', chave: 'spec:Cor:vazia' });
  caso('o título de uma secção apagado', () => { const o = ler('steps'); o.head.title = ' '; escrever('steps', o); }, { classe: 'avisa', ecra: 'Como funciona › Títulos da secção', chave: 'head:title:vazio' });
  caso('o título do topo apagado', () => { const o = ler('site'); o.hero.title = ''; escrever('site', o); }, { classe: 'avisa', ecra: 'Página › Topo da página', chave: 'hero:title:vazio' });
  caso('a lista «Para quem» vazia', () => { const o = ler('site'); o.hero.audience = []; escrever('site', o); }, { classe: 'avisa', chave: 'hero:audience:vazia' });
  caso('o telefone com o internacional de outro número', () => { const o = ler('site'); o.contacts.phone = '912 345 678'; escrever('site', o); }, { classe: 'avisa', chave: 'phone_intl:outro' });
  caso('o email apagado', () => { const o = ler('site'); o.contacts.email = ''; escrever('site', o); }, { classe: 'avisa', lembrete: true, chave: 'email:vazio' });
  caso('o nome do titular apagado', () => { const o = ler('site'); o.owner_name = ''; escrever('site', o); }, { classe: 'avisa', ecra: 'Página › Dados legais', chave: 'owner_name:vazio' });
  {
    reporCopia();
    const o = ler('site'); o.hero.eyebrow = ''; o.hero.badge = ''; o.footer_tagline = ''; escrever('site', o);
    const g = ler('gallery'); g.head.eyebrow = ''; g.head.lead = ''; escrever('gallery', g);
    const { lista } = conferir(copia);
    certo(!lista.length, `a etiqueta, o selo, a frase do rodapé e o subtítulo apagados não são problema: saem do site (${lista.map((p) => p.chave).join(', ')})`);
  }
  {
    /* Um problema antigo não muda de chave quando se junta um item no topo. */
    reporCopia();
    const g = ler('gallery'); g.items[5].img = 'assets/img/trabalhos/nao-existe.jpg'; escrever('gallery', g);
    const antes = conferir(copia).lista.map((p) => p.chave);
    g.items.unshift({ img: 'assets/img/trabalhos/merchandising.jpg', cap: 'Novo' }); escrever('gallery', g);
    const depois = conferir(copia).lista.map((p) => p.chave);
    certo(antes.length === 1 && depois.includes(antes[0]), `a chave de um problema não leva a posição (${antes} → ${depois})`);
  }

  /* ------------------------------------------------------- 4. a guarda -- */
  parte('a guarda, chamada como o CI a chama');
  const guarda = (args, env = {}) => spawnSync(process.execPath, [join(RAIZ, '.github/guardas.mjs'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } });
  const r0 = guarda([]);
  certo(r0.status === 0, `com os dados de hoje sai com 0 (saiu ${r0.status}: ${r0.stderr})`);
  certo(!/^::error/m.test(r0.stdout), 'com os dados de hoje não há ::error');
  reporCopia();
  { const o = ler('site'); o.contacts.address_line2 = 'Vizela'; escrever('site', o); }
  const resumo = join(tmp, 'resumo.md'); const rel = join(tmp, 'relatorio.json');
  const r1 = guarda(['--raiz', copia, '--relatorio-em', rel], { GITHUB_STEP_SUMMARY: resumo });
  certo(r1.status === 1, `com um «bloqueia» sai com 1 (saiu ${r1.status})`);
  certo(/^::error file=data\/site\.json,title=Página › Contactos::.*código postal/m.test(r1.stdout), 'e diz porquê numa anotação ::error, com o ficheiro e o ecrã');
  certo(existsSync(resumo) && /A publicação parou/.test(readFileSync(resumo, 'utf8')), 'e escreve o resumo da corrida');
  certo(existsSync(rel) && JSON.parse(readFileSync(rel, 'utf8')).bloqueia >= 1, 'e o relatório');
  certo(guarda(['--raiz']).status === 2, 'uma chamada errada sai com 2');
  certo(guarda(['--raiz', join(tmp, 'nao-existe')]).status === 2, 'uma pasta que não existe sai com 2');
  /* Numa cópia do repositório em /tmp (no Mac, uma ligação para /private/tmp). */
  const emTmp = mkdtempSync('/tmp/artstamp-guarda-');
  try {
    cpSync(join(RAIZ, '.github'), join(emTmp, '.github'), { recursive: true });
    cpSync(copia, emTmp, { recursive: true });
    const r2 = spawnSync(process.execPath, [join(emTmp, '.github/guardas.mjs')], { encoding: 'utf8' });
    certo(r2.status === 1 && /código postal/.test(r2.stdout), `numa cópia em /tmp corre, e pára (saiu ${r2.status})`);
  } finally { rmSync(emTmp, { recursive: true, force: true }); }
  /* Nenhum dado abre um comando do runner. */
  reporCopia();
  { const o = ler('services'); o.services[0].title = 'T-shirts\n::error::falso\r\n##[warning]também falso'; o.services[1].title = ''; escrever('services', o); }
  { const o = ler('site'); o.contacts.address_line2 = 'Vizela %0A::error::x'; escrever('site', o); }
  const r3 = guarda(['--raiz', copia]);
  const comandos = r3.stdout.split('\n').filter((l) => /^\s*::|##\[/.test(l));
  certo(comandos.every((l) => /^::(error|warning|notice) file=/.test(l) || /^::(error|warning|notice) title=Guarda do conteúdo::/.test(l)), `só as anotações da guarda são comandos (${comandos.filter((l) => !/^::(error|warning|notice) (file|title)=/.test(l)).join(' | ')})`);
  certo(!/^::error::falso/m.test(r3.stdout) && !/##\[warning\]/.test(r3.stdout), 'um «::error» ou um «##[warning]» dentro de um texto não chega à consola como comando');
  const ans = anotacoes([{ classe: 'bloqueia', ficheiro: 'data/a,b:c.json', ecra: 'X, Y: Z', mensagem: 'linha 1\nlinha 2 100%' }]);
  certo(ans[0] === '::error file=data/a%2Cb%3Ac.json,title=X%2C Y%3A Z::linha 1%0Alinha 2 100%25', `as anotações escapam-se como o GitHub pede (${ans[0]})`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/* ---------------------------------------------------- 5. o prerender.yml -- */
parte('o prerender.yml');
const yml = readFileSync(join(RAIZ, '.github/workflows/prerender.yml'), 'utf8');
const passos = [...yml.matchAll(/^ {6}- (?:name: (.+)|uses: (\S+))$/gm)].map((m) => m[1] ?? `uses ${m[2]}`);
const i = (n) => passos.findIndex((p) => p === n);
certo(i('Conferir o conteúdo') > 0, 'há o passo «Conferir o conteúdo»');
for (const n of ['Escrever as peças legais', 'Converter as fotografias novas para WebP', 'Medir as dimensões das imagens', 'Gerar o HTML estático', 'Publicar se houve alterações']) {
  certo(i(n) > i('Conferir o conteúdo'), `a guarda corre antes de «${n}»`);
}
certo(/node \.github\/guardas\.mjs/.test(yml), 'o passo corre o .github/guardas.mjs');
certo(i('uses actions/setup-node@v4') >= 0 && i('uses actions/setup-node@v4') < i('Conferir o conteúdo'), 'o node prepara-se antes da guarda');
for (const p of ['.github/regras.mjs', '.github/guardas.mjs', '.github/consola.mjs', 'data/**', 'assets/img/**']) certo(yml.includes(`- '${p}'`), `os paths do push incluem ${p}`);
certo(/^ {2}workflow_dispatch:/m.test(yml), 'há workflow_dispatch (o «Publicar outra vez» do painel)');
certo(/concurrency:\s*\n\s+group: prerender\s*\n\s+cancel-in-progress: true/.test(yml), 'a concorrência é a de sempre (a publicação que chega cancela a que está a correr)');
certo(/if: github\.event_name != 'push' \|\| github\.actor != 'github-actions\[bot\]'/.test(yml), 'o commit do robô não volta a disparar a publicação');

console.log(`\n${falhas ? `FALHOU: ${falhas} de ${falhas + certas}` : `tudo certo: ${certas} afirmações`}`);
process.exitCode = falhas ? 1 : 0;
