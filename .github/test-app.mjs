#!/usr/bin/env node
/* O app.js NO BROWSER DE QUEM VISITA, e o prerender.py no HTML congelado: o
 * que o painel deixa o cliente apagar ou trocar tem de sair (ou mudar) dos
 * dois lados da mesma maneira. (Da bateria da PokeAuto.)
 *
 * Corre em local, NÃO no CI (como a .github/test-guardas.mjs):
 *
 *     node .github/test-app.mjs
 *
 * O app.js é um script do browser, sem módulos: tira-se dele (pelo texto) a
 * função aplicarTexto e a applyHead, e corre-se com um DOM de faz-de-conta — o
 * que elas fazem é só textContent e hidden. Precisa de um python3
 * (PYTHON=<outro> para escolher) para comparar com o prerender.py.
 *
 * O que prova:
 *   · um texto que o cliente apaga sai do site: vazio — ou só espaços, ou sem a
 *     chave — o nó fica vazio e escondido, e volta quando se escreve
 *     (aplicarTexto: os [data-site], e a etiqueta e o subtítulo das secções);
 *   · o app.js e o prerender.py dizem o mesmo, caso a caso (aplicar_site e
 *     aplicar_cabecalhos);
 *   · o título de uma secção apagado fica como estava (o painel não o grava);
 *   · a fotografia do topo e a da faixa das empresas: trocada no backoffice,
 *     muda também no HTML congelado, sem o srcset da antiga e com as
 *     dimensões da nova; a mesma fica tal e qual;
 *   · o WhatsApp dos catálogos e do formulário segue o telefone do site.json
 *     (nenhum número escrito à mão fora do TEL_WA);
 *   · a ficha de um modelo só tem as linhas com valor. */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PYTHON = process.env.PYTHON || 'python3';
let falhas = 0; let certas = 0;
const certo = (cond, msg, extra = '') => { if (cond) certas++; else { falhas++; console.log(`  ✗ ${msg}${extra !== '' ? `  — ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`); } };
const parte = (t) => console.log(`\n${t}`);
const python = (codigo, entrada) => JSON.parse(execFileSync(PYTHON, ['-c', [
  'import html, json, re, sys',
  `sys.path.insert(0, ${JSON.stringify(join(RAIZ, '.github', 'scripts'))})`,
  'import prerender',
  codigo,
].join('\n')], { input: JSON.stringify(entrada), encoding: 'utf8' }));

const app = readFileSync(join(RAIZ, 'assets/js/app.js'), 'utf8');
const fonteTexto = /\n {2}function aplicarTexto\(n, v\) \{\n[\s\S]*?\n {2}\}\n/.exec(app)?.[0] ?? null;
const fonteHead = /\n {2}function applyHead\(scope, head\) \{\n[\s\S]*?\n {2}\}\n/.exec(app)?.[0] ?? null;

parte('o app.js: um texto que o cliente apaga sai do site');
certo(Boolean(fonteTexto), 'o app.js tem a função aplicarTexto (uma regra só, para os [data-site] e para os cabeçalhos)');
certo(Boolean(fonteHead), 'e a applyHead');
if (!fonteTexto || !fonteHead) { console.log(`\nFALHOU: ${falhas} de ${falhas + certas}`); process.exit(1); }
const { aplicarTexto, applyHead } = new Function(`${fonteTexto}${fonteHead}\nreturn { aplicarTexto: aplicarTexto, applyHead: applyHead };`)();
/* Um nó como os do browser: o textContent guarda sempre texto (0 passa a «0»). */
const no = (t = 'antigo') => { let x = String(t); return { get textContent() { return x; }, set textContent(v) { x = String(v); }, hidden: false }; };
const CASOS = [
  { nome: 'sem a chave', ausente: true, deve: { escondido: true, texto: '' } },
  { nome: 'null', valor: null, deve: { escondido: true, texto: '' } },
  { nome: 'vazio', valor: '', deve: { escondido: true, texto: '' } },
  { nome: 'só espaços', valor: '   ', deve: { escondido: true, texto: '' } },
  { nome: 'com texto', valor: 'Texto novo', deve: { escondido: false, texto: 'Texto novo' } },
  { nome: 'com < e &', valor: 'T-shirts & sweats < 10€', deve: { escondido: false, texto: 'T-shirts & sweats < 10€' } },
  { nome: 'um número', valor: 0, deve: { escondido: false, texto: '0' } },
];
const doApp = CASOS.map((c) => { const n = no(); aplicarTexto(n, c.ausente ? undefined : c.valor); return { escondido: n.hidden, texto: n.textContent }; });
CASOS.forEach((c, i) => certo(JSON.stringify(doApp[i]) === JSON.stringify(c.deve), `${c.nome}: ${c.deve.escondido ? 'escondido e vazio' : `aparece «${c.deve.texto}»`}`, doApp[i]));
{
  const n = no(); aplicarTexto(n, ''); aplicarTexto(n, 'Voltou.');
  certo(n.hidden === false && n.textContent === 'Voltou.', 'apagado e escrito outra vez: volta a aparecer');
}
certo(/doc\.querySelectorAll\('\[data-site\]'\)\.forEach\(function \(el\) \{ aplicarTexto\(el, val\(el\.getAttribute\('data-site'\)\)\); \}\);/.test(app),
  'os [data-site] passam todos pela aplicarTexto');

parte('o app.js e o prerender.py dizem o mesmo (o ecrã e o HTML congelado)');
{
  let doPy = null;
  try {
    doPy = python([
      'out = []',
      'for c in json.loads(sys.stdin.read()):',
      '    hero = {} if c.get("ausente") else {"badge": c.get("valor")}',
      '    novo, _ = prerender.aplicar_site(\'<span class="hero__badge" data-site="hero.badge">antigo</span>\', {"hero": hero, "contacts": {}})',
      '    m = re.match(r\'^<span class="hero__badge" data-site="hero\\.badge"( hidden)?>(.*)</span>$\', novo, re.S)',
      '    out.append({"escondido": bool(m and m.group(1)), "texto": html.unescape(m.group(2)) if m else novo})',
      'print(json.dumps(out, ensure_ascii=False))',
    ].join('\n'), CASOS);
  } catch (e) { console.log(`  (o python não correu: ${String(e.message).split('\n')[0]})`); }
  if (!doPy) certo(false, 'a comparação com o prerender.py precisa de um python3');
  else {
    const mal = CASOS.map((c, i) => [c, doPy[i], doApp[i]]).filter(([, p, a]) => JSON.stringify(p) !== JSON.stringify(a));
    certo(!mal.length, `em ${CASOS.length} casos, o HTML congelado (aplicar_site) é o que o app.js mostra`, mal.map(([c, p, a]) => `${c.nome}: py ${JSON.stringify(p)} app ${JSON.stringify(a)}`).join(' | '));
  }
  const volta = python([
    'h = \'<span data-site="hero.badge" hidden></span>\'',
    'novo, _ = prerender.aplicar_site(h, {"hero": {"badge": "✦ Produtos únicos"}, "contacts": {}})',
    'print(json.dumps(novo, ensure_ascii=False))',
  ].join('\n'), null);
  certo(volta === '<span data-site="hero.badge">✦ Produtos únicos</span>', 'no HTML congelado, escrito outra vez: o hidden sai e o texto volta', volta);
}

parte('os títulos das secções: o app.js (applyHead) e o prerender.py (aplicar_cabecalhos)');
{
  const seccao = ({ eyebrow = 'Etiqueta de antes', title = 'Título de antes', lead = 'Subtítulo de antes', semLead = false } = {}) => {
    const partes = { '.eyebrow': no(eyebrow), '.section-title': no(title), ...(semLead ? {} : { '.section-lead': no(lead) }) };
    return { partes, querySelector: (s) => partes[s] ?? null };
  };
  const ver = (s) => Object.fromEntries(Object.entries(s.partes).map(([k, n]) => [k, n.hidden ? '(escondido)' : n.textContent]));
  const s = seccao();
  applyHead(s, { eyebrow: '', title: '', lead: '  ' });
  const v = ver(s);
  certo(v['.eyebrow'] === '(escondido)' && v['.section-lead'] === '(escondido)', 'a etiqueta e o subtítulo apagados escondem-se', v);
  certo(v['.section-title'] === 'Título de antes', 'o título apagado fica como estava (o painel não o grava vazio)', v);
  applyHead(s, { eyebrow: 'Trabalhos', title: 'Feito para quem quer destacar-se', lead: 'Voltou.' });
  const w = ver(s);
  certo(w['.eyebrow'] === 'Trabalhos' && w['.section-title'] === 'Feito para quem quer destacar-se' && w['.section-lead'] === 'Voltou.', 'escritos outra vez, voltam', w);
  const sem = seccao({ semLead: true });
  applyHead(sem, { eyebrow: 'Como funciona', title: 'Da ideia ao produto' });
  certo(ver(sem)['.section-title'] === 'Da ideia ao produto', 'uma secção sem subtítulo no HTML (Como funciona, Perguntas frequentes) não rebenta', ver(sem));
  const antes = JSON.stringify(ver(seccao()));
  const t = seccao(); applyHead(t, undefined); applyHead(t, null);
  certo(JSON.stringify(ver(t)) === antes, 'um head que não chegou (o ficheiro não abriu) não mexe em nada');

  /* O mesmo no prerender.py, numa página com duas secções e os dados numa pasta. */
  const r = python([
    'import tempfile, os',
    'casos = json.loads(sys.stdin.read())',
    'out = []',
    'for head in casos:',
    '    d = tempfile.mkdtemp()',
    '    os.makedirs(os.path.join(d, "data"))',
    '    json.dump({"head": head, "services": []}, open(os.path.join(d, "data", "services.json"), "w"))',
    '    for f in ["gallery.json", "models.json", "rigidos.json", "lonas.json", "steps.json", "faq.json", "site.json"]: json.dump({}, open(os.path.join(d, "data", f), "w"))',
    '    pag = \'<section id="servicos"><span class="eyebrow">Etiqueta de antes</span><h2 class="section-title">Título de antes</h2><p class="section-lead">Subtítulo de antes</p></section><section id="trabalhos"><span class="eyebrow">Trabalhos</span></section>\'',
    '    novo, n = prerender.aplicar_cabecalhos(pag, d)',
    '    out.append(novo)',
    'print(json.dumps(out, ensure_ascii=False))',
  ].join('\n'), [{ eyebrow: '', title: '', lead: '  ' }, { eyebrow: 'O que fazemos', title: 'Personalizamos quase tudo', lead: 'Voltou.' }]);
  certo(r[0] === '<section id="servicos"><span class="eyebrow" hidden></span><h2 class="section-title">Título de antes</h2><p class="section-lead" hidden></p></section><section id="trabalhos"><span class="eyebrow">Trabalhos</span></section>',
    'no HTML congelado: a etiqueta e o subtítulo apagados ficam vazios e escondidos, o título fica, a secção de baixo não se toca', r[0]);
  certo(r[1] === '<section id="servicos"><span class="eyebrow">O que fazemos</span><h2 class="section-title">Personalizamos quase tudo</h2><p class="section-lead">Voltou.</p></section><section id="trabalhos"><span class="eyebrow">Trabalhos</span></section>',
    'e escritos, voltam (sem o hidden)', r[1]);
}

parte('a fotografia do topo e a da faixa das empresas, no HTML congelado');
{
  const pagina = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  const heroImg = /<img[^>]*data-site-src="hero\.image"[^>]*>/.exec(pagina)?.[0];
  const b2bImg = /<img[^>]*data-site-src="b2b\.image"[^>]*>/.exec(pagina)?.[0];
  certo(Boolean(heroImg) && Boolean(b2bImg), 'as duas fotografias são [data-site-src] no index.html (a da faixa também, e não só pelo id)');
  const r = python([
    'c = json.loads(sys.stdin.read())',
    'dims = {"assets/img/trabalhos/nova-1a2b3c4d.jpg": [1080, 1350]}',
    'mesma, _ = prerender.aplicar_site(c["hero"], {"hero": {"image": "assets/img/trabalhos/hero-hoodie-douro.webp"}, "contacts": {}}, dims)',
    'outra, n = prerender.aplicar_site(c["hero"], {"hero": {"image": "/assets/img/trabalhos/nova-1a2b3c4d.jpg"}, "contacts": {}}, dims)',
    'vazia, _ = prerender.aplicar_site(c["hero"], {"hero": {"image": ""}, "contacts": {}}, dims)',
    'b2b, _ = prerender.aplicar_site(c["b2b"], {"b2b": {"image": "assets/img/trabalhos/nova-1a2b3c4d.jpg"}, "contacts": {}}, dims)',
    'print(json.dumps({"mesma": mesma, "outra": outra, "n": n, "vazia": vazia, "b2b": b2b}))',
  ].join('\n'), { hero: heroImg, b2b: b2bImg });
  certo(r.mesma === heroImg, 'a mesma fotografia: a tag fica tal e qual (com o srcset das versões feitas à mão)');
  certo(/ src="assets\/img\/trabalhos\/nova-1a2b3c4d\.jpg"/.test(r.outra) && !/srcset=|sizes=/.test(r.outra) && / width="1080"/.test(r.outra) && / height="1350"/.test(r.outra) && r.n['data-site-src'] === 1,
    'outra fotografia: o src novo (sem a barra do princípio), sem o srcset e o sizes da antiga, e as dimensões da nova', r.outra);
  certo(r.vazia === heroImg, 'sem fotografia nos dados: fica a que lá estava (o painel não grava o topo sem fotografia)');
  certo(/ src="assets\/img\/trabalhos\/nova-1a2b3c4d\.jpg"/.test(r.b2b) && / width="1080"/.test(r.b2b) && / height="1350"/.test(r.b2b), 'a da faixa das empresas também', r.b2b);
  certo(!/getElementById\('b2b-img'\)/.test(app), 'o app.js já não troca a da faixa à parte (é um [data-site-src] como a do topo)');
}

parte('o WhatsApp segue o telefone do site.json');
{
  const numeros = app.match(/351\d{9}/g) ?? [];
  certo(numeros.length === 1 && /var TEL_WA = '351932938467';/.test(app), `o número só está escrito à mão no TEL_WA, o valor até o site.json chegar (${numeros.length} vezes no app.js)`);
  certo(/if \(c\.phone_intl\) TEL_WA = String\(c\.phone_intl\);/.test(app), 'o site.json muda o TEL_WA');
  certo((app.match(/waCom\(/g) ?? []).length >= 4, 'os botões dos modelos e dos artigos e o formulário usam o waCom');
  const { waCom, mudar } = new Function(`${/\n {2}var TEL_WA = [^\n]*\n {2}function waCom\(texto\) \{[^\n]*\}\n/.exec(app)?.[0] ?? ''}\nreturn { waCom: waCom, mudar: function (t) { TEL_WA = t; } };`)();
  certo(waCom('Olá & tal') === 'https://wa.me/351932938467?text=Ol%C3%A1%20%26%20tal', 'o endereço leva o texto codificado', waCom('Olá & tal'));
  mudar('351912345678');
  certo(waCom('x') === 'https://wa.me/351912345678?text=x', 'com outro telefone, o endereço muda');
}

parte('a ficha de um modelo só tem as linhas com valor');
{
  const fonte = /\n {4}function temTexto\(v\) \{[^\n]*\}\n {4}function linhasDoModelo\(m\) \{\n[\s\S]*?\n {4}\}\n/.exec(app)?.[0];
  certo(Boolean(fonte), 'o app.js tem a linhasDoModelo');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const { linhasDoModelo } = new Function('esc', `${fonte}\nreturn { linhasDoModelo: linhasDoModelo };`)(esc);
  const cheio = linhasDoModelo({ gsm: '150 g/m²', fabric: '100% algodão', sizes: 'XS–5XL', colors: 41 });
  certo(cheio === '<li><span>Gramagem</span><b>150 g/m²</b></li><li><span>Tecido</span><b>100% algodão</b></li><li><span>Tamanhos</span><b>XS–5XL</b></li><li><span>Cores</span><b>41 disponíveis</b></li>',
    'com tudo, as quatro linhas de sempre', cheio);
  const meio = linhasDoModelo({ gsm: '', fabric: 'Canvas', sizes_label: 'Capacidade', sizes: '8 L', colors: '' });
  certo(meio === '<li><span>Tecido</span><b>Canvas</b></li><li><span>Capacidade</span><b>8 L</b></li>', 'sem a gramagem nem as cores, só as outras (e o nome do 3.º campo, se houver)', meio);
  certo(linhasDoModelo({ colors: 1 }) === '<li><span>Cores</span><b>1 disponível</b></li>', 'uma cor: «1 disponível»');
}

console.log(`\n${falhas ? `FALHOU: ${falhas} de ${falhas + certas}` : `tudo certo: ${certas} afirmações`}`);
process.exitCode = falhas ? 1 : 0;
