# -*- coding: utf-8 -*-
"""
Pré-render do conteúdo para os motores de busca
===============================================
O site desenha as secções em JavaScript a partir de data/*.json. Um rastreador
que não corra JS via só 701 das 2.624 palavras — no lugar dos serviços, dos
trabalhos e dos catálogos encontrava "A carregar…". O Google até executa JS,
mas numa segunda passagem que pode demorar dias; o Bing e os leitores de links
muitas vezes nem isso.

Este script corre o PRÓPRIO app.js num Chrome headless e grava o resultado
dentro do index.html, entre marcadores <!--pre:id-->…<!--/pre:id-->. Em runtime
o app.js volta a desenhar por cima, portanto o visitante não nota diferença
nenhuma — não há alteração de UI nem de design.

Corre localmente e na GitHub Action (.github/workflows/prerender.yml), que o
dispara sempre que o cliente edita data/*.json no backoffice.

Uso:  python3 .github/scripts/prerender.py [--verificar]
      --verificar  não escreve; devolve 1 se o HTML estiver desatualizado
"""
import http.server
import os
import re
import socket
import socketserver
import sys
import threading
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
sys.path.insert(0, AQUI)
from cdp import Chrome                                        # noqa: E402

PAGINA = os.path.join(RAIZ, 'index.html')

# Zonas que o app.js preenche e que valem indexação
ZONAS = ['services-grid', 'gallery-grid', 'rigidos-grid', 'models-grid',
         'lonas-grid', 'models-filters', 'rigidos-filters', 'lonas-filters']


def porta_livre():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def servir(porta):
    handler = lambda *a, **k: Silencioso(*a, directory=RAIZ, **k)   # noqa: E731
    srv = socketserver.TCPServer(('127.0.0.1', porta), handler)
    srv.allow_reuse_address = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# Corre depois de o app.js desenhar: abre tudo o que está colapsado e limpa o
# que é estado de runtime, para o rastreador ver a lista completa.
PREPARAR = r"""
(async () => {
  const dorme = ms => new Promise(r => setTimeout(r, ms));
  const alvos = %s;

  // esperar que as grelhas deixem de dizer "A carregar…"
  for (let i = 0; i < 80; i++) {
    const porFazer = alvos.filter(id => {
      const el = document.getElementById(id);
      return !el || /A carregar/.test(el.textContent);
    });
    if (!porFazer.length) break;
    await dorme(150);
  }
  await dorme(400);

  // abrir todos os "Ver mais": o conteúdo escondido também tem de ser indexado
  for (let volta = 0; volta < 4; volta++) {
    const botoes = [...document.querySelectorAll('.more-btn')]
      .filter(b => !b.hidden && b.textContent.trim() === 'Ver mais');
    if (!botoes.length) break;
    botoes.forEach(b => b.click());
    await dorme(250);
  }

  // A galeria é distribuída pelo masonry conforme as proporções das imagens JÁ
  // carregadas nesse instante — uma corrida que dava colunas diferentes a cada
  // execução. Aqui redistribuímos por índice, de forma determinística. O
  // app.js volta a fazer o masonry a sério em runtime.
  const galeria = document.getElementById('gallery-grid');
  if (galeria) {
    const colunas = [...galeria.querySelectorAll('.gallery__col')];
    const figuras = [...galeria.querySelectorAll('.gitem')]
      .sort((a, b) => (+a.dataset.i) - (+b.dataset.i));
    if (colunas.length && figuras.length) {
      colunas.forEach(c => { c.innerHTML = ''; });
      figuras.forEach((f, i) => colunas[i %% colunas.length].appendChild(f));
    }
  }

  // limpar estado de runtime que não faz sentido no HTML servido
  document.querySelectorAll('[style*="display"]').forEach(el => {
    if (el.style.display === 'none') el.style.removeProperty('display');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
  document.querySelectorAll('.is-in').forEach(el => el.classList.remove('is-in'));

  const saida = {};
  alvos.forEach(id => { const el = document.getElementById(id); if (el) saida[id] = el.innerHTML; });
  return JSON.stringify(saida);
})()
""" % ZONAS


def normalizar(html):
    """Whitespace estável, para o --verificar não dar falsos positivos."""
    return re.sub(r'\s+', ' ', html).strip()


# ---------------------------------------------------------------- dados estruturados
SITE = 'https://artstampcreations.pt'

# Constantes que não vivem no backoffice (são técnicas, o cliente não lhes mexe).
# geo: geocodificação da Av. Abade de Tagilde, Vizela (OpenStreetMap). É a rua
# certa no concelho certo, com precisão de rua — SUBSTITUIR pelas coordenadas
# exatas do pin do Google Business Profile assim que existir.
GEO = {'latitude': 41.376437, 'longitude': -8.305932}
NIF = 'PT248790226'
# Concelhos de onde a loja recebe clientes. Não inflacionar: listar dezenas de
# localidades é doorway content e o Google penaliza.
AREA = ['Vizela', 'Guimarães', 'Felgueiras', 'Lousada', 'Santo Tirso', 'Fafe']


def construir_jsonld(raiz):
    """Gera o JSON-LD a partir de data/*.json, para nunca ficar dessincronizado
    do que o cliente edita no backoffice (telefone, morada, serviços, FAQ)."""
    import json as _json

    def carregar(nome):
        with open(os.path.join(raiz, 'data', nome), encoding='utf-8') as f:
            return _json.load(f)

    site = carregar('site.json')
    servicos = carregar('services.json')
    faq = carregar('faq.json')
    c = site.get('contacts', {})

    negocio = {
        '@type': ['LocalBusiness', 'Store'],
        '@id': SITE + '/#loja',
        'name': 'Art Stamp Creations',
        'alternateName': ['ArtStamp', 'Art Stamp', 'ArtStamp Creations'],
        'description': ('Estampagem e personalização de t-shirts, sweats, fardas, '
                        'canecas, brindes, autocolantes, vinil e lonas, em Vizela.'),
        'url': SITE + '/',
        'logo': SITE + '/assets/img/logo.webp',
        'image': SITE + '/assets/img/og.jpg',
        'telephone': '+' + c.get('phone_intl', ''),
        'email': c.get('email', ''),
        'vatID': NIF,
        'priceRange': '€€',
        'address': {
            '@type': 'PostalAddress',
            'streetAddress': c.get('address_line1', ''),
            'postalCode': (c.get('address_line2', '') + ' ').split(' ')[0],
            'addressLocality': ' '.join(c.get('address_line2', '').split(' ')[1:]) or 'Vizela',
            'addressRegion': 'Braga',
            'addressCountry': 'PT',
        },
        'geo': dict({'@type': 'GeoCoordinates'}, **GEO),
        'areaServed': [{'@type': 'City', 'name': n} for n in AREA],
        'sameAs': [u for u in [c.get('instagram_url')] if u],
        'hasOfferCatalog': {
            '@type': 'OfferCatalog',
            'name': 'Serviços de personalização e estampagem',
            'itemListElement': [
                {'@type': 'Offer',
                 'itemOffered': {'@type': 'Service', 'name': s['title'],
                                 'description': s.get('desc', '')}}
                for s in servicos.get('services', [])
            ],
        },
    }

    website = {
        '@type': 'WebSite',
        '@id': SITE + '/#site',
        'url': SITE + '/',
        'name': 'Art Stamp Creations',
        'inLanguage': 'pt-PT',
        'publisher': {'@id': SITE + '/#loja'},
        # sem SearchAction de propósito: o site não tem pesquisa, seria falso
    }

    perguntas = {
        '@type': 'FAQPage',
        '@id': SITE + '/#faq',
        'mainEntity': [
            {'@type': 'Question', 'name': q['q'],
             'acceptedAnswer': {'@type': 'Answer', 'text': q['a']}}
            for q in faq.get('items', [])
        ],
    }

    grafo = {'@context': 'https://schema.org', '@graph': [negocio, website]}
    if perguntas['mainEntity']:
        grafo['@graph'].append(perguntas)
    return '\n' + _json.dumps(grafo, ensure_ascii=False, indent=2) + '\n  '


def main():
    verificar = '--verificar' in sys.argv
    original = open(PAGINA, encoding='utf-8').read()

    em_falta = [z for z in ZONAS if '<!--pre:%s-->' % z not in original]
    if em_falta:
        print('ERRO: faltam marcadores no index.html: %s' % ', '.join(em_falta))
        return 2

    porta = porta_livre()
    srv = servir(porta)
    chrome = None
    try:
        chrome = Chrome(porta=porta_livre())
        # Janela fixa: a cor dos autocolantes, o nº de colunas da galeria e o
        # corte do "Ver mais" dependem todos da largura. Sem isto, a saída
        # mudava entre a minha máquina e a do GitHub, gerando commits de ruído
        # a cada execução.
        chrome.cmd('Emulation.setDeviceMetricsOverride', width=1280, height=900,
                   deviceScaleFactor=1, mobile=False)
        chrome.abrir('http://127.0.0.1:%d/' % porta, espera=2.5)
        import json as _json
        bruto = chrome.js(PREPARAR)
        if not bruto:
            print('ERRO: o Chrome não devolveu conteúdo')
            return 3
        zonas = _json.loads(bruto)
    finally:
        if chrome:
            chrome.fechar()
        srv.shutdown()

    novo = original
    resumo = []

    # dados estruturados, gerados a partir do que o cliente edita
    jsonld = construir_jsonld(RAIZ)
    pad_ld = re.compile(r'(<!--pre:jsonld-->).*?(<!--/pre:jsonld-->)', re.S)
    if pad_ld.search(novo):
        novo = pad_ld.sub(lambda m: m.group(1) + jsonld + m.group(2), novo, count=1)
        resumo.append('json-ld: %d KB' % (len(jsonld) // 1024))
    else:
        print('AVISO: marcador de json-ld em falta')

    for z in ZONAS:
        conteudo = zonas.get(z)
        if conteudo is None:
            print('AVISO: zona %s não veio do browser' % z)
            continue
        padrao = re.compile(r'(<!--pre:%s-->).*?(<!--/pre:%s-->)' % (z, z), re.S)
        if not padrao.search(novo):
            print('AVISO: marcador de %s desapareceu' % z)
            continue
        novo = padrao.sub(lambda m: m.group(1) + conteudo + m.group(2), novo, count=1)
        resumo.append('%s: %d KB' % (z, len(conteudo) // 1024))

    mudou = normalizar(novo) != normalizar(original)
    if verificar:
        print('HTML pré-renderizado está %s' % ('DESATUALIZADO' if mudou else 'em dia'))
        return 1 if mudou else 0

    if mudou:
        open(PAGINA, 'w', encoding='utf-8').write(novo)

    # quanto texto passou a ser visível sem JavaScript
    sem_js = re.sub(r'<script.*?</script>|<style.*?</style>', '', novo, flags=re.S)
    palavras = len(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', sem_js)).split())
    print('  ' + '\n  '.join(resumo))
    print('\n%s — %d palavras visíveis sem JavaScript'
          % ('index.html atualizado' if mudou else 'index.html já estava em dia', palavras))
    return 0


if __name__ == '__main__':
    sys.exit(main())
