/* =============================================================
   ART STAMP CREATIONS — app.js
   Renderiza secções a partir de data/*.json (editável no backoffice):
   serviços, modelos base (THCLOTHES) e galeria de trabalhos.
   ============================================================= */
(function () {
  'use strict';
  var doc = document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function normImg(p) { if (!p) return ''; if (/^https?:\/\//.test(p)) return p; return p.replace(/^\/+/, ''); }
  function getJSON(url) { return fetch(url, { cache: 'default' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  /* Dimensões reais de cada ficheiro de imagem, geradas no build por
     .github/scripts/dimensoes.py. Servem para emitir width/height nos <img>: sem
     elas o browser não reserva espaço, as fotos da galeria colapsam todas dentro
     do primeiro ecrã e o loading="lazy" deixa de adiar nada (4,2 MB medidos numa
     primeira carga a 1280px). Se o ficheiro faltar, nada rebenta — volta-se ao
     comportamento antigo. */
  var DIMS = {};
  var dimsProntas = getJSON('data/_dimensoes.json')
    .then(function (d) { DIMS = d || {}; })
    .catch(function () { /* sem dimensões: o masonry volta a estimar */ });
  function dimDe(src) { return DIMS[String(src).replace(/^\/+/, '').split('?')[0]] || null; }
  function attrsDim(src) {
    var d = dimDe(src);
    return d ? ' width="' + d[0] + '" height="' + d[1] + '"' : '';
  }

  /* Variantes WebP pequenas, geradas no build por .github/scripts/webp.py.
     Só se anunciam as que EXISTEM de facto — e sabemos quais existem porque o
     _dimensoes.json lista todos os ficheiros de imagem do repositório. Assim, se
     o cliente puser uma foto nova no backoffice antes de a Action correr, o site
     serve o JPEG original em vez de apontar para um WebP que ainda não existe. */
  function srcsetWebp(src) {
    var limpo = String(src).replace(/^\/+/, '').split('?')[0];
    var m = limpo.match(/^(.*)\/([^/]+)\.(jpe?g|png)$/i);
    if (!m) return '';
    /* Inclui a variante à largura do original. É o tecto de resolução: com
       descritores `w`, o atributo src deixa de ser candidato, portanto sem ela
       nenhum ecrã chegava à nitidez do ficheiro original. Um telemóvel grande a
       DPR 3 pede ~1050 px de imagem — mais do que 760. */
    var orig = dimDe(limpo);
    var larguras = [480, 760];
    if (orig && larguras.indexOf(orig[0]) === -1) larguras.push(orig[0]);
    larguras.sort(function (a, b) { return a - b; });
    var cands = larguras.map(function (w) {
      var v = m[1] + '/webp/' + m[2] + '-' + w + '.webp';
      return DIMS[v] ? v + ' ' + w + 'w' : null;
    }).filter(Boolean);
    return cands.length ? cands.join(', ') : '';
  }

  /* Larguras da coluna da galeria, MEDIDAS no browser de 20 em 20 px entre 320 e
     1920 (o masonry decide as colunas em galleryCols, não há aqui nada de
     redondo). Pior caso de cada regime, arredondado para cima:
        até  375px  1 coluna   76,1vw
        376–790px   2 colunas  45,1vw   <- eu tinha escrito 30vw: 33% a menos,
        791–1050px  3 colunas  29,8vw      o browser escolhia a variante abaixo
        acima       4 colunas  22,4vw      e a foto saía esticada
     Declarar a menos custa nitidez; a mais custa bytes. Por isso vai o pior caso
     de cada faixa, e não uma média. */
  var SIZES_GALERIA = '(max-width:375px) 77vw, (max-width:790px) 46vw, '
    + '(max-width:1050px) 30vw, 23vw';

  /* Reveal para conteúdo injetado dinamicamente */
  var revIO = ('IntersectionObserver' in window) ? new IntersectionObserver(function (en, o) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); o.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px', threshold: .06 }) : null;
  function observeReveals(scope) {
    var els = (scope || doc).querySelectorAll('[data-reveal]:not(.is-in)');
    if (!revIO) { els.forEach(function (el) { el.classList.add('is-in'); }); return; }
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 0) && r.bottom > 0) el.classList.add('is-in');
      else revIO.observe(el);
    });
  }

  /* Aplica o cabeçalho de uma secção (etiqueta/título/subtítulo) a partir de {eyebrow,title,lead} */
  function applyHead(scope, head) {
    if (!scope || !head) return;
    if (head.eyebrow) { var e = scope.querySelector('.eyebrow'); if (e) e.textContent = head.eyebrow; }
    if (head.title) { var t = scope.querySelector('.section-title'); if (t) t.textContent = head.title; }
    if (head.lead) { var l = scope.querySelector('.section-lead'); if (l) l.textContent = head.lead; }
  }

  /* Colapsar grelhas grandes: mostra N itens + botão "Ver mais" (menos itens no telemóvel).
     Aceita um seletor CSS ou uma lista já pela ordem certa (galeria em colunas). */
  function collapsible(grid, btn, itemSelector, desktopN, mobileN) {
    if (!grid || !btn) return;
    var N = window.matchMedia('(max-width:600px)').matches ? mobileN : desktopN;
    var items = (typeof itemSelector === 'string')
      ? Array.prototype.slice.call(grid.querySelectorAll(itemSelector))
      : itemSelector;
    if (items.length <= N) { btn.hidden = true; items.forEach(function (el) { el.style.display = ''; }); return; }
    var collapsed = true;
    function apply() {
      items.forEach(function (el, i) { el.style.display = (collapsed && i >= N) ? 'none' : ''; });
      btn.textContent = collapsed ? 'Ver mais' : 'Ver menos';
    }
    btn.hidden = false;
    btn.onclick = function () {
      /* Ao recolher, a secção encolhe e a página ficava demasiado abaixo. Guardamos
         a posição do botão no ecrã e compensamos o scroll, para o "Ver mais" nascer
         onde estava o "Ver menos". Só ao recolher — expandir não desloca nada. */
      var recolher = !collapsed;
      var antes = recolher ? btn.getBoundingClientRect().top : 0;
      collapsed = !collapsed;
      apply();
      if (!collapsed) observeReveals(grid);
      if (recolher) {
        var delta = btn.getBoundingClientRect().top - antes;
        if (delta) scrollBySemAnimacao(delta);
      }
    };
    apply();
  }

  /* Pinta os autocolantes na sequência de leitura — branco, azul, branco,
     laranja — e só desvia um item quando ele fecharia uma coluna de cor
     repetida. Assim a folha lê-se como um padrão sem fazer riscas verticais.

     Porquê as duas coisas ao mesmo tempo: a sequência pura (i % 4) alinha com
     filas de 4 e a 768px empilhava 3 azuis na mesma coluna; a diagonal pura
     ((indice+fila)%4) não empilhava nada mas quebrava a sequência ao mudar de
     fila — era o que punha "Capas de telemóvel" a laranja quando a leitura
     pedia branco.

     Não é possível ter as duas coisas perfeitas em todas as larguras: com filas
     de 4, um período de 4 põe sempre a mesma cor na mesma coluna, logo algo tem
     de ceder. Medido nas 22 larguras de 360 a 1920px, isto dá sequência exacta
     em todas as larguras de computador e nenhuma coluna com 3 acentos. */
  var PALETA = [null, 'svc--azul', null, 'svc--laranja'];   /* null = branco */

  function pintarAutocolantes(grid) {
    var visiveis = Array.prototype.slice.call(grid.querySelectorAll('.svc'))
      .filter(function (el) { return el.style.display !== 'none'; });

    /* agrupar por fila real: as pastilhas têm larguras diferentes, por isso a
       fila mede-se pelo offsetTop e não por um nº fixo de colunas */
    var filas = [], topoAnterior = null;
    visiveis.forEach(function (el, i) {
      if (el.offsetTop !== topoAnterior) { filas.push([]); topoAnterior = el.offsetTop; }
      filas[filas.length - 1].push({
        el: el, n: i % 4,
        esq: el.offsetLeft, dir: el.offsetLeft + el.offsetWidth
      });
    });

    /* dois itens estão "um sobre o outro" se se cruzarem em mais de 40% do mais
       estreito — abaixo disso a vizinhança não se lê como coluna */
    function sobrepoe(a, b) {
      var cruz = Math.min(a.dir, b.dir) - Math.max(a.esq, b.esq);
      var menor = Math.min(a.dir - a.esq, b.dir - b.esq);
      return menor > 0 && cruz / menor > 0.4;
    }

    /* Quantas iguais se toleram numa coluna antes de se ler como risca. O
       branco é a cor base da pastilha e não salta à vista, por isso aguenta
       mais; o azul e o laranja são acentos e três seguidos fazem risca. Quanto
       mais alto o limite, menos desvios à sequência de leitura. */
    function limite(n) { return PALETA[n] ? 2 : 3; }

    function corridaAcima(it, anterior) {
      var maior = 0;
      anterior.forEach(function (cima) {
        if (sobrepoe(it, cima) && PALETA[cima.n] === PALETA[it.n] && cima.corrida > maior) {
          maior = cima.corrida;
        }
      });
      return maior;
    }

    filas.forEach(function (fila, f) {
      var anterior = f > 0 ? filas[f - 1] : [];
      fila.forEach(function (it) {
        /* avança na paleta até deixar de fechar uma corrida grande demais (3
           passos bastam para percorrer as cores todas) */
        for (var passo = 0; passo < 3; passo++) {
          if (corridaAcima(it, anterior) < limite(it.n)) break;
          it.n = (it.n + 1) % 4;
        }
        it.corrida = corridaAcima(it, anterior) + 1;
        it.el.classList.remove('svc--azul', 'svc--laranja');
        if (PALETA[it.n]) it.el.classList.add(PALETA[it.n]);
      });
    });
  }

  /* Colapsar por FILAS reais (não por colunas): a folha de autocolantes tem
     larguras variáveis, por isso o corte é medido pelo offsetTop de cada item. */
  function colapsarPorFilas(grid, btn, filasDesktop, filasMobile) {
    if (!grid || !btn) return;
    var itens = Array.prototype.slice.call(grid.querySelectorAll('.svc'));
    var aberto = false;

    function corte() {
      itens.forEach(function (el) { el.style.display = ''; });   /* medir com tudo visível */
      var maxFilas = window.matchMedia('(max-width:600px)').matches ? filasMobile : filasDesktop;
      var tops = [];
      for (var i = 0; i < itens.length; i++) {
        var t = itens[i].offsetTop;
        if (tops.indexOf(t) === -1) {
          if (tops.length === maxFilas) return i;                /* começou a fila a mais */
          tops.push(t);
        }
      }
      return itens.length;
    }

    function aplicar() {
      var n = aberto ? itens.length : corte();
      itens.forEach(function (el, i) { el.style.display = i < n ? '' : 'none'; });
      btn.hidden = !aberto && n >= itens.length;
      btn.textContent = aberto ? 'Ver menos' : 'Ver mais';
      pintarAutocolantes(grid);          /* as filas mudaram: recolorir */
    }

    btn.onclick = function () {
      var recolher = aberto;
      var antes = recolher ? btn.getBoundingClientRect().top : 0;
      aberto = !aberto;
      aplicar();
      if (aberto) observeReveals(grid);
      if (recolher) {
        var delta = btn.getBoundingClientRect().top - antes;
        if (delta) scrollBySemAnimacao(delta);
      }
    };

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (aberto) pintarAutocolantes(grid); else aplicar(); }, 200);
    });
    aplicar();
  }

  /* O CSS tem scroll-behavior:smooth; aqui o ajuste tem de ser instantâneo,
     senão vê-se o conteúdo saltar e só depois a página deslizar. */
  function scrollBySemAnimacao(delta) {
    try { window.scrollBy({ top: delta, left: 0, behavior: 'instant' }); }
    catch (err) {
      var html = doc.documentElement, antes = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      window.scrollBy(0, delta);
      html.style.scrollBehavior = antes;
    }
  }

  /* Galeria em colunas montadas à mão.
     O CSS multi-column reequilibra as colunas sempre que o nº de itens muda, o que
     fazia saltar as fotos ao carregar em "Ver mais". Aqui a coluna de cada item é
     fixa (i % nº de colunas), por isso mostrar mais itens nunca mexe nos anteriores. */
  function galleryCols(grid) {
    var mobile = window.matchMedia('(max-width:600px)').matches;
    var minW = mobile ? 140 : 230, max = mobile ? 2 : 4;
    var gap = parseFloat(window.getComputedStyle(grid).columnGap) || 16;
    var w = grid.clientWidth || grid.getBoundingClientRect().width;
    return Math.max(1, Math.min(max, Math.floor((w + gap) / (minW + gap))));
  }
  function masonry(grid, items, force) {
    var n = galleryCols(grid);
    if (grid.__cols === n && !force) return;   /* só remonta se as colunas mudarem */
    grid.__cols = n;
    var gap = parseFloat(window.getComputedStyle(grid).columnGap) || 16;
    var colW = ((grid.clientWidth || grid.getBoundingClientRect().width) - gap * (n - 1)) / n;
    grid.innerHTML = '';
    var cols = [], h = [];
    for (var c = 0; c < n; c++) {
      var col = doc.createElement('div');
      col.className = 'gallery__col';
      grid.appendChild(col); cols.push(col); h.push(0);
    }
    /* Coluna mais curta primeiro, pela ordem dos itens: como nunca reposicionamos
       nada, qualquer prefixo (os 12 do "Ver mais" fechado) também fica equilibrado. */
    items.forEach(function (el) {
      var img = el.querySelector('img');
      /* proporção: primeiro os atributos width/height (conhecidos antes de a foto
         chegar, e é isso que faz o masonry acertar à primeira), depois a imagem
         já carregada, e só em último recurso a estimativa antiga */
      var aw = img && +img.getAttribute('width'), ah = img && +img.getAttribute('height');
      var ar = (aw && ah) ? (ah / aw)
        : (img && img.naturalWidth) ? (img.naturalHeight / img.naturalWidth) : 1.25;
      var k = 0;
      for (var j = 1; j < n; j++) { if (h[j] < h[k]) k = j; }
      cols[k].appendChild(el);
      h[k] += colW * ar + gap;
    });
  }

  /* ------------------------- CONTEÚDO EDITÁVEL (data/site.json) ------------------------- */
  getJSON('data/site.json').then(function (site) {
    function val(path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, site); }
    doc.querySelectorAll('[data-site]').forEach(function (el) { var v = val(el.getAttribute('data-site')); if (v != null && v !== '') el.textContent = v; });
    doc.querySelectorAll('[data-site-src]').forEach(function (el) {
      var v = val(el.getAttribute('data-site-src'));
      if (!v) return;
      v = normImg(v);
      /* Se o backoffice apontar para outra foto, o srcset (que descreve as
         variantes da foto antiga) tem de sair, senão o browser preferia-o e
         continuava a mostrar a imagem errada. */
      if (el.hasAttribute('srcset') && el.getAttribute('src') !== v) el.removeAttribute('srcset');
      el.setAttribute('src', v);
    });
    var c = site.contacts || {};
    if (c.phone_intl) doc.querySelectorAll('[data-tel]').forEach(function (a) { a.setAttribute('href', 'tel:+' + c.phone_intl); });
    if (c.email) doc.querySelectorAll('[data-mail]').forEach(function (a) { a.setAttribute('href', 'mailto:' + c.email); });
    if (c.instagram_url) doc.querySelectorAll('[data-ig]').forEach(function (a) { a.setAttribute('href', c.instagram_url); });
    // WhatsApp: todos os botões seguem o telefone editável (preserva o ?text=)
    if (c.phone_intl) doc.querySelectorAll('a[href*="wa.me/"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/wa\.me\/\d+/, 'wa.me/' + c.phone_intl)); });
    // Morada → texto do mapa + URL do embed (e recarrega o mapa se já estiver aberto)
    var a1 = c.address_line1 || '', a2 = c.address_line2 || '', addrFull = (a1 + ' ' + a2).trim();
    if (addrFull) {
      var fs = doc.querySelector('.map-facade__s'); if (fs) fs.textContent = a1 + (a2 ? ', ' + a2 : '');
      var mb = doc.getElementById('map-box');
      if (mb) {
        var murl = 'https://maps.google.com/maps?q=' + encodeURIComponent(addrFull) + '&z=15&hl=pt&output=embed';
        mb.setAttribute('data-embed', murl);
        var ifr = mb.querySelector('iframe'); if (ifr) ifr.src = murl;
      }
    }
    // Hero: título com palavra destacada + público-alvo
    var h = site.hero || {};
    var ht = doc.getElementById('hero-title');
    if (ht && h.title) ht.innerHTML = esc(h.title) + ' <span class="hl">' + esc(h.highlight || '') + '</span>' + esc(h.title_end || '');
    var aud = doc.getElementById('hero-aud');
    if (aud && h.audience && h.audience.length) aud.innerHTML = h.audience.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('');
    // Cabeçalho da secção de Contacto
    applyHead(doc.getElementById('contacto'), site.contacto);
    // Opções do formulário ("O que precisas?") — editáveis, mantendo o placeholder
    var sel = doc.getElementById('f-servico');
    var fopts = site.contacto && site.contacto.form_options;
    if (sel && fopts && fopts.length) {
      var ph = sel.querySelector('option[value=""]');
      sel.innerHTML = '';
      sel.appendChild(ph || (function () { var o = doc.createElement('option'); o.value = ''; o.textContent = 'Escolhe…'; return o; })());
      fopts.forEach(function (t) { var o = doc.createElement('option'); o.textContent = t; sel.appendChild(o); });
    }
    // Faixa B2B (Empresas)
    var b = site.b2b || {};
    applyHead(doc.getElementById('b2b'), b);
    if (b.list) { var bl = doc.getElementById('b2b-list'); if (bl) bl.innerHTML = b.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join(''); }
    if (b.cta_label) { var bc = doc.getElementById('b2b-cta'); if (bc) bc.textContent = b.cta_label; }
    if (b.image) { var bi = doc.getElementById('b2b-img'); if (bi) bi.setAttribute('src', normImg(b.image)); }
  }).catch(function () {});

  /* ------------------------- ÍCONES DOS SERVIÇOS ------------------------- */
  var S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    tshirt: '<svg viewBox="0 0 24 24" ' + S + '><path d="M8.5 3.5 4 6l2 3 2-1.2V20h8V7.8L18 9l2-3-4.5-2.5a3.5 3.5 0 0 1-7 0Z"/></svg>',
    hoodie: '<svg viewBox="0 0 24 24" ' + S + '><path d="M8 4 4 6.5 6 10l2-1v11h8V9l2 1 2-3.5L16 4"/><path d="M8 4c.6 2.4 7.4 2.4 8 0"/><path d="M12 6v4"/></svg>',
    polo: '<svg viewBox="0 0 24 24" ' + S + '><path d="M9 3.5 4 6l2 3 2-1v11h8V8l2 1 2-3-5-2.5"/><path d="M9 3.5 12 7l3-3.5"/><path d="M12 7v4"/></svg>',
    cap: '<svg viewBox="0 0 24 24" ' + S + '><path d="M4 14a8 8 0 0 1 16 0"/><path d="M12 6v8"/><path d="M20 14H4"/><path d="M4 14c-1 0-2 .4-2 1.5"/></svg>',
    mug: '<svg viewBox="0 0 24 24" ' + S + '><rect x="5" y="5" width="11" height="15" rx="2.5"/><path d="M16 8h3a2.5 2.5 0 0 1 0 5h-3"/></svg>',
    sticker: '<svg viewBox="0 0 24 24" ' + S + '><path d="M5 4h9l5 5v11H5Z"/><path d="M14 4v5h5"/></svg>',
    dtf: '<svg viewBox="0 0 24 24" ' + S + '><path d="m12 3 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/></svg>',
    uv: '<svg viewBox="0 0 24 24" ' + S + '><path d="M12 3s5 5.4 5 9.2A5 5 0 0 1 7 12.2C7 8.4 12 3 12 3Z"/><path d="M9.6 12.4a2.4 2.4 0 0 0 4.8 0"/></svg>',
    vinyl: '<svg viewBox="0 0 24 24" ' + S + '><ellipse cx="12" cy="6.5" rx="8" ry="3"/><path d="M4 6.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><circle cx="12" cy="6.5" r="1.3"/></svg>',
    banner: '<svg viewBox="0 0 24 24" ' + S + '><path d="M6 3v18"/><path d="M6 4.5h13l-3 4 3 4H6"/></svg>',
    merch: '<svg viewBox="0 0 24 24" ' + S + '><path d="M4 8h16l-1.2 12H5.2Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/><path d="m12 11.5 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 13.8l2.2-.3Z"/></svg>',
    gift: '<svg viewBox="0 0 24 24" ' + S + '><rect x="3.5" y="9" width="17" height="11.5" rx="1.6"/><path d="M2.5 9h19"/><path d="M12 9v11.5"/><path d="M12 9C9.8 9 8 8 8 6.4A2.4 2.4 0 0 1 12 5a2.4 2.4 0 0 1 4 1.4C16 8 14.2 9 12 9Z"/></svg>',
    work: '<svg viewBox="0 0 24 24" ' + S + '><path d="M9 3.5 5 5.5v15h14v-15l-4-2"/><path d="m9 3.5 3 4 3-4"/><path d="M5 11h4M15 11h4"/><path d="M5 14.5h4M15 14.5h4"/></svg>',
    bag: '<svg viewBox="0 0 24 24" ' + S + '><path d="M5 7.5h14l-1 13H6Z"/><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" ' + S + '><rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 5.5h3"/></svg>',
    /* reserva: o campo "Ícone" no backoffice é texto livre, portanto o cliente
       pode escrever um nome para o qual ainda não há desenho. Mostrar uma
       estrela neutra é honesto; mostrar uma t-shirt seria enganador. */
    generico: '<svg viewBox="0 0 24 24" ' + S + '><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z"/></svg>'
  };

  /* O nome do ícone vem de um campo de texto livre do backoffice, portanto
     ICONS[nome] é uma indexação de objecto com texto de fora. Sem o
     hasOwnProperty, nomes como "constructor", "toString" ou "__proto__" devolvem
     propriedades herdadas do Object — e o autocolante mostrava
     "function Object() { [native code] }" em vez de um ícone. O `|| generico`
     não protegia: esses valores são truthy. */
  function icone(nome) {
    return (typeof nome === 'string'
      && Object.prototype.hasOwnProperty.call(ICONS, nome)
      && typeof ICONS[nome] === 'string') ? ICONS[nome] : ICONS.generico;
  }

  /* ------------------------- SERVIÇOS ------------------------- */
  var sgrid = doc.getElementById('services-grid');
  if (sgrid) {
    getJSON('data/services.json').then(function (d) {
      applyHead(doc.getElementById('servicos'), d.head);
      var items = (d && d.services) || [];
      sgrid.innerHTML = items.map(function (s) {
        /* só ícone + nome — a descrição continua no JSON (o catálogo PDF usa-a) */
        return '<article class="svc" data-reveal>' +
          '<span class="svc__icon" aria-hidden="true">' + icone(s.icon) + '</span>' +
          '<h3 class="svc__title">' + esc(s.title) + '</h3>' +
          '</article>';
      }).join('');
      observeReveals(sgrid);
      /* "Ver mais" a partir de 2 filas no computador e 5 no telemóvel (no
         telemóvel os autocolantes empilham, e 3 filas mostravam poucos) */
      colapsarPorFilas(sgrid, doc.getElementById('more-services'), 2, 5);
    }).catch(function () { /* deixa o conteúdo pré-renderizado de pé */ });
  }

  /* ------------------------- MODELOS BASE (THCLOTHES) ------------------------- */
  var mgrid = doc.getElementById('models-grid');
  var mfilters = doc.getElementById('models-filters');
  var WA = 'https://wa.me/351932938467?text=';
  var CAT_ORDER = ['Todos', 'T-shirts', 'Polos', 'Sweats e hoodies', 'Casacos e softshell', 'Vestuário de trabalho', 'Sacos e acessórios'];
  if (mgrid) {
    var allModels = [], activeCat = 'Todos';
    function modelCard(m) {
      var ask = WA + encodeURIComponent('Olá! Tenho interesse no modelo ' + m.name + ' para personalizar. Podem dar-me um orçamento?');
      return '<article class="model" data-cat="' + esc(m.cat) + '" data-reveal>' +
        '<div class="model__media"><img src="' + esc(normImg(m.img)) + '" alt="Modelo ' + esc(m.name) + ' — ' + esc(m.tag) + '" loading="lazy" /><span class="model__cat">' + esc(m.cat) + '</span></div>' +
        '<div class="model__body">' +
          '<div class="model__head"><h3 class="model__name">' + esc(m.name) + '</h3><span class="model__tag">' + esc(m.tag) + '</span></div>' +
          '<ul class="model__specs">' +
            '<li><span>Gramagem</span><b>' + esc(m.gsm) + '</b></li>' +
            '<li><span>Tecido</span><b>' + esc(m.fabric) + '</b></li>' +
            '<li><span>' + esc(m.sizes_label || 'Tamanhos') + '</span><b>' + esc(m.sizes) + '</b></li>' +
            '<li><span>Cores</span><b>' + esc(m.colors) + ' disponíveis</b></li>' +
          '</ul>' +
          '<a class="btn btn--primary btn--sm model__cta" href="' + ask + '" target="_blank" rel="noopener">Pedir personalização</a>' +
        '</div>' +
      '</article>';
    }
    function renderModels() {
      var list = activeCat === 'Todos' ? allModels : allModels.filter(function (m) { return m.cat === activeCat; });
      mgrid.innerHTML = list.map(modelCard).join('');
      observeReveals(mgrid);
      collapsible(mgrid, doc.getElementById('more-models'), '.model', 8, 4);
    }
    function buildModelFilters() {
      if (!mfilters) return;
      var cats = CAT_ORDER.filter(function (c) { return c === 'Todos' || allModels.some(function (m) { return m.cat === c; }); });
      mfilters.innerHTML = cats.map(function (c) {
        return '<button class="chip" aria-pressed="' + (c === activeCat ? 'true' : 'false') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
      mfilters.addEventListener('click', function (e) {
        var b = e.target.closest('.chip'); if (!b) return;
        activeCat = b.getAttribute('data-cat');
        mfilters.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        renderModels();
      });
    }
    getJSON('data/models.json').then(function (d) {
      allModels = (d && d.models) || [];
      applyHead(doc.getElementById('modelos'), d.head);
      buildModelFilters();
      renderModels();
    }).catch(function () { /* deixa o conteúdo pré-renderizado de pé */ });
  }

  /* ------------------------- CATÁLOGOS COM GALERIA (rígidos, lonas e vinil) -------------------------
     Mesma grelha para os dois: filtros por categoria, várias imagens por artigo
     com setas, e "Ver mais". Só muda o ficheiro de dados e os ids. */
  function catalogoGaleria(cfg) {
    var grid = doc.getElementById(cfg.grid);
    if (!grid) return;
    var filtros = doc.getElementById(cfg.filtros);
    var CWA = 'https://wa.me/351932938467?text=';
    var todos = [], cats = ['Todos'], ativa = 'Todos';

    function cartao(p) {
      var ask = CWA + encodeURIComponent('Olá! Tenho interesse ' + cfg.artigo + ' ' + p.name + '. Podem dar-me um orçamento?');
      var specs = (p.specs || []).map(function (s) { return '<li><span>' + esc(s.label) + '</span><b>' + esc(s.value) + '</b></li>'; }).join('');
      var imgs = (p.imgs && p.imgs.length) ? p.imgs : (p.img ? [p.img] : []);
      imgs = imgs.map(normImg);
      var nav = imgs.length > 1 ?
        '<button class="rig__nav rig__nav--prev" type="button" data-dir="-1" aria-label="Imagem anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>' +
        '<button class="rig__nav rig__nav--next" type="button" data-dir="1" aria-label="Imagem seguinte"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '<span class="rig__count">1/' + imgs.length + '</span>' : '';
      return '<article class="model" data-cat="' + esc(p.cat) + '" data-reveal>' +
        '<div class="model__media">' +
          '<img class="rig__img" src="' + esc(imgs[0] || '') + '" data-imgs="' + esc(imgs.join('|')) + '" data-i="0" alt="' + esc(p.name) + ' personalizado — ArtStampCreations, Vizela' + (imgs.length > 1 ? ' (foto 1 de ' + imgs.length + ')' : '') + '" loading="lazy" />' +
          '<span class="model__cat">' + esc(p.cat) + '</span>' + nav +
        '</div>' +
        '<div class="model__body">' +
          '<div class="model__head"><h3 class="model__name">' + esc(p.name) + '</h3></div>' +
          '<ul class="model__specs">' + specs + '</ul>' +
          '<a class="btn btn--primary btn--sm model__cta" href="' + ask + '" target="_blank" rel="noopener">Pedir orçamento</a>' +
        '</div>' +
      '</article>';
    }

    grid.addEventListener('click', function (e) {
      var nav = e.target.closest('.rig__nav'); if (!nav) return;
      var media = nav.closest('.model__media'); var img = media.querySelector('.rig__img');
      var list = (img.getAttribute('data-imgs') || '').split('|').filter(Boolean);
      if (list.length < 2) return;
      var i = ((parseInt(img.getAttribute('data-i'), 10) || 0) + parseInt(nav.getAttribute('data-dir'), 10) + list.length) % list.length;
      img.setAttribute('data-i', i); img.src = list[i];
      /* o alt tem de acompanhar a foto, senão descreve a anterior */
      img.alt = img.alt.replace(/\(foto \d+ de (\d+)\)/, '(foto ' + (i + 1) + ' de $1)');
      var c = media.querySelector('.rig__count'); if (c) c.textContent = (i + 1) + '/' + list.length;
    });

    function render() {
      var lista = ativa === 'Todos' ? todos : todos.filter(function (p) { return p.cat === ativa; });
      grid.innerHTML = lista.map(cartao).join('');
      observeReveals(grid);
      collapsible(grid, doc.getElementById(cfg.mais), '.model', 8, 4);
    }
    function construirFiltros() {
      if (!filtros) return;
      var uteis = cats.filter(function (c) { return c === 'Todos' || todos.some(function (p) { return p.cat === c; }); });
      filtros.innerHTML = uteis.map(function (c) {
        return '<button class="chip" aria-pressed="' + (c === ativa ? 'true' : 'false') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
      filtros.addEventListener('click', function (e) {
        var b = e.target.closest('.chip'); if (!b) return;
        ativa = b.getAttribute('data-cat');
        filtros.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        render();
      });
    }
    getJSON(cfg.json).then(function (d) {
      todos = (d && d.products) || [];
      if (d && d.cats && d.cats.length) cats = d.cats;
      applyHead(doc.getElementById(cfg.seccao), d.head);
      construirFiltros();
      render();
    }).catch(function () { /* deixa o conteúdo pré-renderizado de pé */ });
  }

  catalogoGaleria({
    seccao: 'rigidos', grid: 'rigidos-grid', filtros: 'rigidos-filters', mais: 'more-rigidos',
    json: 'data/rigidos.json', artigo: 'no artigo'
  });
  catalogoGaleria({
    seccao: 'lonas', grid: 'lonas-grid', filtros: 'lonas-filters', mais: 'more-lonas',
    json: 'data/lonas.json', artigo: 'em'
  });

  /* ------------------------- GALERIA / PORTFÓLIO + LIGHTBOX ------------------------- */
  var ggrid = doc.getElementById('gallery-grid');
  if (ggrid) {
    var gItems = [];
    /* espera pelas dimensões antes de desenhar: emitir os <img> sem width/height
       e só depois corrigir seria exactamente o salto que se quer evitar */
    Promise.all([getJSON('data/gallery.json'), dimsProntas]).then(function (r) {
      var d = r[0];
      applyHead(doc.getElementById('trabalhos'), d.head);
      gItems = (d && d.items) || [];
      var figs = gItems.map(function (it, i) {
        var f = doc.createElement('figure');
        var src = normImg(it.img);
        f.className = 'gitem';
        f.setAttribute('data-i', i);
        f.setAttribute('data-reveal', '');
        var ss = srcsetWebp(src);
        f.innerHTML = '<img src="' + esc(src) + '"' +
          (ss ? ' srcset="' + esc(ss) + '" sizes="' + SIZES_GALERIA + '"' : '') +
          ' alt="' + esc(it.cap || 'Trabalho') + ' — trabalho da ArtStampCreations' + '" loading="lazy"' + attrsDim(src) + ' />' +
          '<figcaption>' + esc(it.cap || '') + '</figcaption>';
        return f;
      });
      masonry(ggrid, figs);
      observeReveals(ggrid);
      var moreBtn = doc.getElementById('more-gallery');
      /* 13 no desktop (e não 12): com 4 colunas, o 13.º trabalho vai para a coluna
         mais curta e fecha o vazio que ficava em baixo à esquerda. */
      collapsible(ggrid, moreBtn, figs, 13, 6);

      /* Rede de segurança para quando falte a dimensão de alguma foto (ficheiro
         novo antes de a Action correr): aí o equilíbrio é estimado e corrige-se
         uma vez, quando as visíveis carregarem. Com as dimensões todas conhecidas
         isto nunca dispara — e é esse o objectivo, porque era este segundo
         masonry o salto que se via. Nunca depois de "Ver mais". */
      var reequilibrado = false, expandido = false;
      var faltamDims = figs.some(function (f) {
        var im = f.querySelector('img');
        return !(+im.getAttribute('width') && +im.getAttribute('height'));
      });
      if (moreBtn) moreBtn.addEventListener('click', function () { expandido = true; });
      function rebalance() {
        if (reequilibrado || expandido || !faltamDims) return;
        var vis = figs.filter(function (f) { return f.style.display !== 'none'; });
        if (!vis.length) return;
        var prontas = vis.every(function (f) { var im = f.querySelector('img'); return im.complete && im.naturalWidth; });
        if (!prontas) return;
        reequilibrado = true;
        masonry(ggrid, figs, true);
      }
      figs.forEach(function (f) {
        var im = f.querySelector('img');
        if (im.complete && im.naturalWidth) rebalance();
        else im.addEventListener('load', rebalance);
      });

      var rz;
      window.addEventListener('resize', function () {
        clearTimeout(rz);
        rz = setTimeout(function () { masonry(ggrid, figs); }, 200);
      });
    }).catch(function () { /* deixa o conteúdo pré-renderizado de pé */ });

    /* Lightbox */
    var lb = doc.getElementById('lightbox');
    var lbImg = lb && lb.querySelector('.lightbox__img');
    var lbCap = lb && lb.querySelector('.lightbox__cap');
    var cur = 0;
    function openLB(i) {
      cur = (i + gItems.length) % gItems.length;
      lbImg.src = normImg(gItems[cur].img); lbImg.alt = gItems[cur].cap || '';
      lbCap.textContent = gItems[cur].cap || '';
      lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); doc.body.classList.add('menu-open');
    }
    function closeLB() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); doc.body.classList.remove('menu-open'); }
    if (lb) {
      ggrid.addEventListener('click', function (e) {
        var fig = e.target.closest('.gitem'); if (!fig) return;
        openLB(parseInt(fig.getAttribute('data-i'), 10) || 0);
      });
      lb.addEventListener('click', function (e) {
        var a = e.target.getAttribute && e.target.getAttribute('data-lb');
        if (a === 'close' || e.target === lb) closeLB();
        else if (a === 'prev') openLB(cur - 1);
        else if (a === 'next') openLB(cur + 1);
      });
      doc.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('is-open')) return;
        if (e.key === 'Escape') closeLB();
        else if (e.key === 'ArrowLeft') openLB(cur - 1);
        else if (e.key === 'ArrowRight') openLB(cur + 1);
      });
    }
  }

  /* ------------------------- FORMULÁRIO → WHATSAPP ------------------------- */
  var qf = doc.getElementById('quote-form');
  if (qf) {
    qf.addEventListener('submit', function (e) {
      e.preventDefault();
      var nome = (qf.nome.value || '').trim();
      if (!nome) { qf.nome.setAttribute('aria-invalid', 'true'); qf.nome.focus(); return; }
      qf.nome.removeAttribute('aria-invalid');
      var consent = doc.getElementById('f-consent');
      if (consent && !consent.checked) { consent.focus(); return; }
      var contacto = (qf.contacto.value || '').trim();
      var servico = qf.servico.value || '';
      var msg = (qf.mensagem.value || '').trim();
      var t = 'Olá! Sou ' + nome + '.';
      if (servico) t += ' Preciso de: ' + servico + '.';
      if (msg) t += ' ' + msg;
      if (contacto) t += ' O meu contacto: ' + contacto + '.';
      t += ' Podem dar-me um orçamento?';
      window.open('https://wa.me/351932938467?text=' + encodeURIComponent(t), '_blank', 'noopener');
    });
  }

  /* ------------------------- COMO FUNCIONA (passos) ------------------------- */
  var stepsGrid = doc.getElementById('steps-grid');
  if (stepsGrid) getJSON('data/steps.json').then(function (d) {
    applyHead(doc.getElementById('como'), d.head);
    var items = (d && d.steps) || [];
    stepsGrid.innerHTML = items.map(function (s, i) {
      return '<article class="step" data-reveal><div class="step__n">' + (i + 1) + '</div><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></article>';
    }).join('');
    observeReveals(stepsGrid);
  }).catch(function () {});

  /* ------------------------- FAQ ------------------------- */
  var faqList = doc.getElementById('faq-list');
  if (faqList) getJSON('data/faq.json').then(function (d) {
    applyHead(doc.getElementById('faq'), d.head);
    var items = (d && d.items) || [];
    faqList.innerHTML = items.map(function (it) {
      return '<details><summary>' + esc(it.q) + '</summary><p>' + esc(it.a) + '</p></details>';
    }).join('');
  }).catch(function () {});

  /* ------------------------- COOKIES + MAPA GOOGLE (consentimento) ------------------------- */
  (function () {
    var KEY = 'as-consent';
    var banner = doc.getElementById('cookie-banner');
    var mapBox = doc.getElementById('map-box');
    function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    function loadMap() {
      if (!mapBox || mapBox.querySelector('iframe')) return;
      var f = doc.createElement('iframe');
      f.src = mapBox.getAttribute('data-embed');
      f.title = 'Mapa Google — ArtStampCreations, Vizela';
      f.loading = 'lazy'; f.setAttribute('referrerpolicy', 'no-referrer'); f.setAttribute('allowfullscreen', '');
      f.style.cssText = 'width:100%;height:100%;border:0;display:block';
      mapBox.innerHTML = ''; mapBox.appendChild(f);
    }
    function show() { if (banner) banner.hidden = false; }
    function hide() { if (banner) banner.hidden = true; }
    var cur = get();
    if (cur === 'accepted') loadMap();
    else if (cur !== 'rejected') show();
    if (banner) banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]'); if (!b) return;
      var v = b.getAttribute('data-consent'); set(v); hide();
      if (v === 'accepted') loadMap();
    });
    var mapBtn = mapBox && mapBox.querySelector('[data-map-load]');
    if (mapBtn) mapBtn.addEventListener('click', function () { if (get() === 'accepted') loadMap(); else show(); });
    doc.querySelectorAll('[data-cookie-manage]').forEach(function (el) { el.addEventListener('click', function (e) { e.preventDefault(); show(); }); });
  })();
})();
