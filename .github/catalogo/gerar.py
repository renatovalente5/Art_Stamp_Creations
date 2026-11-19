#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""O CATÁLOGO EM PDF da ArtStampCreations (https://artstampcreations.pt/catalogo.pdf).

Faz-se com o que está no site: os dados de data/*.json e as fotografias de
assets/img/. As páginas têm 120 x 150 mm (4:5, o tamanho de uma publicação do
Instagram) para se ler no telemóvel sem zoom: quase toda a gente o abre pelo
WhatsApp ou pela bio do Instagram. Cada artigo e cada serviço abre o WhatsApp
com a mensagem já escrita, e o índice salta para cada secção. Desenho aprovado
pelo Renato a 19 nov 2026 (a «proposta B»); a capa é o logótipo, a pedido do
Vitor (18 nov 2026).

Corre no GitHub — o workflow catalogo.yml, que o painel dispara com
«Atualizar catálogo» e que ENTREGA o PDF ao painel (nada fica no repositório:
o Renato não quer as versões guardadas) — e também aqui:

    python3 .github/catalogo/gerar.py                  # _source/catalogo/Catalogo-ArtStampCreations.pdf
    python3 .github/catalogo/gerar.py --saida X.pdf    # e X.json ao lado

Precisa do Pillow, do segno (o código QR) e de um Chrome (CHROME_PATH, como o
prerender.py). O .json ao lado do PDF diz quando foi feito, com quantas
páginas, e de que commit vieram os dados: vai com o PDF para o painel, que o
mostra e o usa para saber se o site mudou depois do último catálogo.
"""
import argparse
import base64
import datetime
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote
from zoneinfo import ZoneInfo

import segno
from PIL import Image, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, os.path.join(ROOT, '.github', 'scripts'))
sys.dont_write_bytecode = True        # sem __pycache__ dentro de .github/scripts
from cdp import encontrar_chrome  # noqa: E402  (o mesmo Chrome do prerender.py)

MARCA = 'ArtStampCreations'
SITE = 'https://artstampcreations.pt'
NIF = '248790226'                       # o mesmo do rodapé do site
CAPA = os.path.join(AQUI, 'capa-logotipo.jpg')   # o logótipo que o Vitor pôs no topo do site
# Os ficheiros de dados que o catálogo lê (o painel compara-os com o commit do
# último catálogo para dizer «o site mudou»; o catalogo.json repete a lista).
DADOS = ['site.json', 'services.json', 'models.json', 'rigidos.json', 'lonas.json', 'gallery.json']
# A ordem das categorias do têxtil, a do site; as que um dia apareçam vão no fim.
ORDEM_TEXTIL = ['T-shirts', 'Polos', 'Sweats e hoodies', 'Casacos e softshell',
                'Vestuário de trabalho', 'Sacos e acessórios']
TRABALHOS = 7                           # fotografias de trabalhos (+ o cartão do Instagram = 2 páginas)

# ------------------------------------------------------------------ geometria (mm)
PW, PH = 120, 150
PX = lambda mm: int(round(mm / 25.4 * 300))       # 300 ppp
FOTO_W, FOTO_H = 50, 35                           # a fotografia de um cartão
TRAB_W, TRAB_H = 50, 49                           # a de um trabalho

e = lambda s: html.escape(str('' if s is None else s))


def url(p):
    return 'file://' + quote(p)


# ================================================================== dados
def carregar(nome):
    with open(os.path.join(ROOT, 'data', nome), encoding='utf-8') as f:
        return json.load(f)


def lista(obj, chave):
    v = (obj or {}).get(chave)
    return [x for x in v if isinstance(x, dict)] if isinstance(v, list) else []


def sem_catalogo(t):
    """«Catálogo Têxtil» → «Têxtil» (o nome curto da secção, para o índice)."""
    t = str(t or '').strip()
    return t[len('Catálogo '):] if t.lower().startswith('catálogo ') else t


def por_categoria(itens, ordem):
    """Agrupa pela ordem das categorias, mantendo a ordem do painel dentro de cada uma."""
    vistas = list(ordem) + [c for c in dict.fromkeys(i.get('cat') for i in itens) if c not in ordem]
    return sorted(itens, key=lambda i: vistas.index(i.get('cat')) if i.get('cat') in vistas else len(vistas))


# ================================================================== imagens
class Imagens:
    def __init__(self, pasta):
        self.pasta = pasta
        self.n = 0

    def recorte(self, src, w_mm, h_mm, topo=False):
        """Recorta ao rácio pedido e reduz a 300 ppp, em JPEG (o Chrome mete-o no PDF tal e qual).

        topo=True mostra o cimo da fotografia: nas do fornecedor (733x1100) fica à
        vista o logótipo dele, como no site, e a parte de cima da peça."""
        caminho = os.path.join(ROOT, str(src or '').lstrip('/'))
        if not src or not os.path.isfile(caminho):
            return None
        self.n += 1
        dst = os.path.join(self.pasta, 'i%03d.jpg' % self.n)
        im = Image.open(caminho)
        if im.mode != 'RGB':
            fundo = Image.new('RGB', im.size, (255, 255, 255))
            fundo.paste(im, mask=im.convert('RGBA').split()[-1])
            im = fundo
        tw, th = PX(w_mm), PX(h_mm)
        sw, sh = im.size
        if sw / sh > tw / th:
            nw = int(sh * tw / th); x = (sw - nw) // 2
            im = im.crop((x, 0, x + nw, sh))
        else:
            nh = int(sw * th / tw); y = 0 if topo else (sh - nh) // 2
            im = im.crop((0, y, sw, y + nh))
        if im.width > tw:
            im = im.resize((tw, th), Image.LANCZOS)
        im.save(dst, 'JPEG', quality=84, optimize=True, progressive=True)
        return dst

    def capa(self, w_mm, h_mm, ocupa=0.74):
        """O logótipo centrado num painel do azul do próprio ficheiro (fundo liso):
        recorta-se à volta do desenho e acrescenta-se fundo onde faltar."""
        im = Image.open(CAPA).convert('RGB')
        bg = im.getpixel((2, 2))
        caixa = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L') \
            .point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, im.width, im.height)
        lw, lh = caixa[2] - caixa[0], caixa[3] - caixa[1]
        ph = lh / ocupa; pw = ph * w_mm / h_mm
        if lw > pw * 0.8:
            pw = lw / 0.8; ph = pw * h_mm / w_mm
        pw, ph = int(pw), int(ph)
        painel = Image.new('RGB', (pw, ph), bg)
        painel.paste(im, (int(pw / 2 - (caixa[0] + caixa[2]) / 2), int(ph / 2 - (caixa[1] + caixa[3]) / 2)))
        dst = os.path.join(self.pasta, 'capa.jpg')
        painel.save(dst, 'JPEG', quality=92, optimize=True)
        return dst

    def qr(self, texto):
        dst = os.path.join(self.pasta, 'qr.svg')
        segno.make(texto, error='m').save(dst, kind='svg', scale=10, border=0, dark='#26261A')
        return dst


# ================================================================== ícones
T = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
# Os desenhos dos serviços são os do site (assets/js/app.js, ICONS).
ICONES = {
    'tshirt': '<path d="M8.5 3.5 4 6l2 3 2-1.2V20h8V7.8L18 9l2-3-4.5-2.5a3.5 3.5 0 0 1-7 0Z"/>',
    'hoodie': '<path d="M8 4 4 6.5 6 10l2-1v11h8V9l2 1 2-3.5L16 4"/><path d="M8 4c.6 2.4 7.4 2.4 8 0"/><path d="M12 6v4"/>',
    'polo': '<path d="M9 3.5 4 6l2 3 2-1v11h8V8l2 1 2-3-5-2.5"/><path d="M9 3.5 12 7l3-3.5"/><path d="M12 7v4"/>',
    'cap': '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M12 6v8"/><path d="M20 14H4"/><path d="M4 14c-1 0-2 .4-2 1.5"/>',
    'mug': '<rect x="5" y="5" width="11" height="15" rx="2.5"/><path d="M16 8h3a2.5 2.5 0 0 1 0 5h-3"/>',
    'sticker': '<path d="M5 4h9l5 5v11H5Z"/><path d="M14 4v5h5"/>',
    'dtf': '<path d="m12 3 8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/>',
    'uv': '<path d="M12 3s5 5.4 5 9.2A5 5 0 0 1 7 12.2C7 8.4 12 3 12 3Z"/><path d="M9.6 12.4a2.4 2.4 0 0 0 4.8 0"/>',
    'vinyl': '<ellipse cx="12" cy="6.5" rx="8" ry="3"/><path d="M4 6.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><circle cx="12" cy="6.5" r="1.3"/>',
    'banner': '<path d="M6 3v18"/><path d="M6 4.5h13l-3 4 3 4H6"/>',
    'merch': '<path d="M4 8h16l-1.2 12H5.2Z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/><path d="m12 11.5 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L8.8 13.8l2.2-.3Z"/>',
    'gift': '<rect x="3.5" y="9" width="17" height="11.5" rx="1.6"/><path d="M2.5 9h19"/><path d="M12 9v11.5"/><path d="M12 9C9.8 9 8 8 8 6.4A2.4 2.4 0 0 1 12 5a2.4 2.4 0 0 1 4 1.4C16 8 14.2 9 12 9Z"/>',
    'work': '<path d="M9 3.5 5 5.5v15h14v-15l-4-2"/><path d="m9 3.5 3 4 3-4"/><path d="M5 11h4M15 11h4"/><path d="M5 14.5h4M15 14.5h4"/>',
    'bag': '<path d="M5 7.5h14l-1 13H6Z"/><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5"/>',
    'phone': '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 5.5h3"/>',
    'estrela': '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z"/>',
    'ig': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
    'web': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'pin': '<path d="M12 22s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    'seta': '<path d="M5 12h14M13 6l6 6-6 6"/>',
}
WA_SVG = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 '
          '11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 '
          '0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.24.68-1.42 1.31-1.95 1.35-.5.04-.99.21-3.42-.71'
          '-2.88-1.14-4.72-4.09-4.86-4.28-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.11 1-2.4.26-.28.57-.35.76-.35.19 0 '
          '.38 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5'
          '-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.81.88'
          '-1.09.19-.28.37-.23.63-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.11.07.66-.17 1.34z"/></svg>')


def ic(nome):
    return '<svg viewBox="0 0 24 24" %s aria-hidden="true">%s</svg>' % (T, ICONES.get(nome) or ICONES['estrela'])


# ================================================================== o catálogo
class Catalogo:
    def __init__(self, img):
        self.img = img
        self.site = carregar('site.json')
        self.C = self.site.get('contacts') or {}
        self.wa_base = 'https://wa.me/%s' % ''.join(ch for ch in str(self.C.get('phone_intl') or '') if ch.isdigit())
        self.paginas = []          # {'id', 'cls', 'corpo', 'pe'}
        self.seccoes = []          # (id, nome, contagem) para o índice
        self.ano = datetime.datetime.now(ZoneInfo('Europe/Lisbon')).year

    def wa(self, texto=None):
        return self.wa_base + ('?text=' + quote(texto) if texto else '')

    def pagina(self, corpo, cls='', ident=None, pe=True):
        self.paginas.append({'id': ident, 'cls': cls, 'corpo': corpo, 'pe': pe})

    # ---------------------------------------------------------------- capa
    def capa(self):
        h = self.site.get('hero') or {}
        cidade = (str(self.C.get('address_line2') or '').split() or [''])[-1]
        badge = str(h.get('badge') or '').lstrip('✦ ').strip()
        self.pagina(
            '<div class="cv-main"><p class="eyebrow">Personalização &amp; estampagem</p>'
            '<h1>Catálogo de<br>Produtos <span class="ano">%d</span></h1>'
            '<p class="cv-sub"><b>Tu imaginas, nós criamos.</b> Damos vida às tuas <span class="hl">ideias</span> '
            'em produtos exclusivos.</p></div>'
            '<div class="cv-media"><div class="cv-logo"><img src="%s" alt="%s"></div>%s</div>'
            '<div class="cv-pe"><div><b>%s</b><span>%s</span></div>'
            '<a class="cv-pe-d" href="%s"><b>%s</b><span>artstampcreations.pt</span></a></div>' % (
                self.ano, url(self.img.capa(80, 80)), MARCA,
                '<span class="cv-badge">%s%s</span>' % (ic('estrela'), e(badge)) if badge else '',
                MARCA, e('%s · Portugal' % cidade if cidade else 'Portugal'), self.wa(), e(self.C.get('phone'))),
            cls='page--capa', pe=False)

    # ---------------------------------------------------------------- serviços
    def servicos(self):
        s = carregar('services.json')
        itens = [x for x in lista(s, 'services') if str(x.get('title') or '').strip()]
        if not itens:
            return
        head = s.get('head') or {}
        folha = ''.join(
            '<a class="svc" href="%s"><span class="svc-ic">%s</span><span class="svc-t">%s</span></a>' % (
                e(self.wa('Olá! Queria um orçamento: %s.' % x['title'])), ic(x.get('icon')), e(x['title']))
            for x in itens)
        self.pagina(
            '<div class="cab"><p class="eyebrow">%s</p><h2 class="fit">%s</h2><p class="lead">%s</p></div>'
            '<div class="folha">%s</div>' % (
                e(head.get('eyebrow') or 'O que fazemos'), e(head.get('title') or 'O que fazemos'),
                e(head.get('lead')), folha), ident='servicos')
        self.seccoes.append(('servicos', sem_catalogo(head.get('eyebrow')) or 'O que fazemos',
                             '%d serviços' % len(itens)))

    # ---------------------------------------------------------------- cartões
    def cartao(self, foto, nome, linha, specs, pedido, pilula=None):
        img = ('<img src="%s" alt="%s">' % (url(foto), e(nome))) if foto else '<span class="c-sem"></span>'
        return (
            '<a class="card" href="%s"><div class="c-foto">%s%s</div><div class="c-corpo"><h4>%s</h4>'
            '%s<p class="c-specs">%s</p></div><span class="c-wa">%s</span></a>' % (
                e(pedido), img, '<span class="c-pill">%s</span>' % e(pilula) if pilula else '', e(nome),
                '<p class="c-linha">%s</p>' % e(linha) if linha else '', e(' · '.join(s for s in specs if s)), WA_SVG))

    def cartao_mais(self):
        return ('<div class="card card--nota"><span class="nota-ic">%s</span><h4>Muito mais a pedido</h4>'
                '<p>Temos muitos outros modelos, cores e medidas. Pergunta-nos.</p></div>' % ic('estrela'))

    def cartao_pedir(self, largo=False):
        return ('<a class="card card--cta%s" href="%s"><span class="nota-ic">%s</span><h4>Pede o teu orçamento</h4>'
                '<p>Sem compromisso e com resposta rápida.</p><b>%s</b></a>' % (
                    ' card--largo' if largo else '', e(self.wa('Olá! Queria pedir um orçamento.')), WA_SVG,
                    e(self.C.get('phone'))))

    def seccao_de_cartoes(self, ident, nome, eyebrow, itens, cartao, contagem):
        """Quatro cartões por página (2 x 2); a última completa-se com «Muito mais a
        pedido» e «Pede o teu orçamento». O título de cada página diz as categorias dela."""
        if not itens:
            return
        grupos = [itens[i:i + 4] for i in range(0, len(itens), 4)]
        cartoes = [[cartao(x) for x in g] for g in grupos]
        falta = 4 - len(cartoes[-1])
        cartoes[-1] += {0: [], 1: [self.cartao_pedir()], 2: [self.cartao_mais(), self.cartao_pedir()],
                        3: [self.cartao_mais(), self.cartao_pedir(largo=True)]}[falta]
        for k, (g, cs) in enumerate(zip(grupos, cartoes)):
            cats = [c for c in dict.fromkeys(str(x.get('cat') or '').strip() for x in g) if c]
            self.pagina(
                '<div class="cab cab--linha"><div><p class="eyebrow">%s</p><h2 class="fit">%s</h2></div></div>'
                '<div class="grelha">%s</div>' % (e(eyebrow), e(' · '.join(cats) or nome), ''.join(cs)),
                ident=ident if k == 0 else None)
        self.seccoes.append((ident, nome, contagem))

    def textil(self):
        m = carregar('models.json')
        itens = por_categoria([x for x in lista(m, 'models') if str(x.get('name') or '').strip()], ORDEM_TEXTIL)

        def cartao(x):
            foto = self.img.recorte(x.get('img'), FOTO_W, FOTO_H, topo=True)
            cores = x.get('colors')
            return self.cartao(foto, x['name'], x.get('tag') or x.get('cat'),
                               [x.get('gsm'), x.get('fabric'), x.get('sizes')],
                               self.wa('Olá! Queria um orçamento para o modelo %s (%s).' % (x['name'], x.get('tag') or x.get('cat'))),
                               pilula=('%s cores' % cores) if cores else None)
        head = m.get('head') or {}
        self.seccao_de_cartoes('textil', sem_catalogo(head.get('eyebrow')) or 'Têxtil', head.get('eyebrow') or 'Catálogo Têxtil',
                               itens, cartao, '%d modelos' % len(itens))

    def artigos(self, ficheiro, ident, nome_omissao):
        d = carregar(ficheiro)
        ordem = [c for c in (d.get('cats') or []) if c != 'Todos']
        itens = por_categoria([x for x in lista(d, 'products') if str(x.get('name') or '').strip()], ordem)

        def cartao(x):
            imgs = x.get('imgs') if isinstance(x.get('imgs'), list) else [x.get('img')]
            foto = self.img.recorte((imgs or [None])[0], FOTO_W, FOTO_H)
            specs = [str(s.get('value') or '') for s in (x.get('specs') or []) if isinstance(s, dict)][:3]
            return self.cartao(foto, x['name'], None, specs,
                               self.wa('Olá! Queria um orçamento para: %s.' % x['name']))
        head = d.get('head') or {}
        self.seccao_de_cartoes(ident, sem_catalogo(head.get('eyebrow')) or nome_omissao,
                               head.get('eyebrow') or nome_omissao, itens, cartao, '%d artigos' % len(itens))

    # ---------------------------------------------------------------- trabalhos
    def trabalhos(self):
        g = carregar('gallery.json')
        itens = [x for x in lista(g, 'items') if x.get('img')][:TRABALHOS]
        if not itens:
            return
        head = g.get('head') or {}
        cel = []
        for x in itens:
            foto = self.img.recorte(x['img'], TRAB_W, TRAB_H)
            if foto:
                cel.append('<figure class="trab"><img src="%s" alt="%s"><figcaption>%s</figcaption></figure>' % (
                    url(foto), e(x.get('cap')), e(x.get('cap'))))
        ig = self.C.get('instagram_url')
        if ig:
            cel.append('<a class="trab trab--ig" href="%s"><span class="nota-ic">%s</span><h4>Mais trabalhos no Instagram</h4>'
                       '<b>Ver no Instagram %s</b></a>' % (e(ig), ic('ig'), ic('seta')))
        for k in range(0, len(cel), 4):
            self.pagina('<div class="cab cab--linha"><div><p class="eyebrow">%s</p><h2 class="fit">%s</h2></div></div>'
                        '<div class="grelha grelha--trab">%s</div>' % (
                            e(head.get('eyebrow') or 'Trabalhos'), e(head.get('title') or 'Trabalhos'), ''.join(cel[k:k + 4])),
                        ident='trabalhos' if k == 0 else None)
        self.seccoes.append(('trabalhos', sem_catalogo(head.get('eyebrow')) or 'Trabalhos', '%d fotografias' % len(itens)))

    # ---------------------------------------------------------------- contactos
    def contactos(self):
        C, ct = self.C, self.site.get('contacto') or {}
        linhas = [
            ('ig', 'Instagram', C.get('instagram_handle'), C.get('instagram_url')),
            ('web', 'Site', 'artstampcreations.pt', SITE),
            ('mail', 'Email', C.get('email'), 'mailto:%s' % C.get('email') if C.get('email') else None),
            ('pin', 'Onde estamos', ', '.join(x for x in (C.get('address_line1'), C.get('address_line2')) if x), C.get('maps_url')),
        ]
        rows = ''.join(
            '<a class="ct-l" href="%s"><span class="ct-ic">%s</span><span class="ct-t"><small>%s</small><b>%s</b></span>'
            '<span class="ct-seta">%s</span></a>' % (e(h or '#'), ic(i), e(r), e(v), ic('seta'))
            for i, r, v, h in linhas if v)
        dono = str(self.site.get('owner_name') or '').strip()
        self.pagina(
            '<div class="cab"><p class="eyebrow">Contactos</p><h2 class="fit">%s</h2><p class="lead">%s</p></div>'
            '<a class="ct-wa" href="%s"><span class="ct-wa-ic">%s</span><span class="ct-t"><b>Pedir orçamento no WhatsApp</b>'
            '<small>%s</small></span><span class="ct-seta">%s</span></a>'
            '<div class="ct-lista">%s</div>'
            '<div class="ct-pe"><img class="ct-qr" src="%s" alt=""><p><b>No papel?</b> Aponta a câmara ao código para '
            'abrir o WhatsApp.</p></div>'
            '<p class="ct-legal"><b>%s</b>%s · NIF %s<br>Imagens ilustrativas: cores, medidas e disponibilidade '
            'confirmam-se no orçamento.</p>' % (
                e(ct.get('title') or 'Vamos dar vida à tua ideia?'), e(ct.get('lead')), self.wa(), WA_SVG,
                e(C.get('phone')), ic('seta'), rows, url(self.img.qr(self.wa())), MARCA,
                (' · %s' % e(dono)) if dono else '', NIF),
            ident='contactos')
        self.seccoes.append(('contactos', 'Contactos', 'WhatsApp · Instagram · morada'))

    # ---------------------------------------------------------------- índice
    def indice(self):
        """Vai logo a seguir à capa; os números de página contam com ele."""
        numero = {p['id']: (n + 1 if n >= 2 else n) for n, p in enumerate(self.paginas, 1) if p['id']}
        linhas = ''.join(
            '<a class="ix" href="#%s"><b>%s</b><span>%s</span><i>%d</i></a>' % (ident, e(nome), e(cont), numero[ident])
            for ident, nome, cont in self.seccoes)
        self.paginas.insert(1, {'id': 'indice', 'cls': '', 'pe': True, 'corpo':
                                '<div class="cab"><p class="eyebrow">O catálogo</p><h2 class="fit">Escolhe por onde começar</h2></div>'
                                '<nav class="ixs">%s</nav>' % linhas})

    def fazer(self):
        self.capa()
        self.servicos()
        self.textil()
        self.artigos('rigidos.json', 'rigidos', 'Rígidos')
        self.artigos('lonas.json', 'lonas', 'Lonas e Vinil')
        self.trabalhos()
        self.contactos()
        self.indice()
        total = len(self.paginas)
        secs = []
        for n, p in enumerate(self.paginas, 1):
            pe = ('<div class="pe"><b>%s</b><i>%02d / %02d</i></div>' % (MARCA, n, total)) if p['pe'] else ''
            secs.append('<section class="page %s"%s>%s%s</section>' % (
                p['cls'], (' id="%s"' % p['id']) if p['id'] else '', p['corpo'], pe))
        return ('<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Catálogo %d — %s</title>'
                '<style>%s</style></head><body>%s<script>%s</script></body></html>') % (
            self.ano, MARCA, CSS, ''.join(secs), JS), total


# ================================================================== aspeto
def fontes():
    def b64(rel):
        with open(os.path.join(ROOT, rel), 'rb') as f:
            return base64.b64encode(f.read()).decode()
    return ("@font-face{font-family:'Fredoka';font-weight:300 700;src:url(data:font/woff2;base64,%s) format('woff2')}"
            "@font-face{font-family:'Mulish';font-weight:300 900;src:url(data:font/woff2;base64,%s) format('woff2')}") % (
        b64('assets/fonts/fredoka-var.woff2'), b64('assets/fonts/mulish-var.woff2'))


CSS = """
@page{size:120mm 150mm;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
:root{--blue:#1A8CE4;--blue-050:#EAF4FD;--ink:#26261A;--orange:#FA9431;--orange-050:#FDEEDD;--paper:#FBFAF6;
 --soft:#F4F1EA;--muted:#6F6F64;--line:#E7E4DB;--line2:#D6D2C7;--stroke:#16160F;--wa:#1FAF54}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Mulish',sans-serif;color:#3D3D34;background:#fff;-webkit-font-smoothing:antialiased}
h1,h2,h4{font-family:'Fredoka',sans-serif;color:var(--ink);font-weight:600;line-height:1.08}
a{color:inherit;text-decoration:none}
img{display:block}
svg{display:block}
.page{position:relative;width:120mm;height:150mm;overflow:hidden;background:var(--paper);padding:8mm 8mm 11mm;
 page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.pe{position:absolute;left:8mm;right:8mm;bottom:4.2mm;display:flex;justify-content:space-between;font-size:6.6pt;color:var(--muted)}
.pe b{font-family:'Fredoka';font-weight:600;color:var(--ink)}
.pe i{font-style:normal;font-family:'Fredoka';font-weight:600;color:var(--blue)}
.eyebrow{display:flex;align-items:center;gap:1.6mm;font-family:'Fredoka';font-weight:600;font-size:7pt;letter-spacing:.14em;
 text-transform:uppercase;color:var(--blue)}
.eyebrow::before{content:"";width:4.6mm;height:.75mm;border-radius:1mm;background:var(--orange)}
.hl{color:var(--orange)}
.cab{margin-bottom:4.5mm}
.cab h2{font-size:17pt;margin-top:1.6mm;white-space:nowrap;overflow:hidden}
.cab .lead{font-size:8.2pt;color:var(--muted);line-height:1.45;margin-top:1.6mm}
.cab--linha{margin-bottom:3.6mm}
.cab--linha h2{font-size:15pt}

/* capa */
.page--capa{padding:9mm 9mm 8mm}
.page--capa::before{content:"";position:absolute;right:-34mm;top:-36mm;width:86mm;height:86mm;border-radius:50%;background:var(--blue-050)}
.page--capa::after{content:"";position:absolute;left:-22mm;bottom:20mm;width:48mm;height:48mm;border-radius:50%;background:rgba(250,148,49,.13)}
.page--capa>*{position:relative;z-index:1}
h1{font-size:25pt;font-weight:700;margin:2mm 0 3mm}
.ano{color:var(--blue)}
.cv-sub{font-size:9.2pt;color:var(--muted);line-height:1.45;max-width:86mm}
.cv-sub b{color:var(--ink)}
.cv-media{position:relative;margin-block:auto}
.cv-logo{width:80mm;margin-inline:auto;border-radius:5mm;overflow:hidden;background:var(--blue);transform:rotate(-1.2deg);
 border:.55mm solid var(--stroke);box-shadow:1.2mm 1.2mm 0 var(--stroke)}
.cv-logo img{width:100%;height:80mm;object-fit:cover}
.cv-badge{position:absolute;left:15mm;bottom:-3mm;display:inline-flex;align-items:center;gap:1mm;background:var(--orange);
 font-family:'Fredoka';font-weight:600;font-size:8pt;color:var(--ink);padding:1.3mm 3mm 1.3mm 2.4mm;border-radius:99px;
 transform:rotate(-3deg);border:.55mm solid var(--stroke);box-shadow:.8mm .8mm 0 var(--stroke)}
.cv-badge svg{width:3mm;height:3mm;fill:var(--ink);stroke:none}
.cv-pe{display:flex;justify-content:space-between;align-items:flex-end;border-top:.45mm solid var(--line2);padding-top:3mm;
 font-size:7.4pt;color:var(--muted)}
.cv-pe b{display:block;font-family:'Fredoka';font-weight:600;font-size:9.4pt;color:var(--ink)}
.cv-pe-d{text-align:right}.cv-pe-d b{color:var(--blue)}

/* índice */
.ixs{display:flex;flex-direction:column;gap:2.4mm}
.ix{display:flex;align-items:baseline;gap:2.6mm;padding:3.4mm 4mm;background:#fff;border:.3mm solid var(--line);border-radius:3.6mm;
 box-shadow:0 1mm 2.4mm -1.4mm rgba(38,38,26,.22)}
.ix b{font-family:'Fredoka';font-weight:600;font-size:12.5pt;color:var(--ink)}
.ix span{font-size:8pt;color:var(--muted)}
.ix i{margin-left:auto;font-style:normal;font-family:'Fredoka';font-weight:600;font-size:11pt;color:var(--blue)}

/* serviços: a folha de autocolantes do site */
.folha{flex:1;display:flex;flex-wrap:wrap;justify-content:center;align-content:center;gap:3.4mm 2.4mm;padding:2mm 0 1mm}
.svc{display:inline-flex;align-items:center;gap:1.6mm;padding:1.3mm 3.2mm 1.3mm 1.3mm;border-radius:99px;background:#fff;color:var(--ink);
 border:.5mm solid var(--stroke);box-shadow:.9mm .9mm 0 var(--stroke)}
.svc:nth-child(3n+1){rotate:-1.8deg}.svc:nth-child(3n+2){rotate:1.3deg}.svc:nth-child(3n+3){rotate:-.7deg}
.svc-ic{flex:none;width:6.6mm;height:6.6mm;border-radius:50%;background:var(--blue-050);color:var(--blue);
 border:.35mm solid rgba(22,22,15,.13);display:flex;align-items:center;justify-content:center}
.svc-ic svg{width:4mm;height:4mm}
.svc-t{font-family:'Fredoka';font-weight:600;font-size:8.6pt;line-height:1.1}
.svc--azul{background:var(--blue);color:#fff}
.svc--azul .svc-ic{background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.4)}
.svc--laranja{background:var(--orange)}
.svc--laranja .svc-ic{background:rgba(38,38,26,.13);color:var(--ink);border-color:rgba(22,22,15,.2)}

/* cartões dos catálogos */
.grelha{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4mm}
.card{position:relative;display:flex;flex-direction:column;min-height:0;background:#fff;border:.3mm solid var(--line);
 border-radius:3.6mm;overflow:hidden;box-shadow:0 1.2mm 2.6mm -1.4mm rgba(38,38,26,.25)}
.c-foto{position:relative;flex:none;height:35mm;background:var(--soft)}
.c-foto img{width:100%;height:100%;object-fit:cover}
.c-pill{position:absolute;left:2mm;bottom:2mm;font-family:'Fredoka';font-weight:600;font-size:6.6pt;color:var(--ink);
 background:rgba(255,255,255,.94);padding:.6mm 2mm;border-radius:99px}
.c-corpo{padding:2.2mm 2.8mm 2.4mm;min-height:0}
.card h4{font-size:11.5pt;padding-right:6.5mm;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.c-linha{font-size:7.2pt;color:var(--muted);margin-top:.3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-specs{font-size:7.4pt;color:var(--ink);margin-top:1mm;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;
 -webkit-box-orient:vertical;overflow:hidden}
.c-wa{position:absolute;right:2.4mm;top:37mm;width:6.2mm;height:6.2mm;border-radius:50%;background:var(--wa);color:#fff;
 display:flex;align-items:center;justify-content:center}
.c-wa svg{width:3.8mm;height:3.8mm}
.card--nota,.card--cta{padding:4.4mm;justify-content:center}
.card--nota{background:var(--blue-050);border-color:#CFE5FA}
.card--cta{background:var(--ink);border-color:var(--ink)}
.nota-ic{width:8mm;height:8mm;border-radius:2.4mm;display:flex;align-items:center;justify-content:center;background:#fff;color:var(--blue)}
.nota-ic svg{width:4.8mm;height:4.8mm}
.card--cta .nota-ic{background:rgba(255,255,255,.12);color:#25D366}
.card--nota h4,.card--cta h4{font-size:11.5pt;margin:2.6mm 0 1.4mm;white-space:normal;padding:0}
.card--cta h4{color:#fff}
.card--nota p,.card--cta p{font-size:7.6pt;line-height:1.4;color:var(--muted)}
.card--cta p{color:rgba(255,255,255,.75)}
.card--cta b{font-family:'Fredoka';font-weight:600;font-size:11pt;color:var(--orange);margin-top:2.4mm}
.card--largo{grid-column:span 2}

/* trabalhos */
.trab{display:flex;flex-direction:column;min-height:0;background:#fff;border:.3mm solid var(--line);border-radius:3.6mm;
 overflow:hidden;box-shadow:0 1.2mm 2.6mm -1.4mm rgba(38,38,26,.25)}
.trab img{width:100%;flex:1;min-height:0;object-fit:cover}
.trab figcaption{flex:none;font-size:7.2pt;color:var(--muted);padding:1.6mm 2.6mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trab--ig{justify-content:center;padding:4.4mm;background:var(--blue-050);border-color:#CFE5FA}
.trab--ig h4{font-size:11.5pt;margin:2.6mm 0 1.4mm}
.trab--ig b{display:flex;align-items:center;gap:1.2mm;font-family:'Fredoka';font-weight:600;font-size:8.6pt;color:var(--blue)}
.trab--ig b svg{width:3.6mm;height:3.6mm}

/* contactos */
.ct-wa{display:flex;align-items:center;gap:3mm;padding:4mm 4.4mm;border-radius:4.4mm;background:var(--wa);color:#fff;
 border:.55mm solid var(--stroke);box-shadow:1.2mm 1.2mm 0 var(--stroke)}
.ct-wa-ic svg{width:8mm;height:8mm}
.ct-wa b{display:block;font-family:'Fredoka';font-weight:600;font-size:12.5pt}
.ct-wa small{font-size:7.6pt;opacity:.92}
.ct-seta{margin-left:auto}.ct-seta svg{width:4.6mm;height:4.6mm}
.ct-lista{margin-top:5mm;background:#fff;border:.3mm solid var(--line);border-radius:3.6mm;overflow:hidden}
.ct-l{display:flex;align-items:center;gap:3mm;padding:2.9mm 3.6mm;border-top:.3mm solid var(--line)}
.ct-l:first-child{border-top:0}
.ct-ic{flex:none;width:7mm;height:7mm;border-radius:2mm;background:var(--blue-050);color:var(--blue);display:flex;align-items:center;justify-content:center}
.ct-ic svg{width:4mm;height:4mm}
.ct-t{min-width:0}
.ct-l small{display:block;font-size:6.2pt;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.ct-l b{display:block;font-family:'Fredoka';font-weight:500;font-size:9.8pt;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct-l .ct-seta{color:var(--line2)}
.ct-pe{display:flex;align-items:center;gap:3.4mm;margin-top:auto;padding-top:2.4mm}
.ct-qr{width:15mm;height:15mm;flex:none}
.ct-pe p{font-size:7.4pt;color:var(--muted)}.ct-pe p b{color:var(--ink)}
.ct-legal{margin-top:2.4mm;font-size:6pt;color:var(--muted);line-height:1.45}
.ct-legal b{font-family:'Fredoka';color:var(--ink)}
"""

# Antes de imprimir: os títulos que não cabem numa linha encolhem, e os
# autocolantes pintam-se pela posição real na folha (o mesmo que o site faz em
# assets/js/app.js, pintarAutocolantes), para as cores não fazerem colunas.
JS = r"""
document.querySelectorAll('.fit').forEach(function (h) {
  var t = parseFloat(getComputedStyle(h).fontSize);
  while (h.scrollWidth > h.clientWidth + 0.5 && t > 9) { t -= 0.5; h.style.fontSize = t + 'px'; }
});
(function () {
  var PALETA = [null, 'svc--azul', null, 'svc--laranja'];
  document.querySelectorAll('.folha').forEach(function (folha) {
    var filas = [], topo = null;
    Array.prototype.forEach.call(folha.querySelectorAll('.svc'), function (el, i) {
      if (el.offsetTop !== topo) { filas.push([]); topo = el.offsetTop; }
      filas[filas.length - 1].push({ el: el, n: i % 4, esq: el.offsetLeft, dir: el.offsetLeft + el.offsetWidth });
    });
    function sobrepoe(a, b) {
      var cruz = Math.min(a.dir, b.dir) - Math.max(a.esq, b.esq), menor = Math.min(a.dir - a.esq, b.dir - b.esq);
      return menor > 0 && cruz / menor > 0.4;
    }
    function limite(n) { return PALETA[n] ? 2 : 3; }
    function corridaAcima(it, ant) {
      var m = 0;
      ant.forEach(function (c) { if (sobrepoe(it, c) && PALETA[c.n] === PALETA[it.n] && c.corrida > m) m = c.corrida; });
      return m;
    }
    filas.forEach(function (fila, f) {
      var ant = f > 0 ? filas[f - 1] : [];
      fila.forEach(function (it) {
        for (var p = 0; p < 3; p++) { if (corridaAcima(it, ant) < limite(it.n)) break; it.n = (it.n + 1) % 4; }
        it.corrida = corridaAcima(it, ant) + 1;
        if (PALETA[it.n]) it.el.classList.add(PALETA[it.n]);
      });
    });
  });
})();
"""


# ================================================================== imprimir
def origem():
    """O commit de onde vieram os dados, e a data dele: o painel pergunta ao
    GitHub se houve commits em data/ desde então («o site mudou»). No GitHub, o
    commit da corrida; aqui, o HEAD; no ensaio do painel, CATALOGO_ORIGEM_DATA."""
    sha = os.environ.get('GITHUB_SHA')
    if not sha:
        try:
            sha = subprocess.run(['git', '-C', ROOT, 'rev-parse', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
        except Exception:
            sha = None
    data = os.environ.get('CATALOGO_ORIGEM_DATA')
    if not data and sha:
        try:
            data = subprocess.run(['git', '-C', ROOT, 'log', '-1', '--format=%cI', sha], capture_output=True, text=True, check=True).stdout.strip() or None
        except Exception:
            data = None
    return sha, data


def main():
    ap = argparse.ArgumentParser(description='Faz o catálogo em PDF com o que está no site.')
    ap.add_argument('--saida', default=os.path.join(ROOT, '_source', 'catalogo', 'Catalogo-ArtStampCreations.pdf'),
                    help='o PDF (e o .json das informações ao lado); por omissão em _source/, fora do git')
    ap.add_argument('--html', help='guardar também o HTML (para rever)')
    a = ap.parse_args()

    global CSS
    CSS = fontes() + CSS
    a.saida = os.path.abspath(a.saida)
    os.makedirs(os.path.dirname(a.saida), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='catalogo-')
    try:
        doc, paginas = Catalogo(Imagens(tmp)).fazer()
        html_p = os.path.join(tmp, 'catalogo.html')
        with open(html_p, 'w', encoding='utf-8') as f:
            f.write(doc)
        if a.html:
            shutil.copy(html_p, a.html)
        parte = a.saida + '.parte'
        if os.path.exists(parte):
            os.remove(parte)
        cmd = [encontrar_chrome(), '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
               '--user-data-dir=' + os.path.join(tmp, 'perfil'), '--no-pdf-header-footer',
               '--virtual-time-budget=20000', '--print-to-pdf=' + parte, url(html_p)]
        r = subprocess.run(cmd, capture_output=True, timeout=240)
        if not os.path.exists(parte) or os.path.getsize(parte) < 10000:
            sys.stderr.write(r.stderr.decode(errors='replace')[-2000:])
            sys.exit('O Chrome não escreveu o PDF (o anterior fica como estava).')
        os.replace(parte, a.saida)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    sha, data = origem()
    meta = {
        'gerado_em': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'paginas': paginas,
        'bytes': os.path.getsize(a.saida),
        'origem': sha,
        'origem_data': data,
        'dados': ['data/' + n for n in DADOS],
    }
    with open(os.path.splitext(a.saida)[0] + '.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('Catálogo: %d páginas, %.1f MB -> %s' % (paginas, meta['bytes'] / 1e6, a.saida))


if __name__ == '__main__':
    main()
