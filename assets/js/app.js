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
  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

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

  /* Colapsar grelhas grandes: mostra N itens + botão "Ver mais" (menos itens no telemóvel) */
  function collapsible(grid, btn, itemSelector, desktopN, mobileN) {
    if (!grid || !btn) return;
    var N = window.matchMedia('(max-width:600px)').matches ? mobileN : desktopN;
    var items = grid.querySelectorAll(itemSelector);
    if (items.length <= N) { btn.hidden = true; items.forEach(function (el) { el.style.display = ''; }); return; }
    var collapsed = true;
    function apply() {
      items.forEach(function (el, i) { el.style.display = (collapsed && i >= N) ? 'none' : ''; });
      btn.textContent = collapsed ? 'Ver mais' : 'Ver menos';
    }
    btn.hidden = false;
    btn.onclick = function () { collapsed = !collapsed; apply(); if (!collapsed) observeReveals(grid); };
    apply();
  }

  /* ------------------------- CONTEÚDO EDITÁVEL (data/site.json) ------------------------- */
  getJSON('data/site.json').then(function (site) {
    function val(path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, site); }
    doc.querySelectorAll('[data-site]').forEach(function (el) { var v = val(el.getAttribute('data-site')); if (v != null && v !== '') el.textContent = v; });
    doc.querySelectorAll('[data-site-src]').forEach(function (el) { var v = val(el.getAttribute('data-site-src')); if (v) el.setAttribute('src', normImg(v)); });
    var c = site.contacts || {};
    if (c.phone_intl) doc.querySelectorAll('[data-tel]').forEach(function (a) { a.setAttribute('href', 'tel:+' + c.phone_intl); });
    if (c.email) doc.querySelectorAll('[data-mail]').forEach(function (a) { a.setAttribute('href', 'mailto:' + c.email); });
    if (c.instagram_url) doc.querySelectorAll('[data-ig]').forEach(function (a) { a.setAttribute('href', c.instagram_url); });
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
    banner: '<svg viewBox="0 0 24 24" ' + S + '><path d="M6 3v18"/><path d="M6 4.5h13l-3 4 3 4H6"/></svg>'
  };

  /* ------------------------- SERVIÇOS ------------------------- */
  var sgrid = doc.getElementById('services-grid');
  if (sgrid) {
    getJSON('data/services.json').then(function (d) {
      var items = (d && d.services) || [];
      sgrid.innerHTML = items.map(function (s) {
        return '<article class="svc" data-reveal>' +
          '<span class="svc__icon" aria-hidden="true">' + (ICONS[s.icon] || ICONS.tshirt) + '</span>' +
          '<h3 class="svc__title">' + esc(s.title) + '</h3>' +
          '<p class="svc__desc">' + esc(s.desc) + '</p>' +
          '</article>';
      }).join('');
      observeReveals(sgrid);
      collapsible(sgrid, doc.getElementById('more-services'), '.svc', 6, 4);
    }).catch(function () { sgrid.innerHTML = '<p class="muted">Não foi possível carregar os serviços.</p>'; });
  }

  /* ------------------------- MODELOS BASE (THCLOTHES) ------------------------- */
  var mgrid = doc.getElementById('models-grid');
  var mfilters = doc.getElementById('models-filters');
  var WA = 'https://wa.me/351932938467?text=';
  var CAT_ORDER = ['Todos', 'T-shirts', 'Polos', 'Sweats e hoodies', 'Casacos e softshell', 'Vestuário de trabalho'];
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
            '<li><span>Tamanhos</span><b>' + esc(m.sizes) + '</b></li>' +
            '<li><span>Cores</span><b>' + esc(m.colors) + ' disponíveis</b></li>' +
          '</ul>' +
          '<a class="btn btn--primary btn--sm model__cta" href="' + ask + '" target="_blank" rel="noopener">Pedir com personalização</a>' +
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
        return '<button class="chip" role="tab" aria-pressed="' + (c === activeCat ? 'true' : 'false') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
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
      var intro = doc.getElementById('models-intro');
      if (intro && d.intro) intro.textContent = d.intro;
      buildModelFilters();
      renderModels();
    }).catch(function () { mgrid.innerHTML = '<p class="muted">Não foi possível carregar os modelos.</p>'; });
  }

  /* ------------------------- GALERIA / PORTFÓLIO + LIGHTBOX ------------------------- */
  var ggrid = doc.getElementById('gallery-grid');
  if (ggrid) {
    var gItems = [];
    getJSON('data/gallery.json').then(function (d) {
      gItems = (d && d.items) || [];
      ggrid.innerHTML = gItems.map(function (it, i) {
        return '<figure class="gitem" data-i="' + i + '" data-reveal>' +
          '<img src="' + esc(normImg(it.img)) + '" alt="' + esc(it.cap || 'Trabalho Art Stamp') + '" loading="lazy" />' +
          '<figcaption>' + esc(it.cap || '') + '</figcaption>' +
          '</figure>';
      }).join('');
      observeReveals(ggrid);
      collapsible(ggrid, doc.getElementById('more-gallery'), '.gitem', 12, 6);
    }).catch(function () { ggrid.innerHTML = '<p class="muted">Não foi possível carregar a galeria.</p>'; });

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

  /* ------------------------- MAPA GOOGLE (carrega só com consentimento) ------------------------- */
  var mapBox = doc.getElementById('map-box');
  if (mapBox) {
    var mapBtn = mapBox.querySelector('[data-map-load]');
    if (mapBtn) mapBtn.addEventListener('click', function () {
      var f = doc.createElement('iframe');
      f.src = mapBox.getAttribute('data-embed');
      f.title = 'Mapa Google — Art Stamp Creations, Vizela';
      f.loading = 'lazy'; f.setAttribute('referrerpolicy', 'no-referrer');
      f.setAttribute('allowfullscreen', '');
      f.style.cssText = 'width:100%;height:100%;border:0;display:block';
      mapBox.innerHTML = '';
      mapBox.appendChild(f);
    });
  }
})();
