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
 * O que depende dos dados (data/site.json, editado no Pages CMS): o telefone
 * (a frase da nota) e o email (o canal dos direitos da privacidade). Nada se
 * inventa: sem email, o bloco dos direitos indica o telefone e a morada.
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
  }, { modo: 'avisar', ecra: { '*': 'Pages CMS › Geral › Contactos', nome: 'Pages CMS › Geral › Nome do titular', nif: 'legal/termos.html (o NIF não está no backoffice)' } });
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
