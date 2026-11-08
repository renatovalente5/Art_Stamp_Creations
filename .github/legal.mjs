#!/usr/bin/env node
/* AS PEÇAS LEGAIS COMUNS, ESCRITAS NO HTML (a biblioteca legal-comum, em
 * legal-comum/, instalada por _ferramentas/legal-comum/instalar.mjs).
 *
 * O site é HTML escrito à mão, congelado pelo prerender.py. As peças que a lei
 * manda ter e que são iguais em todos os sites do Renato — a ligação ao Livro
 * de Reclamações, a nota do custo da chamada junto de cada número, a lista dos
 * centros de arbitragem, a tabela dos destinatários da política de privacidade
 * e o bloco dos direitos — não se escrevem à mão: saem daqui, da biblioteca,
 * para dentro dos marcadores
 *
 *     <!-- legal-comum:<peça> v<versão> -->…<!-- /legal-comum:<peça> -->
 *
 * em index.html e em legal/*.html, e o CSS do Livro para dentro de
 *
 *     /* legal-comum:livro-css v<versão> *​/…/* /legal-comum:livro-css *​/
 *
 * em assets/css/styles.css. Correr outra vez não muda nada (é idempotente): o
 * prerender.yml corre-o antes do prerender.py, e o passo que grava commita o
 * que mudou (index.html, legal/ e assets/css/styles.css estão nos ALVOS).
 *
 * O que depende dos dados (data/site.json, editado no painel): o telefone
 * (a frase da nota) e o email (o canal dos direitos da privacidade). Nada se
 * inventa: sem email, o bloco dos direitos indica o telefone e a morada.
 *
 * Nos Termos (legal/termos.html) saem também daqui as peças da venda à
 * distância (DL 24/2014, arts. 4.º, 6.º, 10.º a 13.º e 17.º; DL 84/2021): os
 * passos da encomenda adaptados ao orçamento (não há carrinho nem botão de
 * pagar), a livre resolução — sem os 14 dias no personalizado —, o formulário
 * de livre resolução com o nome, a morada e o email do titular (data/site.json;
 * sem eles, fica como estava e avisa) e a frase da garantia.
 *
 * A guarda da identificação (DL 7/2004, art. 10.º: nome, NIF, morada, email)
 * só AVISA — nunca pára a publicação. O NIF não está no data/site.json: lê-se
 * do que as páginas mostram (legal/termos.html), que é o que conta. No GitHub
 * Actions os avisos saem como anotações ::warning.
 *
 *     node .github/legal.mjs              escreve o que mudou
 *     node .github/legal.mjs --verificar  não escreve; sai com 1 se algo estiver desactualizado
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSAO, esc, livroReclamacoes, livroCss, notaChamada, destinatariosHtml, frasesPrivacidade,
  direitosHtml, DIREITOS, CNPD_URL, ralHtml, verificarIdentificacao,
  GARANTIA_BENS, LIVRE_RESOLUCAO, SEM_LIVRE_RESOLUCAO_PERSONALIZADO, formularioLivreResolucao,
} from '../legal-comum/index.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFICAR = process.argv.includes('--verificar');
const NO_CI = process.env.GITHUB_ACTIONS === 'true';

/* As cores do botão com caixa do Livro (a variante «botao», que o livroCss()
   escreve sempre e que o site não usa): a tinta da marca sobre o laranja da
   raposa (6,8:1). O site usa a variante DISCRETA (por omissão desde a v1.1.0,
   a pedido do Renato): ícone e texto com a letra e a cor das ligações
   vizinhas, sem caixa, e só no rodapé. */
export const CORES_LIVRO = Object.freeze({ cor: '#26261A', fundo: '#FA9431' });

/* Quem recebe mesmo dados a propósito deste site (a tabela da privacidade):
   o GitHub Pages aloja-o; o email é uma caixa Gmail (Google); o mapa é da
   Google e só carrega ao clique; o formulário não tem servidor — monta a
   mensagem e abre o WhatsApp (Meta), como os botões; o Instagram é da Meta.
   Não há analytics, pagamentos nem serviços de formulários. */
export function destinatariosDe(site) {
  const c = site.contacts || {};
  const gmail = /@(gmail|googlemail)\.com$/i.test(String(c.email ?? '').trim());
  return {
    alojamento: 'github-pages',
    email: gmail ? 'google' : undefined,
    mapas: 'google',
    whatsapp: true,
    instagram: Boolean(c.instagram_url),
    facebookPage: Boolean(c.facebook_url),
  };
}

/* Sem email não há direitosHtml (a biblioteca exige-o): o mesmo bloco, com os
   mesmos direitos (DIREITOS) e a CNPD, mas com o telefone e a morada da
   identificação como canal. */
function direitosSemEmail() {
  const itens = DIREITOS.map((d) => `<li><strong>${esc(d.nome)}</strong>: ${esc(d.descricao)}</li>`);
  return [
    '<div class="direitos" lang="pt">',
    '<p>Pode exercer os seus direitos pelo telefone ou pela morada indicados na identificação, no topo desta página. Respondemos no prazo de um mês (RGPD, art. 12.º, n.º 3).</p>',
    '<ul>', ...itens, '</ul>',
    `<p>Se achar que o tratamento não cumpre a lei, pode reclamar à Comissão Nacional de Protecção de Dados: <a href="${CNPD_URL}" target="_blank" rel="noopener">cnpd.pt</a>.</p>`,
    '</div>',
  ].join('\n');
}

/* «Como se faz a encomenda» (DL 7/2004, arts. 27.º a 31.º; DL 24/2014, arts.
   4.º e 6.º): a lista da biblioteca, COMO_SE_FAZ_A_ENCOMENDA({ canal:
   'whatsapp' }), adaptada ao orçamento — aqui não há carrinho nem botão de
   pagar: o pedido vem pelo formulário do site (que abre o WhatsApp) ou pelo
   WhatsApp, a Art Stamp responde com o orçamento (artigos, total com IVA,
   portes, prazo e forma de pagamento) e a encomenda fica feita quando o
   cliente o aceita por escrito; a confirmação vai por email, com estas
   condições. Sem a fórmula feita do art. 5.º, n.º 4 (decisão do Renato, 8 nov
   2026); os 5 dias e os 10 anos são os da biblioteca. */
function comoSeFazAEncomenda() {
  const passos = [
    'Pede-nos orçamento pelo formulário do site ou pelo WhatsApp, dizendo os artigos que quer (tipo, quantidade e, se houver, as opções e a arte a aplicar).',
    'Enviamos-lhe o orçamento com os artigos, o preço total com IVA, os portes, o prazo e a forma de pagamento. Antes de aceitar, confira tudo e peça-nos para corrigir qualquer erro.',
    'A encomenda fica feita quando aceita o orçamento por escrito, por mensagem ou por email.',
    'Até 5 dias depois e sempre antes da entrega, recebe por email a confirmação da encomenda, com estas condições em anexo.',
    'O contrato é feito em português. Guardamos o orçamento aceite e a confirmação durante 10 anos e pode pedir-nos uma cópia a qualquer momento. Estas condições podem ser guardadas e impressas.',
  ];
  return `<ol class="como-encomendar" lang="pt">\n${passos.map((p) => `<li>${p}</li>`).join('\n')}\n</ol>`;
}

/* A livre resolução (DL 24/2014, arts. 10.º a 13.º e 17.º, n.º 1): o
   personalizado — quase tudo o que a Art Stamp faz — não tem os 14 dias; o
   que não leva personalização tem. Os textos são os da biblioteca; a frase
   dos custos da devolução é a do art. 13.º, n.º 2 (sem a dizer, era a loja a
   pagá-los — n.º 3). */
function livreResolucaoHtml() {
  return [
    '<div class="livre-resolucao" lang="pt">',
    `<p><strong>Artigos personalizados.</strong> ${esc(SEM_LIVRE_RESOLUCAO_PERSONALIZADO)}</p>`,
    `<p><strong>Artigos sem personalização.</strong> ${esc(LIVRE_RESOLUCAO)} Os custos da devolução do bem ficam a seu cargo (Decreto-Lei n.º 24/2014, art. 13.º, n.º 2).</p>`,
    '</div>',
  ].join('\n');
}

/** As peças, pelo nome do marcador. Cada uma devolve o HTML, ou null quando não há como a escrever. */
export function pecas(site, avisar = () => {}) {
  const c = site.contacts || {};
  const email = String(c.email ?? '').trim();
  const nota = notaChamada(String(c.phone ?? ''), { frase: 'com-a' });
  if (!nota) avisar(`O telefone «${c.phone ?? ''}» não é um número nacional (2…, 9… ou 800…): a nota do custo da chamada fica como estava.`);
  return {
    livro: () => livroReclamacoes(),
    // a classe call-note é a que o site já usava junto de cada número
    'nota-chamada': () => (nota ? `<small class="call-note">(${esc(nota)})</small>` : null),
    privacidade: () => destinatariosHtml(destinatariosDe(site)),
    'privacidade-frases': () => frasesPrivacidade({ ...destinatariosDe(site), repositorioPublico: true }).map((f) => `<p>${esc(f)}</p>`).join('\n'),
    direitos: () => (email ? direitosHtml({ email }) : direitosSemEmail()),
    // os 10 centros (âmbito nacional): o competente é o do domicílio do consumidor
    ral: () => ralHtml({ ambito: 'nacional' }),
    // os Termos: a venda à distância (os nomes das peças são os do cli.mjs da biblioteca)
    'encomenda-passos': () => comoSeFazAEncomenda(),
    'encomenda-livre-resolucao': () => livreResolucaoHtml(),
    // o formulário do Anexo (Parte B) do DL 24/2014, já com o titular; nada se inventa
    'encomenda-formulario': () => {
      const nome = String(site.owner_name ?? '').trim();
      const morada = [c.address_line1, c.address_line2].map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
      if (!nome || !morada || !email) {
        avisar('Falta o nome do titular, a morada ou o email em data/site.json: o formulário de livre resolução fica como estava.');
        return null;
      }
      return `<pre class="formulario" lang="pt">${esc(formularioLivreResolucao({ nome, morada, email }))}</pre>`;
    },
    // DL 84/2021, art. 12.º: a frase única (3 anos; presunção de 2; +6 meses por reparação)
    garantia: () => `<p>${esc(GARANTIA_BENS)}</p>`,
  };
}

const MARCADOR_HTML = /<!-- legal-comum:([\w-]+) v\d+\.\d+\.\d+ -->[\s\S]*?<!-- \/legal-comum:\1 -->/g;
const MARCADOR_CSS = /\/\* legal-comum:livro-css v\d+\.\d+\.\d+ \*\/[\s\S]*?\/\* \/legal-comum:livro-css \*\//;

/** O HTML de uma página com as peças escritas; devolve também as peças que lá estão. */
export function aplicarHtml(html, PECAS) {
  const vistas = new Set();
  const novo = html.replace(MARCADOR_HTML, (todo, peca) => {
    vistas.add(peca);
    const gerar = PECAS[peca];
    if (!gerar) return todo;                      // um marcador que esta versão não conhece fica como está
    const conteudo = gerar();
    if (conteudo === null) return todo;
    const multilinha = conteudo.includes('\n');
    return `<!-- legal-comum:${peca} v${VERSAO} -->${multilinha ? '\n' : ''}${conteudo}${multilinha ? '\n' : ''}<!-- /legal-comum:${peca} -->`;
  });
  return { html: novo, vistas };
}

export function aplicarCss(css) {
  const bloco = `/* legal-comum:livro-css v${VERSAO} */\n${livroCss('lr-botao', CORES_LIVRO)}\n/* /legal-comum:livro-css */`;
  if (!MARCADOR_CSS.test(css)) return { css, tinha: false };
  return { css: css.replace(MARCADOR_CSS, bloco), tinha: true };
}

/** O NIF que as páginas mostram (o da identificação nos Termos). */
export function nifPublicado(html) {
  const m = /NIF:?\s*(?:<[^>]+>\s*)*([\d\s]{9,11})/.exec(String(html));
  return m ? m[1].replace(/\s/g, '') : '';
}

/* A guarda da identificação, em modo avisar. */
export function avisosDosDados(site, nif) {
  const c = site.contacts || {};
  const r = verificarIdentificacao({
    nome: site.owner_name,
    formaJuridica: 'eni',
    nif,
    morada: [c.address_line1, c.address_line2].filter(Boolean).join(', '),
    email: c.email,
    telefone: c.phone,
  }, { modo: 'avisar', ecra: { '*': 'Página › Contactos', nome: 'Página › Dados legais', nif: 'legal/termos.html (o NIF não está no painel)' } });
  return r.problemas.map((p) => `Identificação (DL 7/2004, art. 10.º) — ${p.mensagem}`);
}

const escMsg = (s) => String(s).replace(/##\[/g, '## [').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

function main() {
  const site = JSON.parse(readFileSync(join(RAIZ, 'data', 'site.json'), 'utf8'));
  const avisos = [];
  const PECAS = pecas(site, (m) => avisos.push(m));

  const paginas = ['index.html', ...readdirSync(join(RAIZ, 'legal')).filter((f) => f.endsWith('.html')).sort().map((f) => `legal/${f}`)];
  const mudadas = [];
  const contagem = {};
  for (const rel of paginas) {
    const caminho = join(RAIZ, rel);
    const antes = readFileSync(caminho, 'utf8');
    const { html, vistas } = aplicarHtml(antes, PECAS);
    for (const p of vistas) contagem[p] = (contagem[p] ?? 0) + 1;
    if (html !== antes) {
      mudadas.push(rel);
      if (!VERIFICAR) writeFileSync(caminho, html);
    }
  }
  if (!contagem.livro) avisos.push('Nenhuma página tem o marcador legal-comum:livro — a ligação ao Livro de Reclamações não está a ser escrita.');
  if (!contagem.ral) avisos.push('Nenhuma página tem o marcador legal-comum:ral — os centros de arbitragem não estão a ser escritos.');

  const cssCaminho = join(RAIZ, 'assets', 'css', 'styles.css');
  const cssAntes = readFileSync(cssCaminho, 'utf8');
  const { css, tinha } = aplicarCss(cssAntes);
  if (!tinha) avisos.push('assets/css/styles.css não tem o bloco /* legal-comum:livro-css */ — o Livro fica sem o CSS da biblioteca.');
  if (css !== cssAntes) {
    mudadas.push('assets/css/styles.css');
    if (!VERIFICAR) writeFileSync(cssCaminho, css);
  }

  avisos.push(...avisosDosDados(site, nifPublicado(readFileSync(join(RAIZ, 'legal', 'termos.html'), 'utf8'))));

  for (const a of avisos) {
    console.log(`  AVISO: ${a}`);
    if (NO_CI) console.log(`::warning title=Peças legais (legal-comum)::${escMsg(a)}`);
  }
  console.log(`  peças: ${Object.entries(contagem).map(([k, v]) => `${k}×${v}`).join(', ') || 'nenhuma'} (legal-comum v${VERSAO})`);
  if (VERIFICAR) {
    console.log(`Peças legais ${mudadas.length ? `DESATUALIZADAS em ${mudadas.join(', ')}` : 'em dia'}`);
    return mudadas.length ? 1 : 0;
  }
  console.log(mudadas.length ? `Peças legais escritas em ${mudadas.join(', ')}` : 'Peças legais já estavam em dia');
  return 0;
}

const souOPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (souOPrincipal) process.exit(main());
