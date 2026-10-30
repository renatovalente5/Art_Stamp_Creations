/* AS REGRAS DOS DADOS DA ARTSTAMPCREATIONS, NUM SÓ SÍTIO.
 *
 * Três leitores, e os três têm de ouvir o mesmo:
 *   · o CI do site (.github/guardas.mjs, passo «Conferir o conteúdo» do
 *     prerender.yml), antes de converter as fotografias e de gerar o HTML;
 *   · o painel, no browser (o erro aparece por baixo do campo, antes de gravar);
 *   · o Worker do painel, ao gravar (recusa os problemas NOVOS que não sejam
 *     lembretes).
 * O painel usa uma CÓPIA BYTE A BYTE deste ficheiro (estatico/js/regras.js no
 * repositório artstamp-painel), com um teste de SHA-256 que falha se
 * divergirem. Por isso é um ES module puro: nenhum import, nada de node:*, fs,
 * process ou require. Corre tal e qual no browser, num Worker e no Node.
 * (Do painel da PokeAuto, que tem o mesmo desenho de site.)
 *
 * O SITE É O JUIZ. O que cada campo FAZ vem do assets/js/app.js (desenha as
 * secções no browser a partir de data/*.json) e dos scripts do CI
 * (.github/scripts/prerender.py, webp.py, dimensoes.py; .github/legal.mjs):
 * as regras olham para o que o site faz com o valor, e não para o que o valor
 * parece. As ajudas e os rótulos que o cliente lê são os do painel (vinham do
 * .pages.yml do Pages CMS, que o painel substitui em Outubro de 2026).
 *
 * O GITHUB PAGES SERVE O RAMO main TAL E QUAL (build_type legacy): o que se
 * grava em data/*.json fica público em segundos, e o app.js desenha-o. O CI só
 * congela uma cópia em HTML para os motores de busca (e faz as fotografias
 * leves da galeria). Por isso a guarda do CI NÃO protege o site: quando ela
 * pára, o visitante já está a ver o que se gravou. Quem tem de recusar é o
 * painel, ANTES de gravar — e é por isso que o Worker confere estas regras em
 * cada gravação.
 *
 * CADA PROBLEMA TEM UMA CLASSE:
 *   · bloqueia   — a publicação pára no CI (o HTML dos motores de busca e os
 *                  dados estruturados ficam como estavam). É o que faria
 *                  rebentar o prerender.py (um ficheiro com outra forma, a
 *                  morada sem o código postal, uma hora que ele não lê) e os
 *                  dados que a lei obriga e que não podem faltar (DL 7/2004,
 *                  art. 10.º: a morada; e um contacto).
 *   · neutraliza — o site, sozinho, não mostra a coisa. Nada pára; mas o
 *                  cliente pensava que estava no site. Os ficheiros nunca
 *                  mudam por causa disto. (Neste site, hoje, nenhuma regra é
 *                  desta classe: o app.js desenha tudo o que lá está.)
 *   · avisa      — o site mostra-o mal (uma fotografia que não existe aparece
 *                  partida, um botão fica sem texto, um título apagado deixa o
 *                  antigo à vista), ou um valor fora do que o painel aceita
 *                  (comprido de mais, fora da lista). No painel é erro de campo:
 *                  não deixa gravar; um valor estranho num commit à mão não
 *                  pára o CI. Os LEMBRETES (lembrete: true) não são erro de
 *                  ninguém: o painel grava na mesma e mostra-os no Início (o
 *                  email que a lei pede e ainda não está no site, uma
 *                  fotografia sem legenda).
 *
 * dados = { gallery, rigidos, models, lonas, services, steps, faq, site }
 *   cada um: o TEXTO do ficheiro data/<nome>.json, ou o objecto já lido, ou
 *   null (o ficheiro não existe). Uma chave AUSENTE não se confere (o painel
 *   confere só o ficheiro que mudou).
 *
 * opcoes = {
 *   existe(caminho) → bool   que ficheiros há no repositório (as fotografias);
 *                            sem ele, as fotografias não se conferem.
 * }
 *
 * problema = {
 *   classe:   'bloqueia' | 'neutraliza' | 'avisa',
 *   chave:    estável: '<ficheiro>:<de quem>:<regra>'. O Worker compara as
 *             chaves do HEAD com as da gravação e recusa só as novas; por isso
 *             UMA CHAVE TEM SEMPRE A MESMA CLASSE, e não leva a POSIÇÃO de um
 *             item numa lista (juntar um trabalho no topo não pode fazer de um
 *             problema antigo um problema novo): leva o nome dele.
 *   ficheiro: 'data/<nome>.json';
 *   ecra:     o ecrã do painel onde se corrige («Trabalhos › Caneca mágica»,
 *             «Página › Contactos»);
 *   mensagem: para o cliente, em português simples, sem caminhos de JSON;
 *   campo?:   onde está, AGORA, o campo ('items.3.cap', 'contacts.email'):
 *             o painel leva o foco até ele (esse leva a posição);
 *   lembrete?: true nos avisos que não são erro de ninguém.
 * }
 *
 * «NÃO FOI DITO» E "" SÃO O MESMO: os ficheiros escrevem os campos vazios
 * como "" (o Pages CMS e o painel), e um commit à mão pode tirá-los. E o vazio
 * testa-se ANTES de converter: Number('') é 0. */

/* ------------------------------------------------------------------ */
/* Onde estão as coisas                                                */
/* ------------------------------------------------------------------ */

export const FICHEIROS = Object.freeze({
  gallery: 'data/gallery.json',
  rigidos: 'data/rigidos.json',
  models: 'data/models.json',
  lonas: 'data/lonas.json',
  services: 'data/services.json',
  steps: 'data/steps.json',
  faq: 'data/faq.json',
  site: 'data/site.json',
});
/* Pela ordem do menu: o que o cliente mexe mais (os trabalhos, os catálogos,
   pela ordem em que estão no site) vem primeiro; depois as secções da página. */
export const ORDEM = Object.freeze(['gallery', 'rigidos', 'models', 'lonas', 'services', 'steps', 'faq', 'site']);
/* Os nomes são os do menu do site (index.html), que o cliente já conhece. */
export const ECRAS = Object.freeze({
  gallery: 'Trabalhos',
  rigidos: 'Catálogo Rígidos',
  models: 'Catálogo Têxtil',
  lonas: 'Catálogo Lonas e Vinil',
  services: 'Serviços',
  steps: 'Como funciona',
  faq: 'Perguntas frequentes',
  site: 'Página',
});
/* A lista de cada ficheiro (o resto do ficheiro são os títulos da secção). */
export const LISTAS = Object.freeze({
  gallery: 'items', rigidos: 'products', models: 'models', lonas: 'products', services: 'services', steps: 'steps', faq: 'items',
});
/** O nome curto ('gallery'…) de um caminho de ficheiro, ou null. */
export const ficheiroDe = (caminho) => ORDEM.find((k) => FICHEIROS[k] === caminho) ?? null;

/* AS BIBLIOTECAS DAS FOTOGRAFIAS. Para o cliente, uma fotografia é um
   ORIGINAL: o ficheiro que se carregou, directamente na pasta. O webp.py faz
   dos originais de assets/img/trabalhos/ as versões leves que a galeria serve
   (webp/<nome>-<largura>.webp, ao lado); elas nunca se mostram nem se
   escolhem. Os catálogos servem o ficheiro tal e qual. Uma fotografia pode
   servir em qualquer sítio do site (o app.js usa o caminho que lá estiver):
   a pasta diz só onde o painel guarda as novas de cada secção. */
export const BIBLIOTECAS = Object.freeze({
  trabalhos: Object.freeze({ pasta: 'assets/img/trabalhos', variantes: 'assets/img/trabalhos/webp', nome: 'Trabalhos' }),
  rigidos: Object.freeze({ pasta: 'assets/img/rigidos', variantes: null, nome: 'Catálogo Rígidos' }),
  modelos: Object.freeze({ pasta: 'assets/img/modelos', variantes: null, nome: 'Catálogo Têxtil' }),
  lonas: Object.freeze({ pasta: 'assets/img/lonas', variantes: null, nome: 'Catálogo Lonas e Vinil' }),
});
/* Onde vão as fotografias novas de cada ficheiro. */
export const BIBLIOTECA_DO_FICHEIRO = Object.freeze({ gallery: 'trabalhos', site: 'trabalhos', rigidos: 'rigidos', models: 'modelos', lonas: 'lonas' });
export const EXTENSOES_FOTO = Object.freeze(['jpg', 'jpeg', 'png', 'webp']);
/* Uma variante é qualquer ficheiro que acabe em -<número>.webp: as do webp.py
   (na pasta webp/) e a do topo, feita à mão (hero-hoodie-douro-760.webp). */
const RE_VARIANTE = /-\d+\.webp$/i;
export const eVariante = (nome) => RE_VARIANTE.test(String(nome ?? '').split('/').pop());

/** Um caminho do repositório sem a barra à frente nem o «?» do fim (o normImg do app.js). */
export const noRepositorio = (c) => String(c ?? '').trim().replace(/^\/+/, '').split('?')[0];

/* O NOME BASE de uma fotografia: sem a pasta, sem a extensão e sem a largura
   do fim. É por ele que as variantes se ligam ao original. */
export function baseDaFoto(valor) {
  let v = noRepositorio(valor).split('/').pop();
  v = v.replace(/\.(webp|jpe?g|png|avif)$/i, '');
  return v.replace(/-\d{2,4}$/, '');
}

/**
 * UM ORIGINAL DE UMA BIBLIOTECA: um ficheiro directamente na pasta dela, com
 * uma extensão de fotografia, que não é uma variante.
 * → 'trabalhos' | 'rigidos' | 'modelos' | 'lonas' | null
 */
export function bibliotecaDe(caminho) {
  const c = noRepositorio(caminho);
  for (const [k, b] of Object.entries(BIBLIOTECAS)) {
    if (!c.startsWith(`${b.pasta}/`)) continue;
    const nome = c.slice(b.pasta.length + 1);
    if (!nome || nome.includes('/')) continue;
    const ext = /\.([a-z0-9]+)$/i.exec(nome)?.[1]?.toLowerCase();
    if (!ext || !EXTENSOES_FOTO.includes(ext) || eVariante(nome)) continue;
    return k;
  }
  return null;
}

/* UM NOME QUE O SITE SERVE BEM: só letras sem acento, algarismos, «.», «-» e
   «_». Um espaço ou uma vírgula partem o srcset da galeria (memória
   srcset-nome-com-espaco), e um «&» parte o sitemap das imagens. As que o
   painel carrega são sempre assim (<prefixo>-<8 hex>.jpg). */
export function nomeSeguro(caminho) {
  const nome = noRepositorio(caminho).split('/').pop();
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(nome);
}

/**
 * COMO O SITE MOSTRA UMA FOTOGRAFIA (o normImg do app.js: o caminho tal e
 * qual, sem a barra do princípio):
 * → { estado: 'vazia' }                 sem fotografia
 *   { estado: 'fora' }                  um endereço de outro site
 *   { estado: 'existe', caminho }       aparece
 *   { estado: 'falta', caminho }        no site aparece partida
 */
export function fotoNoSite(valor, existe) {
  const cru = String(valor ?? '').trim();
  if (!cru) return { estado: 'vazia' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(cru)) return { estado: 'fora' };
  const c = noRepositorio(cru);
  return existe(c) ? { estado: 'existe', caminho: c } : { estado: 'falta', caminho: c };
}

/**
 * AS FOTOGRAFIAS QUE AS PARTES FIXAS DO index.html MOSTRAM: as das quatro
 * bibliotecas que estão FORA das zonas que o prerender.py reescreve
 * (<!--pre:id-->…<!--/pre:id-->). As de dentro vêm dos dados e mudam com
 * eles; o topo e a faixa das empresas escrevem-se a partir dos dados ao
 * publicar. → Set dos caminhos (com as variantes escritas à mão, como a do
 * topo, no srcset).
 */
export function fotografiasFixas(html) {
  const s = typeof html === 'string' ? html : '';
  const semZonas = s.replace(/<!--pre:([\w-]+)-->[\s\S]*?<!--\/pre:\1-->/g, '');
  const out = new Set();
  for (const m of semZonas.matchAll(/assets\/img\/(?:trabalhos|rigidos|modelos|lonas)\/[^"'\s,)]+/g)) out.add(noRepositorio(m[0]));
  return out;
}

/* ------------------------------------------------------------------ */
/* Os campos de cada ficheiro                                          */
/* ------------------------------------------------------------------ */

/* As chaves que o painel conhece, pela ordem em que estão nos ficheiros (um
   campo que falta entra no lugar dele; um item novo nasce com todas, vazias,
   como os outros). O que não está aqui o painel não mexe: fica como está.
   O «gender» dos modelos não aparece no site (era do catálogo em PDF): o
   painel guarda-o como está e não o mostra. */
export const CAMPOS = Object.freeze({
  head: ['eyebrow', 'title', 'lead'],
  gallery: { topo: ['head', 'items'], item: ['img', 'cap'] },
  services: { topo: ['head', 'services'], item: ['icon', 'title', 'desc'] },
  models: { topo: ['head', 'models'], item: ['name', 'cat', 'img', 'tag', 'gsm', 'fabric', 'gender', 'sizes_label', 'sizes', 'colors'] },
  rigidos: { topo: ['head', 'cats', 'products'], item: ['name', 'cat', 'imgs', 'specs'], spec: ['label', 'value'] },
  lonas: { topo: ['head', 'cats', 'products'], item: ['name', 'cat', 'imgs', 'specs'], spec: ['label', 'value'] },
  steps: { topo: ['head', 'steps'], item: ['title', 'desc'] },
  faq: { topo: ['head', 'items'], item: ['q', 'a'] },
  site: {
    topo: ['hero', 'contacts', 'hours', 'contacto', 'b2b', 'footer_tagline', 'owner_name'],
    hero: ['eyebrow', 'title', 'highlight', 'title_end', 'lead', 'image', 'badge', 'cta_primary', 'cta_secondary', 'audience'],
    contacts: ['phone', 'phone_intl', 'email', 'instagram_url', 'instagram_handle', 'address_line1', 'address_line2', 'maps_url', 'facebook_url'],
    hours: ['days', 'opens', 'closes'],
    contacto: ['eyebrow', 'title', 'lead', 'form_options'],
    b2b: ['eyebrow', 'title', 'lead', 'list', 'cta_label', 'image'],
  },
});
/* As secções do data/site.json que são objectos (o horário é uma lista; o
   rodapé e o titular são textos soltos). */
export const SECCOES_SITE = Object.freeze(['hero', 'contacts', 'contacto', 'b2b']);
/* As partes do data/site.json, com o nome que o cliente vê no ecrã «Página»:
   [parte, título, chave do ficheiro]. */
export const PARTES_SITE = Object.freeze([
  ['topo', 'Topo da página', 'hero'],
  ['empresas', 'Empresas', 'b2b'],
  ['orcamento', 'Pedido de orçamento', 'contacto'],
  ['contactos', 'Contactos', 'contacts'],
  ['horario', 'Horário', 'hours'],
  ['rodape', 'Rodapé', 'footer_tagline'],
  ['legal', 'Dados legais', 'owner_name'],
]);
export const parteDoSite = (chave) => PARTES_SITE.find(([, , k]) => k === chave) ?? null;

/* O campo escondido no Pages CMS que o painel guarda e não mostra: o número
   internacional, que o painel passa a escrever sozinho a partir do telefone
   (antes, mudar o telefone no Pages CMS deixava o WhatsApp e o «Ligar» no
   número antigo). */
export const ESCONDIDOS_SITE = Object.freeze({ contacts: ['phone_intl'] });

/* As categorias do Catálogo Têxtil: as do filtro do app.js (CAT_ORDER, sem o
   «Todos»), pela mesma ordem. Um modelo com outra não aparece em filtro
   nenhum, só em «Todos». */
export const CATEGORIAS_MODELOS = Object.freeze(['T-shirts', 'Polos', 'Sweats e hoodies', 'Casacos e softshell', 'Vestuário de trabalho', 'Sacos e acessórios']);
/* O primeiro filtro dos catálogos com galeria (rígidos, lonas e vinil). */
export const TODOS = 'Todos';
export const DIAS = Object.freeze({ Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta', Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo' });

/* OS DESENHOS DOS SERVIÇOS — os do app.js (ICONS), traço a traço: o painel
   desenha-os para o cliente escolher a ver, e o .github/test-guardas.mjs
   confere que são os mesmos do app.js. [nome para o cliente, peças]: cada
   peça é [elemento, atributos] de um <svg viewBox="0 0 24 24"> com traço da
   cor do texto. Um nome que não está aqui mostra a estrela («generico»). */
export const ICONES = Object.freeze({
  tshirt: ['T-shirt', [['path', { d: 'M8.5 3.5 4 6l2 3 2-1.2V20h8V7.8L18 9l2-3-4.5-2.5a3.5 3.5 0 0 1-7 0Z' }]]],
  hoodie: ['Sweat com capuz', [['path', { d: 'M8 4 4 6.5 6 10l2-1v11h8V9l2 1 2-3.5L16 4' }], ['path', { d: 'M8 4c.6 2.4 7.4 2.4 8 0' }], ['path', { d: 'M12 6v4' }]]],
  polo: ['Polo', [['path', { d: 'M9 3.5 4 6l2 3 2-1v11h8V8l2 1 2-3-5-2.5' }], ['path', { d: 'M9 3.5 12 7l3-3.5' }], ['path', { d: 'M12 7v4' }]]],
  cap: ['Boné', [['path', { d: 'M4 14a8 8 0 0 1 16 0' }], ['path', { d: 'M12 6v8' }], ['path', { d: 'M20 14H4' }], ['path', { d: 'M4 14c-1 0-2 .4-2 1.5' }]]],
  mug: ['Caneca', [['rect', { x: '5', y: '5', width: '11', height: '15', rx: '2.5' }], ['path', { d: 'M16 8h3a2.5 2.5 0 0 1 0 5h-3' }]]],
  sticker: ['Autocolante', [['path', { d: 'M5 4h9l5 5v11H5Z' }], ['path', { d: 'M14 4v5h5' }]]],
  dtf: ['DTF têxtil', [['path', { d: 'm12 3 8 4-8 4-8-4Z' }], ['path', { d: 'm4 12 8 4 8-4' }], ['path', { d: 'm4 16 8 4 8-4' }]]],
  uv: ['DTF UV', [['path', { d: 'M12 3s5 5.4 5 9.2A5 5 0 0 1 7 12.2C7 8.4 12 3 12 3Z' }], ['path', { d: 'M9.6 12.4a2.4 2.4 0 0 0 4.8 0' }]]],
  vinyl: ['Vinil', [['ellipse', { cx: '12', cy: '6.5', rx: '8', ry: '3' }], ['path', { d: 'M4 6.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6' }], ['circle', { cx: '12', cy: '6.5', r: '1.3' }]]],
  banner: ['Lona', [['path', { d: 'M6 3v18' }], ['path', { d: 'M6 4.5h13l-3 4 3 4H6' }]]],
  merch: ['Merchandising', [['path', { d: 'M4 8h16l-1.2 12H5.2Z' }], ['path', { d: 'M8.5 8V6a3.5 3.5 0 0 1 7 0v2' }], ['path', { d: 'm12 11.5 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 13.8l2.2-.3Z' }]]],
  gift: ['Brinde', [['rect', { x: '3.5', y: '9', width: '17', height: '11.5', rx: '1.6' }], ['path', { d: 'M2.5 9h19' }], ['path', { d: 'M12 9v11.5' }], ['path', { d: 'M12 9C9.8 9 8 8 8 6.4A2.4 2.4 0 0 1 12 5a2.4 2.4 0 0 1 4 1.4C16 8 14.2 9 12 9Z' }]]],
  work: ['Vestuário de trabalho', [['path', { d: 'M9 3.5 5 5.5v15h14v-15l-4-2' }], ['path', { d: 'm9 3.5 3 4 3-4' }], ['path', { d: 'M5 11h4M15 11h4' }], ['path', { d: 'M5 14.5h4M15 14.5h4' }]]],
  bag: ['Saco', [['path', { d: 'M5 7.5h14l-1 13H6Z' }], ['path', { d: 'M9 7.5V6a3 3 0 0 1 6 0v1.5' }]]],
  phone: ['Capa de telemóvel', [['rect', { x: '6.5', y: '2.5', width: '11', height: '19', rx: '2.6' }], ['path', { d: 'M10.5 5.5h3' }]]],
  generico: ['Estrela (serve para tudo)', [['path', { d: 'm12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z' }]]],
});
/** O SVG de um desenho, como o app.js o escreve (para a bateria comparar). */
export function svgDoIcone(nome) {
  const pecas = Object.hasOwn(ICONES, nome) ? ICONES[nome][1] : ICONES.generico[1];
  const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg viewBox="0 0 24 24" ${S}>${pecas.map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')}</svg>`;
}

/* Os rótulos dos campos (as mensagens dos conflitos e dos problemas). */
export const NOMES = Object.freeze({
  eyebrow: 'Etiqueta', title: 'Título', lead: 'Subtítulo',
  img: 'Fotografia', cap: 'Legenda',
  icon: 'Desenho', desc: 'Descrição',
  name: 'Nome', cat: 'Categoria', tag: 'Descrição curta', gsm: 'Gramagem', fabric: 'Tecido', gender: 'Género',
  sizes_label: 'Nome do 3.º campo', sizes: 'Tamanhos', colors: 'Número de cores',
  imgs: 'Fotografias', specs: 'Características', label: 'Característica', value: 'Valor', cats: 'Categorias',
  q: 'Pergunta', a: 'Resposta',
  highlight: 'Palavra destacada', title_end: 'Fim do título', image: 'Fotografia', badge: 'Selo sobre a fotografia',
  cta_primary: 'Botão principal', cta_secondary: 'Botão secundário', audience: 'Para quem',
  phone: 'Telefone', email: 'Email', instagram_url: 'Link do Instagram', instagram_handle: 'Nome do Instagram',
  address_line1: 'Morada (rua e número)', address_line2: 'Código postal e localidade', maps_url: 'Link do Google Maps', facebook_url: 'Link do Facebook',
  days: 'Dias', opens: 'Abre', closes: 'Fecha', form_options: 'Opções do formulário', list: 'Lista', cta_label: 'Botão',
  footer_tagline: 'Frase do rodapé', owner_name: 'Nome do titular',
});

/* ------------------------------------------------------------------ */
/* Limites                                                             */
/* ------------------------------------------------------------------ */

/* Tamanhos máximos, em caracteres. Folgados: o maior texto de hoje cabe com
   espaço. (O Pages CMS não tinha limites nenhuns.) */
export const TAMANHOS = Object.freeze({
  etiqueta: 60, tituloSeccao: 100, lead: 400,
  cap: 120, itensGaleria: 120,
  tituloServico: 40, descricaoServico: 400, itensServicos: 40,
  nomeModelo: 40, tag: 60, gsm: 30, tecido: 80, tamanhos: 40, rotuloTamanhos: 30, cores: 999, itensModelos: 80,
  nomeArtigo: 60, categoria: 40, categorias: 12, rotuloSpec: 40, valorSpec: 60, specs: 10, fotosArtigo: 10, itensArtigos: 80,
  tituloPasso: 60, descPasso: 300, passos: 8,
  pergunta: 160, resposta: 1000, perguntas: 30,
  heroEtiqueta: 60, heroTitulo: 60, heroDestaque: 30, heroFim: 10, heroLead: 400, botao: 40, selo: 40, publico: 30, publicos: 8,
  telefone: 20, email: 160, morada: 120, codigoPostalLocalidade: 80, url: 500, instagram: 60,
  opcao: 40, opcoes: 30, itemLista: 60, itensLista: 12,
  rodape: 240, nomeTitular: 160,
  caminhoFoto: 300, horario: 14,
});
/* O que o Worker do painel aceita gravar num ficheiro (recusa acima). */
export const TECTOS = Object.freeze({ ficheiroBytes: 64 * 1024 });

/* ------------------------------------------------------------------ */
/* Ajudantes que o painel e o Worker também usam                      */
/* ------------------------------------------------------------------ */

const eObjecto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ausente = (x) => x === null || x === undefined;
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** O texto de um campo: '' quando não foi dito; null quando lá está outra
 *  coisa que não um texto (um número, uma lista — de um commit à mão). */
const textoDe = (v) => (ausente(v) ? '' : typeof v === 'string' ? v : null);
const limpo = (v) => (typeof v === 'string' ? v.trim() : '');

export const terminacaoDe = (texto) => (typeof texto === 'string' && texto.endsWith('\n') ? '\n' : '');
/* Como os ficheiros estão escritos: 2 espaços e a terminação de cada um (hoje
   todos acabam em \n). Abrir e gravar sem mexer deixa o ficheiro igual, byte
   a byte. */
export function serializar(obj, terminacao = '') { return JSON.stringify(obj, null, 2) + (terminacao || ''); }

/** Dois valores lidos de JSON são o mesmo? null ≡ ausente; sem ligar à ordem das chaves. */
export function igual(a, b) {
  if (ausente(a) && ausente(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => igual(x, b[i]));
  if (eObjecto(a) || eObjecto(b)) {
    if (!eObjecto(a) || !eObjecto(b)) return false;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!igual(a[k], b[k])) return false;
    return true;
  }
  return a === b;
}

export const emailValido = (s) => typeof s === 'string' && s.length <= TAMANHOS.email && /^[^@\s,;<>"'()[\]]{1,64}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(s) && /\.[a-z]{2,}$/i.test(s);
export const urlHttps = (s) => {
  if (typeof s !== 'string' || !/^https:\/\/[^\s"'<>]+$/.test(s) || s.length > TAMANHOS.url) return false;
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
};

/* O TELEFONE. O site escreve o número como se lê («932 938 467»), liga e abre
   o WhatsApp pelo internacional (351932938467), e o .github/legal.mjs escreve
   ao lado o custo da chamada, que a lei obriga (DL 59/2021). Um telemóvel
   começa por 91, 92, 93 ou 96; um fixo por 2. */
export const CUSTO_CHAMADA = Object.freeze({ movel: 'Chamada para a rede móvel nacional', fixa: 'Chamada para a rede fixa nacional' });
/** O que se escreveu no campo do telefone → { digitos, rede, intl, texto }
 *  ou null (vazio) ou undefined (não é um número português). */
export function lerTelefone(t) {
  const s = String(t ?? '').trim();
  if (!s) return null;
  if (!/^[0-9 +.()-]+$/.test(s)) return undefined;
  let d = s.replace(/[^0-9]/g, '');
  if (d.length === 12 && d.startsWith('351')) d = d.slice(3);
  if (!/^[0-9]{9}$/.test(d)) return undefined;
  const rede = /^9[1236]/.test(d) ? 'movel' : /^2/.test(d) ? 'fixa' : null;
  if (!rede) return undefined;
  return { digitos: d, rede, intl: `351${d}`, texto: `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` };
}

/* Um identificador (o prefixo das fotografias novas): só minúsculas,
   algarismos e hífens. */
export const RE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* UM ITEM NOVO, com todos os campos vazios e pela ordem dos outros. */
export function itemNovo(tipo, extra = {}) {
  const base = {
    gallery: { img: '', cap: '' },
    services: { icon: 'generico', title: '', desc: '' },
    models: { name: '', cat: '', img: '', tag: '', gsm: '', fabric: '', gender: 'Unissexo', sizes: '', colors: 1 },
    rigidos: { name: '', cat: '', imgs: [], specs: [] },
    lonas: { name: '', cat: '', imgs: [], specs: [] },
    spec: { label: '', value: '' },
    steps: { title: '', desc: '' },
    faq: { q: '', a: '' },
    hours: { days: [], opens: '', closes: '' },
  }[tipo];
  if (!base) throw new Error(`itemNovo: não conheço ${tipo}`);
  return { ...structuredCloneSimples(base), ...extra };
}
const structuredCloneSimples = (o) => JSON.parse(JSON.stringify(o));

/**
 * UM CAMPO QUE FALTA ENTRA NO SEU LUGAR (a ordem `ordem`), e não no fim: o
 * ficheiro fica como os outros itens. Os que já lá estão ficam onde estão.
 * Devolve um objecto novo; `obj` não muda.
 */
export function comCampo(obj, k, v, ordem) {
  if (tem(obj, k)) return { ...obj, [k]: v };
  const chaves = Object.keys(obj);
  const pos = ordem.indexOf(k);
  let antesDe = chaves.length;
  if (pos >= 0) {
    for (let i = 0; i < chaves.length; i++) {
      const p = ordem.indexOf(chaves[i]);
      if (p > pos) { antesDe = i; break; }
    }
  }
  const out = {};
  chaves.forEach((c, i) => { if (i === antesDe) out[k] = v; out[c] = obj[c]; });
  if (antesDe === chaves.length) out[k] = v;
  return out;
}

/* ------------------------------------------------------------------ */
/* Ler                                                                 */
/* ------------------------------------------------------------------ */

/* Um ficheiro de dados: { obj } ou { problema } (que não existe, que não se
   lê, que não é um objecto — e aí o site não se consegue gerar). */
function lerFicheiro(f, v) {
  const ficheiro = FICHEIROS[f];
  const ecra = ECRAS[f];
  const parar = (regra, mensagem) => ({ problema: { classe: 'bloqueia', chave: `${f}:ficheiro:${regra}`, ficheiro, ecra, mensagem } });
  if (v === null) return parar('falta', `O ficheiro ${ficheiro} não existe: o site não se consegue gerar sem ele. Só o Renato o pode corrigir.`);
  let obj = v;
  if (typeof v === 'string') {
    try { obj = JSON.parse(v); } catch { return parar('json', `O ficheiro ${ficheiro} ficou mal escrito (não se consegue ler): o site não se consegue gerar. Só o Renato o pode corrigir.`); }
  }
  if (!eObjecto(obj)) return parar('forma', `O ficheiro ${ficheiro} não tem a forma de sempre: o site não se consegue gerar. Só o Renato o pode corrigir.`);
  return { obj };
}

/* ------------------------------------------------------------------ */
/* De quem é cada campo (as chaves e os ecrãs)                         */
/* ------------------------------------------------------------------ */

/* O campo que dá nome a cada item de cada lista (a identidade nas chaves dos
   problemas e na fusão de duas gravações): nunca a posição. */
const NOME_DO_ITEM = Object.freeze({ gallery: 'img', services: 'title', models: 'name', rigidos: 'name', lonas: 'name', steps: 'title', faq: 'q' });
function identidade(f, item, i) {
  const k = NOME_DO_ITEM[f];
  const v = k && eObjecto(item) && typeof item[k] === 'string' && item[k].trim() ? item[k].trim() : null;
  return v ?? `#${i + 1}`;
}
/**
 * A IDENTIDADE DOS ITENS DE UMA LISTA, para quem junta duas gravações ao mesmo
 * tempo (o painel funde item a item só quando os itens são os mesmos, pela
 * mesma ordem, dos três lados): o caminho de cada trabalho, o nome de cada
 * modelo e de cada artigo, o título de cada serviço e de cada passo, a
 * pergunta de cada pergunta frequente, a característica de cada linha.
 *   f       o ficheiro ('gallery'…)
 *   partes  o caminho da lista: ['items'], ['products', 2, 'specs'], ['hours']
 * → (item) => texto (o horário não tem: vale a posição), ou null se a lista
 *   se junta inteira (as listas de textos: os públicos, as categorias…).
 */
export function identidadeDaLista(f, partes) {
  const c = partes.map((p) => (typeof p === 'number' ? '#' : p)).join('.');
  if (c === LISTAS[f] && NOME_DO_ITEM[f]) {
    const campo = NOME_DO_ITEM[f];
    return (x) => (eObjecto(x) && typeof x[campo] === 'string' ? x[campo] : null);
  }
  if ((f === 'rigidos' || f === 'lonas') && c === 'products.#.specs') return (x) => (eObjecto(x) && typeof x.label === 'string' ? x.label : null);
  if (f === 'site' && c === 'hours') return () => '';
  return null;
}
/** O nome de um item, como o cliente o conhece (os ecrãs e as mensagens). */
export function nomeDeItem(f, item, i) {
  const t = (k) => (eObjecto(item) && typeof item[k] === 'string' && item[k].trim() ? item[k].trim() : '');
  if (f === 'gallery') return t('cap') || `Trabalho n.º ${i + 1}`;
  if (f === 'services') return t('title') || `Serviço n.º ${i + 1}`;
  if (f === 'models') return t('name') || `Modelo n.º ${i + 1}`;
  if (f === 'rigidos' || f === 'lonas') return t('name') || `Artigo n.º ${i + 1}`;
  if (f === 'steps') return t('title') || `Passo n.º ${i + 1}`;
  if (f === 'faq') return t('q') || `Pergunta n.º ${i + 1}`;
  return `n.º ${i + 1}`;
}
const ecraDoItem = (f, item, i) => `${ECRAS[f]} › ${nomeDeItem(f, item, i)}`;
const ecraDoHead = (f) => `${ECRAS[f]} › Títulos da secção`;
const ecraDaParte = (chave) => `${ECRAS.site} › ${parteDoSite(chave)?.[1] ?? chave}`;

/* ------------------------------------------------------------------ */
/* As regras                                                           */
/* ------------------------------------------------------------------ */

/* Um acumulador de problemas de um ficheiro. */
function caderno(f) {
  const out = [];
  const ficheiro = FICHEIROS[f];
  const juntar = (classe, chave, ecra, mensagem, extra = {}) => out.push({ classe, chave: `${f}:${chave}`, ficheiro, ecra, mensagem, ...extra });
  return { out, juntar };
}

/* Os campos de texto de um objecto: um valor que não é texto (um número, uma
   lista, de um commit à mão) diz-se; um texto comprido de mais, também. */
function conferirTextos(juntar, o, campos, { prefixo, chave, ecra }) {
  for (const [k, max, rotulo] of campos) {
    const v = o[k];
    if (ausente(v)) continue;
    const campo = `${prefixo}${k}`;
    if (typeof v !== 'string') { juntar('avisa', `${chave}:${k}:tipo`, ecra, `«${rotulo}» não está escrito como texto: escreva-o outra vez.`, { campo }); continue; }
    if (max && v.length > max) juntar('avisa', `${chave}:${k}:comprido`, ecra, `«${rotulo}» tem ${v.length} caracteres: no máximo ${max}.`, { campo });
  }
}
/* Um texto que o site precisa (um título, um botão): vazio, ou só espaços. */
function conferirPreciso(juntar, o, k, { campo, chave, ecra, mensagem }) {
  const v = textoDe(o[k]);
  if (v !== null && !v.trim()) juntar('avisa', `${chave}:${k}:vazio`, ecra, mensagem, { campo });
}

/* UMA LISTA DE TEXTOS (os públicos do topo, as opções do formulário, a lista
   das empresas, as categorias): uma lista, de textos, sem vazios. */
function conferirTextosDaLista(juntar, v, { campo, chave, ecra, rotulo, max, maxItens, vazia = null }) {
  if (ausente(v)) return null;
  if (!Array.isArray(v)) { juntar('bloqueia', `${chave}:forma`, ecra, `${rotulo} não tem a forma de sempre (uma lista): o site não se consegue gerar. Só o Renato a pode corrigir.`, { campo }); return null; }
  if (!v.length && vazia) juntar('avisa', `${chave}:vazia`, ecra, vazia, { campo });
  if (v.length > maxItens) juntar('avisa', `${chave}:muitos`, ecra, `${rotulo} tem ${v.length} linhas: no máximo ${maxItens}.`, { campo });
  v.forEach((x, i) => {
    if (typeof x !== 'string') juntar('avisa', `${chave}:${i + 1}:tipo`, ecra, `A ${i + 1}.ª linha de «${rotulo}» não está escrita como texto: escreva-a outra vez.`, { campo: `${campo}.${i}` });
    else if (!x.trim()) juntar('avisa', `${chave}:${i + 1}:vazio`, ecra, `A ${i + 1}.ª linha de «${rotulo}» está vazia: escreva-a ou tire-a.`, { campo: `${campo}.${i}` });
    else if (x.length > max) juntar('avisa', `${chave}:${i + 1}:comprido`, ecra, `A ${i + 1}.ª linha de «${rotulo}» tem ${x.length} caracteres: no máximo ${max}.`, { campo: `${campo}.${i}` });
  });
  return v;
}

/* OS TÍTULOS DE UMA SECÇÃO (etiqueta, título, subtítulo). O app.js e o
   prerender.py escrevem-nos a partir dos dados; a etiqueta e o subtítulo
   apagados saem do site. O título apagado ficava com o que lá estava: o
   painel não o deixa gravar vazio. */
function conferirHead(juntar, f, h, { campo = 'head', ecra = ecraDoHead(f), chave = 'head' } = {}) {
  if (ausente(h)) return;
  if (!eObjecto(h)) { juntar('bloqueia', `${chave}:forma`, ecra, 'Os títulos da secção não têm a forma de sempre: o site não se consegue gerar. Só o Renato o pode corrigir.', { campo }); return; }
  conferirTextos(juntar, h, [['eyebrow', TAMANHOS.etiqueta, 'Etiqueta'], ['title', TAMANHOS.tituloSeccao, 'Título'], ['lead', TAMANHOS.lead, 'Subtítulo']], { prefixo: `${campo}.`, chave, ecra });
  if (ausente(h.title) || (typeof h.title === 'string' && !h.title.trim())) {
    juntar('avisa', `${chave}:title:vazio`, ecra, 'O título da secção está vazio: o site continua a mostrar o antigo. Escreva o título que quer.', { campo: `${campo}.title` });
  }
}

/* UMA FOTOGRAFIA NUM CAMPO: que existe (no site aparecia partida), que é da
   biblioteca, e que o nome não estraga o site. `existe` ausente: só a forma. */
function conferirFoto(juntar, valor, { campo, chave, ecra, existe, rotulo = 'A fotografia', precisa = true }) {
  if (ausente(valor) || (typeof valor === 'string' && !valor.trim())) {
    if (precisa) juntar('avisa', `${chave}:vazia`, ecra, `${rotulo} falta: no site aparece um quadrado vazio. Escolha uma.`, { campo });
    return;
  }
  if (typeof valor !== 'string') { juntar('avisa', `${chave}:tipo`, ecra, `${rotulo} não está escrita como um caminho: escolha-a outra vez.`, { campo }); return; }
  if (valor.length > TAMANHOS.caminhoFoto) { juntar('avisa', `${chave}:comprido`, ecra, `${rotulo} tem um caminho comprido de mais: escolha-a outra vez.`, { campo }); return; }
  if (!existe) return;
  const e = fotoNoSite(valor, existe);
  if (e.estado === 'fora') juntar('avisa', `${chave}:fora`, ecra, `${rotulo} vem de outro site: carregue-a no painel, ou escolha uma da biblioteca.`, { campo });
  else if (e.estado === 'falta') juntar('avisa', `${chave}:falta`, ecra, `${rotulo} já não existe na biblioteca: no site aparece partida. Escolha outra.`, { campo });
  else if (!nomeSeguro(e.caminho)) juntar('avisa', `${chave}:nome`, ecra, `${rotulo} tem espaços ou acentos no nome do ficheiro: no site pode não aparecer. Carregue-a outra vez pelo painel.`, { campo, lembrete: true });
}

/* A LISTA DE UM FICHEIRO: uma lista de objectos. → a lista, ou null (já dito). */
function lerLista(juntar, f, o, { vazia = null, max }) {
  const k = LISTAS[f];
  const v = o[k];
  if (ausente(v)) { if (vazia) juntar('avisa', `${k}:vazia`, ECRAS[f], vazia, { campo: k }); return []; }
  if (!Array.isArray(v)) { juntar('bloqueia', `${k}:forma`, ECRAS[f], `A lista de «${ECRAS[f]}» não tem a forma de sempre: o site não se consegue gerar. Só o Renato a pode corrigir.`, { campo: k }); return null; }
  if (!v.length && vazia) juntar('avisa', `${k}:vazia`, ECRAS[f], vazia, { campo: k });
  if (v.length > max) juntar('avisa', `${k}:muitos`, ECRAS[f], `«${ECRAS[f]}» tem ${v.length} itens: no máximo ${max}.`, { campo: k });
  return v;
}
/* Cada item da lista: um objecto (o app.js e o prerender.py lêem os campos
   dele; outra coisa rebenta o desenho da secção inteira). */
function cadaItem(juntar, f, lista, fazer) {
  const k = LISTAS[f];
  lista.forEach((x, i) => {
    const quem = `item:${identidade(f, x, i)}`;
    const ecra = ecraDoItem(f, x, i);
    if (!eObjecto(x)) { juntar('bloqueia', `${quem}:forma`, ecra, `Um item de «${ECRAS[f]}» não tem a forma de sempre: a secção não aparece. Só o Renato o pode corrigir.`, { campo: `${k}.${i}` }); return; }
    fazer(x, i, { quem, ecra, campo: (c) => `${k}.${i}.${c}` });
  });
}
/* Dois itens com o mesmo nome confundem-se (nas mensagens e ao juntar duas gravações). */
function conferirRepetidos(juntar, f, lista, { mensagem }) {
  const vistos = new Map();
  lista.forEach((x, i) => {
    const n = eObjecto(x) && typeof x[NOME_DO_ITEM[f]] === 'string' ? x[NOME_DO_ITEM[f]].trim().toLowerCase() : '';
    if (!n) return;
    if (vistos.has(n)) juntar('avisa', `item:${identidade(f, x, i)}:repetido`, ecraDoItem(f, x, i), mensagem, { campo: `${LISTAS[f]}.${i}.${NOME_DO_ITEM[f]}` });
    else vistos.set(n, i);
  });
}

/* --- Trabalhos (data/gallery.json) ----------------------------------------------
   A galeria desenha cada fotografia (as versões leves do webp.py, quando já
   existem) com a legenda por baixo; o prerender.py faz com elas o sitemap das
   imagens, com a legenda como título. */
export function problemasDaGaleria(o, { existe = null } = {}) {
  const f = 'gallery';
  const { out, juntar } = caderno(f);
  conferirHead(juntar, f, o.head);
  const lista = lerLista(juntar, f, o, { vazia: 'Não há trabalhos: a galeria fica vazia no site.', max: TAMANHOS.itensGaleria });
  if (!lista) return out;
  const vistas = new Map();
  cadaItem(juntar, f, lista, (x, i, { quem, ecra, campo }) => {
    conferirTextos(juntar, x, [['img', TAMANHOS.caminhoFoto, 'Fotografia'], ['cap', TAMANHOS.cap, 'Legenda']], { prefixo: `items.${i}.`, chave: quem, ecra });
    conferirFoto(juntar, x.img, { campo: campo('img'), chave: `${quem}:img`, ecra, existe });
    const img = limpo(x.img);
    if (img) {
      const c = noRepositorio(img);
      if (vistas.has(c)) juntar('avisa', `${quem}:repetida`, ecra, 'Esta fotografia já está na galeria: aparecia duas vezes.', { campo: campo('img') });
      vistas.set(c, i);
    }
    if (textoDe(x.cap) !== null && !limpo(x.cap) && img) juntar('avisa', `${quem}:cap:vazia`, ecra, 'Sem legenda, quem vê (e o Google) não sabe o que é: diga o que se fez (ex.: «Hoodie com estampagem DTF»).', { campo: campo('cap'), lembrete: true });
  });
  return out;
}

/* --- Serviços (data/services.json) ------------------------------------------------
   A folha de autocolantes: o desenho e o nome de cada um. A descrição não
   aparece na página, mas o prerender.py põe-na nos dados estruturados (o que o
   Google lê), com o nome — s['title'] de cada um: sem a chave, rebenta. */
export function problemasDosServicos(o) {
  const f = 'services';
  const { out, juntar } = caderno(f);
  conferirHead(juntar, f, o.head);
  const lista = lerLista(juntar, f, o, { vazia: 'Não há serviços: a secção «O que fazemos» fica vazia no site.', max: TAMANHOS.itensServicos });
  if (!lista) return out;
  cadaItem(juntar, f, lista, (x, i, { quem, ecra, campo }) => {
    if (!tem(x, 'title')) { juntar('bloqueia', `${quem}:title:falta`, ecra, 'Este serviço não tem o campo do nome: o site não se consegue gerar. Só o Renato o pode corrigir.', { campo: campo('title') }); return; }
    if (!ausente(x.title) && typeof x.title !== 'string') { juntar('bloqueia', `${quem}:title:tipo`, ecra, 'O nome deste serviço não está escrito como texto: o site não se consegue gerar. Escreva-o outra vez.', { campo: campo('title') }); return; }
    conferirTextos(juntar, x, [['icon', 30, 'Desenho'], ['title', TAMANHOS.tituloServico, 'Nome do serviço'], ['desc', TAMANHOS.descricaoServico, 'Descrição']], { prefixo: `services.${i}.`, chave: quem, ecra });
    conferirPreciso(juntar, x, 'title', { campo: campo('title'), chave: quem, ecra, mensagem: 'Este serviço não tem nome: o autocolante aparece vazio.' });
    const ic = textoDe(x.icon);
    if (ic !== null && ic && !Object.hasOwn(ICONES, ic)) juntar('avisa', `${quem}:icon`, ecra, `O desenho «${ic}» não existe: no site aparece a estrela. Escolha um dos desenhos.`, { campo: campo('icon') });
  });
  conferirRepetidos(juntar, f, lista, { mensagem: 'Há dois serviços com este nome: mude um deles.' });
  return out;
}

/* --- Catálogo Têxtil (data/models.json) ------------------------------------------
   Cada modelo: a fotografia, a categoria (o filtro), o nome e a descrição
   curta, e as quatro linhas da ficha (gramagem, tecido, tamanhos e cores); o
   botão leva ao WhatsApp com o nome do modelo. */
export function problemasDosModelos(o, { existe = null } = {}) {
  const f = 'models';
  const { out, juntar } = caderno(f);
  conferirHead(juntar, f, o.head);
  const lista = lerLista(juntar, f, o, { vazia: 'Não há modelos: o Catálogo Têxtil fica vazio no site.', max: TAMANHOS.itensModelos });
  if (!lista) return out;
  cadaItem(juntar, f, lista, (x, i, { quem, ecra, campo }) => {
    conferirTextos(juntar, x, [['name', TAMANHOS.nomeModelo, 'Nome'], ['cat', TAMANHOS.categoria, 'Categoria'], ['img', TAMANHOS.caminhoFoto, 'Fotografia'], ['tag', TAMANHOS.tag, 'Descrição curta'],
      ['gsm', TAMANHOS.gsm, 'Gramagem'], ['fabric', TAMANHOS.tecido, 'Tecido'], ['gender', 30, 'Género'], ['sizes_label', TAMANHOS.rotuloTamanhos, 'Nome do 3.º campo'], ['sizes', TAMANHOS.tamanhos, 'Tamanhos']],
    { prefixo: `models.${i}.`, chave: quem, ecra });
    conferirPreciso(juntar, x, 'name', { campo: campo('name'), chave: quem, ecra, mensagem: 'Este modelo não tem nome: o cartão aparece sem título.' });
    const cat = textoDe(x.cat);
    if (cat !== null && !CATEGORIAS_MODELOS.includes(cat)) juntar('avisa', `${quem}:cat`, ecra, cat.trim() ? `A categoria «${cat}» não é uma das do site: o modelo só aparece em «Todos». Escolha uma da lista.` : 'Escolha a categoria: sem ela o modelo só aparece em «Todos».', { campo: campo('cat') });
    conferirFoto(juntar, x.img, { campo: campo('img'), chave: `${quem}:img`, ecra, existe });
    const cores = x.colors;
    if (!ausente(cores) && cores !== '' && !(Number.isInteger(cores) && cores >= 1 && cores <= TAMANHOS.cores)) juntar('avisa', `${quem}:colors`, ecra, `O número de cores tem de ser um número inteiro, de 1 a ${TAMANHOS.cores}.`, { campo: campo('colors') });
  });
  conferirRepetidos(juntar, f, lista, { mensagem: 'Há dois modelos com este nome: mude um deles.' });
  return out;
}

/* --- Catálogo Rígidos e Catálogo Lonas e Vinil (data/rigidos.json, lonas.json) ---
   O mesmo desenho nos dois: os filtros são as categorias («Todos» primeiro),
   cada artigo tem as fotografias (a 1.ª é a capa; as setas passam às outras),
   a categoria e as características (uma linha cada). */
function problemasDoCatalogo(f, o, { existe = null } = {}) {
  const { out, juntar } = caderno(f);
  conferirHead(juntar, f, o.head);
  const ecraCats = `${ECRAS[f]} › Categorias`;
  const cats = conferirTextosDaLista(juntar, o.cats, { campo: 'cats', chave: 'cats', ecra: ecraCats, rotulo: 'Categorias', max: TAMANHOS.categoria, maxItens: TAMANHOS.categorias + 1 });
  const nomes = Array.isArray(cats) ? cats.filter((c) => typeof c === 'string') : [];
  if (ausente(o.cats)) juntar('avisa', 'cats:falta', ecraCats, 'O catálogo não tem categorias: os artigos só aparecem todos juntos. Junte as categorias.', { campo: 'cats' });
  else if (Array.isArray(cats)) {
    if (cats[0] !== TODOS) juntar('avisa', 'cats:todos', ecraCats, `O primeiro filtro tem de ser «${TODOS}»: sem ele, quem carrega numa categoria não consegue voltar a ver todos.`, { campo: 'cats' });
    const vistas = new Set();
    nomes.forEach((c, i) => {
      const k = c.trim().toLowerCase();
      if (k && vistas.has(k)) juntar('avisa', `cats:${c.trim()}:repetida`, ecraCats, `A categoria «${c.trim()}» está duas vezes.`, { campo: `cats.${i}` });
      vistas.add(k);
    });
  }
  const lista = lerLista(juntar, f, o, { vazia: `Não há artigos: o ${ECRAS[f]} fica vazio no site.`, max: TAMANHOS.itensArtigos });
  if (!lista) return out;
  cadaItem(juntar, f, lista, (x, i, { quem, ecra, campo }) => {
    conferirTextos(juntar, x, [['name', TAMANHOS.nomeArtigo, 'Nome'], ['cat', TAMANHOS.categoria, 'Categoria']], { prefixo: `products.${i}.`, chave: quem, ecra });
    conferirPreciso(juntar, x, 'name', { campo: campo('name'), chave: quem, ecra, mensagem: 'Este artigo não tem nome: o cartão aparece sem título.' });
    const cat = textoDe(x.cat);
    if (cat !== null && (!cat.trim() || cat === TODOS || (Array.isArray(cats) && !nomes.includes(cat)))) {
      juntar('avisa', `${quem}:cat`, ecra, cat.trim() && cat !== TODOS ? `A categoria «${cat}» não é uma das do catálogo: o artigo só aparece em «${TODOS}». Escolha uma da lista.` : `Escolha a categoria: sem ela o artigo só aparece em «${TODOS}».`, { campo: campo('cat') });
    }
    /* As fotografias: o app.js usa imgs (e, nos antigos, img). */
    const imgs = x.imgs;
    if (!ausente(imgs) && !Array.isArray(imgs)) juntar('bloqueia', `${quem}:imgs:forma`, ecra, 'As fotografias deste artigo não têm a forma de sempre (uma lista): a secção não aparece. Só o Renato a pode corrigir.', { campo: campo('imgs') });
    else {
      const fotos = Array.isArray(imgs) ? imgs : [];
      if (!fotos.length && !limpo(x.img)) juntar('avisa', `${quem}:imgs:vazia`, ecra, 'Este artigo não tem fotografias: no site aparece um quadrado vazio. Junte pelo menos uma.', { campo: campo('imgs') });
      if (fotos.length > TAMANHOS.fotosArtigo) juntar('avisa', `${quem}:imgs:muitas`, ecra, `Este artigo tem ${fotos.length} fotografias: no máximo ${TAMANHOS.fotosArtigo}.`, { campo: campo('imgs') });
      const vistas = new Set();
      fotos.forEach((g, j) => {
        const cg = `products.${i}.imgs.${j}`;
        const qf = `${quem}:img:${typeof g === 'string' && g.trim() ? noRepositorio(g) : j + 1}`;
        conferirFoto(juntar, g, { campo: cg, chave: qf, ecra, existe, rotulo: `A ${j + 1}.ª fotografia` });
        if (typeof g === 'string' && g.trim()) {
          if (vistas.has(noRepositorio(g))) juntar('avisa', `${qf}:repetida`, ecra, `A ${j + 1}.ª fotografia já lá está: aparecia duas vezes.`, { campo: cg });
          vistas.add(noRepositorio(g));
        }
      });
    }
    /* As características: o app.js faz (p.specs || []).map(s => s.label, s.value). */
    const specs = x.specs;
    if (!ausente(specs) && !Array.isArray(specs)) { juntar('bloqueia', `${quem}:specs:forma`, ecra, 'As características deste artigo não têm a forma de sempre (uma lista): a secção não aparece. Só o Renato a pode corrigir.', { campo: campo('specs') }); return; }
    const linhas = Array.isArray(specs) ? specs : [];
    if (linhas.length > TAMANHOS.specs) juntar('avisa', `${quem}:specs:muitas`, ecra, `Este artigo tem ${linhas.length} características: no máximo ${TAMANHOS.specs}.`, { campo: campo('specs') });
    linhas.forEach((s, j) => {
      const cs = `products.${i}.specs.${j}`;
      const qs = `${quem}:spec:${eObjecto(s) && limpo(s.label) ? limpo(s.label) : j + 1}`;
      if (!eObjecto(s)) { juntar('bloqueia', `${qs}:forma`, ecra, `A ${j + 1}.ª característica não tem a forma de sempre: a secção não aparece. Só o Renato a pode corrigir.`, { campo: cs }); return; }
      conferirTextos(juntar, s, [['label', TAMANHOS.rotuloSpec, 'Característica'], ['value', TAMANHOS.valorSpec, 'Valor']], { prefixo: `${cs}.`, chave: qs, ecra });
      if (!limpo(s.label) || !limpo(s.value)) juntar('avisa', `${qs}:vazia`, ecra, `A ${j + 1}.ª característica está por acabar: escreva ${!limpo(s.label) ? 'o nome (ex.: Material)' : 'o valor (ex.: Cerâmica)'}, ou tire a linha.`, { campo: `${cs}.${!limpo(s.label) ? 'label' : 'value'}` });
    });
  });
  conferirRepetidos(juntar, f, lista, { mensagem: 'Há dois artigos com este nome: mude um deles.' });
  return out;
}
export const problemasDosRigidos = (o, opcoes) => problemasDoCatalogo('rigidos', o, opcoes);
export const problemasDasLonas = (o, opcoes) => problemasDoCatalogo('lonas', o, opcoes);

/* --- Como funciona (data/steps.json) ------------------------------------------------
   Os passos, numerados pela ordem. A secção não tem subtítulo. */
export function problemasDosPassos(o) {
  const f = 'steps';
  const { out, juntar } = caderno(f);
  conferirHead(juntar, f, o.head);
  const lista = lerLista(juntar, f, o, { vazia: 'Não há passos: a secção «Como funciona» fica vazia no site.', max: TAMANHOS.passos });
  if (!lista) return out;
  cadaItem(juntar, f, lista, (x, i, { quem, ecra, campo }) => {
    conferirTextos(juntar, x, [['title', TAMANHOS.tituloPasso, 'Título do passo'], ['desc', TAMANHOS.descPasso, 'Descrição']], { prefixo: `steps.${i}.`, chave: quem, ecra });
    conferirPreciso(juntar, x, 'title', { campo: campo('title'), chave: quem, ecra, mensagem: 'Este passo não tem título.' });
  });
  return out;
}

/* --- Perguntas frequentes (data/faq.json) --------------------------------------------
   A lista que abre e fecha, e os dados estruturados (FAQPage): o prerender.py
   lê q['q'] e q['a'] de cada uma — sem as chaves, rebenta. */
export function problemasDasPerguntas(o) {
  const f = 'faq';
  const { out, juntar } = caderno(f);
  conferirHead(juntar, f, o.head);
  const lista = lerLista(juntar, f, o, { max: TAMANHOS.perguntas });
  if (!lista) return out;
  cadaItem(juntar, f, lista, (x, i, { quem, ecra, campo }) => {
    for (const k of ['q', 'a']) {
      if (!tem(x, k)) juntar('bloqueia', `${quem}:${k}:falta`, ecra, `Esta pergunta não tem o campo da ${k === 'q' ? 'pergunta' : 'resposta'}: o site não se consegue gerar. Só o Renato o pode corrigir.`, { campo: campo(k) });
      else if (!ausente(x[k]) && typeof x[k] !== 'string') juntar('bloqueia', `${quem}:${k}:tipo`, ecra, `A ${k === 'q' ? 'pergunta' : 'resposta'} não está escrita como texto: o site não se consegue gerar. Escreva-a outra vez.`, { campo: campo(k) });
    }
    conferirTextos(juntar, x, [['q', TAMANHOS.pergunta, 'Pergunta'], ['a', TAMANHOS.resposta, 'Resposta']], { prefixo: `items.${i}.`, chave: quem, ecra });
    conferirPreciso(juntar, x, 'q', { campo: campo('q'), chave: quem, ecra, mensagem: 'Falta a pergunta.' });
    conferirPreciso(juntar, x, 'a', { campo: campo('a'), chave: quem, ecra, mensagem: 'Falta a resposta.' });
  });
  conferirRepetidos(juntar, f, lista, { mensagem: 'Esta pergunta já está na lista.' });
  return out;
}

/* --- Página (data/site.json) -------------------------------------------------------- */

/* O re do Python que o prerender.py usa no código postal e nas horas: \d e
   \s são os do Unicode, e o strip() tira os espaços do str.isspace(). */
const espacoPy = (c) => /[\t\n\x0B\x0C\r\x1C-\x1F \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/.test(c);
function stripPy(s) {
  let a = 0; let b = s.length;
  while (a < b && espacoPy(s[a])) a++;
  while (b > a && espacoPy(s[b - 1])) b--;
  return s.slice(a, b);
}
/* re.match(r'^(\d{4}-\d{3})\s+(\S.*)$', linha2) — o «.» do Python não apanha o \n. */
const RE_CP = /^(\p{Nd}{4}-\p{Nd}{3})[\t\n\x0B\x0C\r\x1C-\x1F \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+([^\t\n\x0B\x0C\r\x1C-\x1F \x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000][^\n]*)$/u;
export const codigoPostalComoOPrerender = (linha2) => typeof linha2 === 'string' && RE_CP.test(stripPy(linha2));
/* re.match(r'^([01]\d|2[0-3]):[0-5]\d$', h) */
const RE_HORA = /^(?:[01]\p{Nd}|2[0-3]):[0-5]\p{Nd}$/u;
export const horaComoOPrerender = (h) => typeof h === 'string' && RE_HORA.test(h) && /^[0-9:]+$/.test(h);
/* Para o painel: a hora que o prerender aceita E que o site mostra bem (só os
   algarismos de 0 a 9). */
export const horaValida = (h) => typeof h === 'string' && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(h);

export function problemasDoSite(o, { existe = null } = {}) {
  const f = 'site';
  const { out, juntar } = caderno(f);
  const secao = (k) => {
    const v = o[k];
    if (ausente(v)) return null;
    if (!eObjecto(v)) { juntar('bloqueia', `${k}:forma`, ecraDaParte(k), `«${parteDoSite(k)?.[1] ?? k}» não tem a forma de sempre: o site não se consegue gerar. Só o Renato o pode corrigir.`, { campo: k }); return null; }
    return v;
  };

  /* Topo da página ------------------------------------------------------- */
  const hero = secao('hero');
  if (hero) {
    const ecra = ecraDaParte('hero');
    conferirTextos(juntar, hero, [['eyebrow', TAMANHOS.heroEtiqueta, 'Etiqueta pequena'], ['title', TAMANHOS.heroTitulo, 'Título'], ['highlight', TAMANHOS.heroDestaque, 'Palavra destacada'],
      ['title_end', TAMANHOS.heroFim, 'Fim do título'], ['lead', TAMANHOS.heroLead, 'Texto principal'], ['image', TAMANHOS.caminhoFoto, 'Fotografia'], ['badge', TAMANHOS.selo, 'Selo sobre a fotografia'],
      ['cta_primary', TAMANHOS.botao, 'Botão principal'], ['cta_secondary', TAMANHOS.botao, 'Botão secundário']], { prefixo: 'hero.', chave: 'hero', ecra });
    conferirPreciso(juntar, hero, 'title', { campo: 'hero.title', chave: 'hero', ecra, mensagem: 'O título está vazio: o site continua a mostrar o antigo (é o título que mais conta no Google). Escreva-o.' });
    for (const [k, nome] of [['cta_primary', 'O botão principal («Pedir orçamento»)'], ['cta_secondary', 'O botão secundário («Ver portfólio»)']]) {
      conferirPreciso(juntar, hero, k, { campo: `hero.${k}`, chave: 'hero', ecra, mensagem: `${nome} fica sem texto. Escreva o que o botão diz.` });
    }
    conferirFoto(juntar, hero.image, { campo: 'hero.image', chave: 'hero:image', ecra, existe, rotulo: 'A fotografia do topo' });
    conferirTextosDaLista(juntar, hero.audience, { campo: 'hero.audience', chave: 'hero:audience', ecra, rotulo: 'Para quem', max: TAMANHOS.publico, maxItens: TAMANHOS.publicos,
      vazia: 'A lista «Para quem» está vazia: o site continua a mostrar a antiga. Escreva pelo menos uma linha (ex.: Particulares).' });
  }

  /* Contactos ----------------------------------------------------------- */
  const c = secao('contacts');
  if (c) {
    const ecra = ecraDaParte('contacts');
    const campo = (k) => `contacts.${k}`;
    conferirTextos(juntar, c, [['phone', TAMANHOS.telefone, 'Telefone'], ['email', TAMANHOS.email, 'Email'],
      ['address_line1', TAMANHOS.morada, 'Morada (rua e número)'], ['address_line2', TAMANHOS.codigoPostalLocalidade, 'Código postal e localidade'],
      ['instagram_url', TAMANHOS.url, 'Link do Instagram'], ['instagram_handle', TAMANHOS.instagram, 'Nome do Instagram'], ['facebook_url', TAMANHOS.url, 'Link do Facebook'], ['maps_url', TAMANHOS.url, 'Link do Google Maps']],
    { prefixo: 'contacts.', chave: 'contacts', ecra });
    /* O prerender.py faz '+' + phone_intl e 'mailto:' + email: um número
       escrito como número rebenta. */
    for (const [k, nome] of [['phone_intl', 'O número internacional'], ['email', 'O email'], ['instagram_url', 'O link do Instagram']]) {
      if (!ausente(c[k]) && c[k] !== '' && typeof c[k] !== 'string') juntar('bloqueia', `contacts:${k}:tipo-ci`, ecra, `${nome} não está escrito como texto: o site não se consegue gerar. Escreva-o outra vez.`, { campo: campo(k === 'phone_intl' ? 'phone' : k) });
    }
    const tel = textoDe(c.phone); const email = textoDe(c.email);
    const t = tel === null ? undefined : lerTelefone(tel);
    if (!limpo(tel) && !limpo(email)) {
      juntar('bloqueia', 'contacts:sem_contacto', ecra, 'O site ficava sem telefone e sem email: a lei pede um contacto (DL 7/2004, art. 10.º), e os botões do WhatsApp precisam do telefone.', { campo: campo('phone') });
    } else if (!limpo(tel)) {
      juntar('avisa', 'contacts:phone:vazio', ecra, 'Sem telefone, os botões do WhatsApp e o formulário de orçamento ficam sem número. Escreva o telefone.', { campo: campo('phone') });
    } else if (t === undefined) {
      juntar('avisa', 'contacts:phone:forma', ecra, `O telefone («${limpo(tel)}») não é um número português (9 algarismos, a começar por 2 ou por 91, 92, 93 ou 96).`, { campo: campo('phone') });
    } else if (t) {
      const intl = textoDe(c.phone_intl);
      if (intl !== null && intl !== t.intl) juntar('avisa', 'contacts:phone_intl:outro', ecra, `O WhatsApp e o «Ligar» vão para outro número (+${intl || '…'}) e não para ${t.texto}. Escreva o telefone outra vez: o painel acerta os dois.`, { campo: campo('phone') });
    }
    if (limpo(email) && !emailValido(limpo(email))) juntar('avisa', 'contacts:email:forma', ecra, 'O email não parece estar bem escrito (sem acentos nem espaços, ex.: nome@gmail.com).', { campo: campo('email') });
    if (!limpo(email) && email !== null) juntar('avisa', 'contacts:email:vazio', ecra, 'A lei pede um email de contacto no site (DL 7/2004, art. 10.º): escreva-o assim que o tiver.', { campo: campo('email'), lembrete: true });
    const m1 = textoDe(c.address_line1);
    if (m1 !== null && !m1.trim()) juntar('bloqueia', 'contacts:address_line1:vazio', ecra, 'Falta a morada (rua e número): a lei obriga a mostrá-la (DL 7/2004, art. 10.º).', { campo: campo('address_line1') });
    const m2 = c.address_line2;
    /* O prerender.py pára sem «0000-000 Localidade» (os dados estruturados). */
    if (ausente(m2) || (typeof m2 === 'string' && !codigoPostalComoOPrerender(m2))) {
      juntar('bloqueia', 'contacts:address_line2:forma', ecra, `O código postal e a localidade têm de ser o código postal e depois a localidade, ex.: 4815-429 Vizela${limpo(m2) ? ` (está «${limpo(m2)}»)` : ''}.`, { campo: campo('address_line2') });
    }
    const ig = textoDe(c.instagram_url);
    if (ig !== null && !ig.trim()) juntar('avisa', 'contacts:instagram_url:vazio', ecra, 'Sem o link do Instagram, os ícones do Instagram continuam a levar ao endereço antigo. Escreva o link da página.', { campo: campo('instagram_url') });
    else if (ig && !urlHttps(ig.trim())) juntar('avisa', 'contacts:instagram_url:forma', ecra, 'O link do Instagram tem de ser o endereço completo, a começar por https://.', { campo: campo('instagram_url') });
    if (ig && ig.trim() && textoDe(c.instagram_handle) !== null && !limpo(c.instagram_handle)) juntar('avisa', 'contacts:instagram_handle:vazio', ecra, 'Escreva o nome do Instagram (ex.: @artstampcreationpersonalizados): é o texto da ligação nos contactos.', { campo: campo('instagram_handle') });
    for (const [k, nome] of [['facebook_url', 'do Facebook'], ['maps_url', 'do Google Maps']]) {
      const v = textoDe(c[k]);
      if (v && v.trim() && !urlHttps(v.trim())) juntar('avisa', `contacts:${k}:forma`, ecra, `O link ${nome} tem de ser o endereço completo, a começar por https://.`, { campo: campo(k) });
    }
  }

  /* Horário (não aparece na página: vai para os dados estruturados) ------- */
  const h = o.hours;
  const ecraH = ecraDaParte('hours');
  if (!ausente(h) && h !== '' && !Array.isArray(h)) juntar('bloqueia', 'hours:forma', ecraH, 'O horário não tem a forma de sempre: o site não se consegue gerar. Só o Renato o pode corrigir.', { campo: 'hours' });
  if (Array.isArray(h)) {
    if (h.length > TAMANHOS.horario) juntar('avisa', 'hours:muitas', ecraH, `O horário tem ${h.length} linhas: no máximo ${TAMANHOS.horario}.`, { campo: 'hours' });
    h.forEach((b, i) => {
      const quem = `hours:${i + 1}`;
      const campo = (k) => `hours.${i}${k ? `.${k}` : ''}`;
      if (!eObjecto(b)) { juntar('bloqueia', `${quem}:forma`, ecraH, `A ${i + 1}.ª linha do horário não tem a forma de sempre: o site não se consegue gerar.`, { campo: campo('') }); return; }
      for (const k of ['opens', 'closes']) {
        if (!ausente(b[k]) && b[k] !== '' && typeof b[k] !== 'string') juntar('bloqueia', `${quem}:${k}:tipo`, ecraH, `A ${i + 1}.ª linha do horário tem a hora de ${k === 'opens' ? 'abrir' : 'fechar'} escrita como número: o site não se consegue gerar. Escreva-a outra vez (ex.: 09:00).`, { campo: campo(k) });
      }
      let dias = b.days;
      if (typeof dias === 'string') dias = [dias];
      if (!ausente(dias) && dias !== '' && !Array.isArray(dias)) { juntar('bloqueia', `${quem}:days:forma`, ecraH, `Os dias da ${i + 1}.ª linha do horário não têm a forma de sempre.`, { campo: campo('days') }); return; }
      dias = Array.isArray(dias) ? dias : [];
      const abre = typeof b.opens === 'string' ? stripPy(b.opens) : ''; const fecha = typeof b.closes === 'string' ? stripPy(b.closes) : '';
      if (!dias.length || !abre || !fecha) {
        juntar('avisa', `${quem}:incompleta`, ecraH, `A ${i + 1}.ª linha do horário está incompleta (${!dias.length ? 'sem dias' : !abre ? 'sem a hora de abrir' : 'sem a hora de fechar'}): fica de fora. Complete-a ou tire-a.`, { campo: campo(!dias.length ? 'days' : !abre ? 'opens' : 'closes') });
        return;
      }
      for (const [k, v] of [['opens', abre], ['closes', fecha]]) {
        if (!horaComoOPrerender(v)) juntar('bloqueia', `${quem}:${k}:forma`, ecraH, `A hora de ${k === 'opens' ? 'abrir' : 'fechar'} da ${i + 1}.ª linha («${v}») tem de ser HH:MM, de 00:00 a 23:59 (ex.: 09:00).`, { campo: campo(k) });
      }
      if (dias.some((d) => typeof d !== 'string' || !Object.hasOwn(DIAS, d))) juntar('avisa', `${quem}:days:fora`, ecraH, `A ${i + 1}.ª linha do horário tem um dia que não existe: escolha os dias outra vez.`, { campo: campo('days') });
      if (new Set(dias).size !== dias.length) juntar('avisa', `${quem}:days:repetidos`, ecraH, `A ${i + 1}.ª linha do horário tem um dia repetido.`, { campo: campo('days') });
      if (horaValida(abre) && horaValida(fecha) && abre >= fecha) juntar('avisa', `${quem}:horas`, ecraH, `Na ${i + 1}.ª linha do horário, fecha (${fecha}) antes de abrir (${abre}).`, { campo: campo('closes') });
    });
  }

  /* Pedido de orçamento (a secção «Contacto»: os títulos e o formulário) ---- */
  const ct = secao('contacto');
  if (ct) {
    const ecra = ecraDaParte('contacto');
    conferirHead(juntar, f, ct, { campo: 'contacto', ecra, chave: 'contacto' });
    conferirTextosDaLista(juntar, ct.form_options, { campo: 'contacto.form_options', chave: 'contacto:form_options', ecra, rotulo: 'O que precisa?', max: TAMANHOS.opcao, maxItens: TAMANHOS.opcoes,
      vazia: 'A lista «O que precisa?» está vazia: o formulário continua com as opções antigas. Escreva pelo menos uma.' });
  }

  /* Empresas (a faixa escura) --------------------------------------------- */
  const b = secao('b2b');
  if (b) {
    const ecra = ecraDaParte('b2b');
    conferirHead(juntar, f, b, { campo: 'b2b', ecra, chave: 'b2b' });
    conferirTextos(juntar, b, [['cta_label', TAMANHOS.botao, 'Botão'], ['image', TAMANHOS.caminhoFoto, 'Fotografia']], { prefixo: 'b2b.', chave: 'b2b', ecra });
    conferirPreciso(juntar, b, 'cta_label', { campo: 'b2b.cta_label', chave: 'b2b', ecra, mensagem: 'O botão fica sem texto. Escreva o que o botão diz.' });
    conferirTextosDaLista(juntar, b.list, { campo: 'b2b.list', chave: 'b2b:list', ecra, rotulo: 'Lista', max: TAMANHOS.itemLista, maxItens: TAMANHOS.itensLista });
    conferirFoto(juntar, b.image, { campo: 'b2b.image', chave: 'b2b:image', ecra, existe, rotulo: 'A fotografia da faixa' });
  }

  /* Rodapé e titular ------------------------------------------------------- */
  for (const [k, max, rotulo] of [['footer_tagline', TAMANHOS.rodape, 'Frase do rodapé'], ['owner_name', TAMANHOS.nomeTitular, 'Nome do titular']]) {
    const v = o[k];
    if (ausente(v)) continue;
    if (typeof v !== 'string') juntar('avisa', `${k}:tipo`, ecraDaParte(k), `«${rotulo}» não está escrito como texto: escreva-o outra vez.`, { campo: k });
    else if (v.length > max) juntar('avisa', `${k}:comprido`, ecraDaParte(k), `«${rotulo}» tem ${v.length} caracteres: no máximo ${max}.`, { campo: k });
  }
  if (textoDe(o.owner_name) !== null && !limpo(o.owner_name)) juntar('avisa', 'owner_name:vazio', ecraDaParte('owner_name'), 'Falta o nome do titular: a lei obriga a mostrá-lo no site (DL 7/2004, art. 10.º). Escreva o nome completo, como nas Finanças.', { campo: 'owner_name' });
  return out;
}

const PROBLEMAS_DE = {
  gallery: problemasDaGaleria, rigidos: problemasDosRigidos, models: problemasDosModelos, lonas: problemasDasLonas,
  services: problemasDosServicos, steps: problemasDosPassos, faq: problemasDasPerguntas, site: problemasDoSite,
};

/**
 * OS PROBLEMAS DOS DADOS (ver o cabeçalho: dados e opcoes).
 * → a lista dos problemas, pela ordem dos ficheiros.
 */
export function problemas(dados, { existe = null } = {}) {
  const out = [];
  for (const f of ORDEM) {
    if (!dados || !Object.prototype.hasOwnProperty.call(dados, f)) continue;
    const r = lerFicheiro(f, dados[f]);
    if (r.problema) { out.push(r.problema); continue; }
    out.push(...PROBLEMAS_DE[f](r.obj, { existe }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* As fotografias que os dados usam                                    */
/* ------------------------------------------------------------------ */

/**
 * TODOS OS CAMPOS DE FOTOGRAFIA DOS DADOS: [{ f, campo, valor, ecra }].
 */
export function fotografiasDosDados(dados) {
  const out = [];
  const ler = (f) => { if (!dados || !Object.prototype.hasOwnProperty.call(dados, f)) return null; const r = lerFicheiro(f, dados[f]); return r.obj ?? null; };
  const juntar = (f, campo, valor, ecra) => { if (typeof valor === 'string' && valor.trim()) out.push({ f, campo, valor, ecra }); };
  const lista = (o, k) => (Array.isArray(o?.[k]) ? o[k] : []);
  const gal = ler('gallery');
  lista(gal, 'items').forEach((x, i) => { if (eObjecto(x)) juntar('gallery', `items.${i}.img`, x.img, ecraDoItem('gallery', x, i)); });
  const mod = ler('models');
  lista(mod, 'models').forEach((x, i) => { if (eObjecto(x)) juntar('models', `models.${i}.img`, x.img, ecraDoItem('models', x, i)); });
  for (const f of ['rigidos', 'lonas']) {
    lista(ler(f), 'products').forEach((x, i) => {
      if (!eObjecto(x)) return;
      lista(x, 'imgs').forEach((g, j) => juntar(f, `products.${i}.imgs.${j}`, g, ecraDoItem(f, x, i)));
      juntar(f, `products.${i}.img`, x.img, ecraDoItem(f, x, i));
    });
  }
  const site = ler('site');
  if (eObjecto(site)) {
    if (eObjecto(site.hero)) juntar('site', 'hero.image', site.hero.image, ecraDaParte('hero'));
    if (eObjecto(site.b2b)) juntar('site', 'b2b.image', site.b2b.image, ecraDaParte('b2b'));
  }
  return out;
}

/* As variantes de um original: as do webp.py (na pasta webp/ ao lado) e as
   escritas à mão ao lado dele (<nome>-<número>.webp). */
function eVarianteDe(variante, original) {
  const o = noRepositorio(original); const v = noRepositorio(variante);
  const pasta = o.slice(0, o.lastIndexOf('/'));
  const base = o.slice(pasta.length + 1).replace(/\.[a-z0-9]+$/i, '');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc(pasta)}/(?:webp/)?${esc(base)}-\\d+\\.webp$`, 'i').test(v);
}

/**
 * ONDE UM ORIGINAL DA BIBLIOTECA É USADO: os campos dos dados que o mostram
 * (o caminho tal e qual) e as partes fixas do index.html (`fixas`:
 * fotografiasFixas — o original ou uma variante dele).
 * → [{ ecra, campo?, f? }] ([] = sem uso)
 */
export function usosDe(original, usados, fixas = new Set()) {
  const c = noRepositorio(original);
  const out = [];
  for (const u of usados) if (noRepositorio(u.valor) === c) out.push({ ecra: u.ecra, campo: u.campo, f: u.f });
  if ([...fixas].some((x) => x === c || eVarianteDe(x, c))) out.push({ ecra: 'Uma parte fixa da página' });
  return out;
}

/**
 * O QUE SAI DO REPOSITÓRIO QUANDO SE APAGA UM ORIGINAL: ele, e as variantes
 * dele (as do webp.py e as escritas à mão), a menos que outro original com o
 * mesmo nome base continue na mesma pasta (as variantes são dos dois).
 *   caminhos  todos os ficheiros das pastas da biblioteca
 * → [caminho]
 */
export function aApagarCom(original, caminhos) {
  const c = noRepositorio(original);
  const b = bibliotecaDe(c);
  if (!b) return [];
  const { pasta } = BIBLIOTECAS[b];
  const base = c.slice(pasta.length + 1).replace(/\.[a-z0-9]+$/i, '');
  const todos = [...caminhos].map(noRepositorio);
  const outro = todos.some((x) => x !== c && bibliotecaDe(x) === b && x.slice(pasta.length + 1).replace(/\.[a-z0-9]+$/i, '') === base);
  return [c, ...(outro ? [] : todos.filter((x) => x !== c && eVarianteDe(x, c)))];
}

/* ------------------------------------------------------------------ */
/* O que o painel não muda                                             */
/* ------------------------------------------------------------------ */

/**
 * O QUE UMA GRAVAÇÃO NÃO PODE MUDAR num ficheiro (o painel conserva-o; um
 * pedido que o mudasse é um defeito, ou não veio do painel):
 *   · as chaves que o painel não conhece (no topo do ficheiro, nos títulos da
 *     secção e dentro das secções da página) ficam como estão;
 *   · na página, o número internacional — que só pode mudar para o do
 *     telefone escrito.
 * → [{ caminho, motivo }]
 */
export function mudancasBloqueadas(antes, depois, f) {
  const out = [];
  if (!eObjecto(depois) || !CAMPOS[f]) return out;
  const a = eObjecto(antes) ? antes : {};
  const conhecidas = new Set(CAMPOS[f].topo);
  for (const k of new Set([...Object.keys(a), ...Object.keys(depois)])) {
    if (!conhecidas.has(k) && !igual(a[k], depois[k])) out.push({ caminho: k, motivo: 'desconhecido' });
  }
  const dentro = (sec, campos) => {
    const x = eObjecto(a[sec]) ? a[sec] : {}; const y = eObjecto(depois[sec]) ? depois[sec] : {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (!campos.includes(k) && !igual(x[k], y[k])) out.push({ caminho: `${sec}.${k}`, motivo: 'desconhecido' });
  };
  if (f !== 'site') dentro('head', CAMPOS.head);
  if (f === 'site') {
    for (const sec of SECCOES_SITE) dentro(sec, CAMPOS.site[sec]);
    const ac = eObjecto(a.contacts) ? a.contacts : {}; const dc = eObjecto(depois.contacts) ? depois.contacts : {};
    if (!igual(ac.phone_intl, dc.phone_intl)) {
      const t = lerTelefone(dc.phone);
      if (!(t && dc.phone_intl === t.intl)) out.push({ caminho: 'contacts.phone_intl', motivo: 'escondido' });
    }
  }
  return out;
}
