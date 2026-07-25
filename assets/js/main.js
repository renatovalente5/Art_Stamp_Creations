/* =============================================================
   ART STAMP CREATIONS — main.js
   Header que encolhe · menu mobile full-screen · scrollspy · reveals
   ============================================================= */
(function () {
  'use strict';
  var doc = document;

  /* ---------- Header: encolher no scroll (logo grande ↔ pequeno) ---------- */
  var header = doc.querySelector('[data-header]');
  if (header) {
    var scrolled = false, ticking = false;
    var onScroll = function () {
      var s = window.scrollY > 20;
      if (s !== scrolled) { scrolled = s; header.classList.toggle('is-scrolled', s); }
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();
  }

  /* ---------- Menu mobile (ecrã inteiro) ---------- */
  var menu = doc.getElementById('mobile-menu');
  var openBtn = doc.querySelector('[data-menu-open]');
  var lastFocus = null;
  function focusables() { return menu ? menu.querySelectorAll('a[href],button:not([disabled])') : []; }
  function openMenu() {
    if (!menu) return;
    lastFocus = doc.activeElement;
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
    openBtn && openBtn.setAttribute('aria-expanded', 'true');
    doc.body.classList.add('menu-open');
    var f = focusables(); if (f.length) setTimeout(function () { f[0].focus(); }, 60);
  }
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
    openBtn && openBtn.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('menu-open');
    if (lastFocus) lastFocus.focus();
  }
  if (openBtn) openBtn.addEventListener('click', openMenu);
  doc.querySelectorAll('[data-menu-close]').forEach(function (b) { b.addEventListener('click', closeMenu); });
  menu && menu.querySelectorAll('[data-menu-link]').forEach(function (a) { a.addEventListener('click', closeMenu); });
  doc.addEventListener('keydown', function (e) {
    if (!menu || !menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key === 'Tab') {
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var mq = window.matchMedia('(min-width:921px)');
  (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function () {
    if (menu && mq.matches && menu.classList.contains('is-open')) closeMenu();
  });

  /* ---------- Dropdown de catálogos (navbar) ---------- */
  doc.querySelectorAll('[data-dd]').forEach(function (dd) {
    var t = dd.querySelector('.nav__dd-toggle'); if (!t) return;
    function close() { dd.classList.remove('is-open'); t.setAttribute('aria-expanded', 'false'); }
    function open() { dd.classList.add('is-open'); t.setAttribute('aria-expanded', 'true'); }
    t.addEventListener('click', function (e) { e.stopPropagation(); dd.classList.contains('is-open') ? close() : open(); });
    dd.querySelectorAll('.nav__dd-menu a').forEach(function (a) { a.addEventListener('click', close); });
    doc.addEventListener('click', function (e) { if (!dd.contains(e.target)) close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  });

  /* ---------- Scrollspy ---------- */
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll('.nav__links a'));
  var sections = navLinks.map(function (a) { var hr = a.getAttribute('href') || ''; return hr.charAt(0) === '#' ? doc.querySelector(hr) : null; }).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var id = en.target.id;
          navLinks.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + id); });
          var ddT = doc.querySelector('.nav__dd-toggle');
          if (ddT) ddT.classList.toggle('is-current', id === 'rigidos' || id === 'modelos');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Reveal on scroll (nunca esconde conteúdo) ---------- */
  var reveals = doc.querySelectorAll('[data-reveal]');
  function revealAll() { reveals.forEach(function (el) { el.classList.add('is-in'); }); }
  function inView(el) { var r = el.getBoundingClientRect(); return r.top < (window.innerHeight || 0) && r.bottom > 0; }
  if ('IntersectionObserver' in window && reveals.length) {
    var ro = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
    var showInView = function () { reveals.forEach(function (el) { if (inView(el)) el.classList.add('is-in'); }); };
    showInView();
    window.addEventListener('load', function () { showInView(); setTimeout(revealAll, 4000); });
  } else { revealAll(); }

  /* ---------- Ano no footer ---------- */
  var y = doc.querySelector('[data-year]'); if (y) y.textContent = new Date().getFullYear();
})();
