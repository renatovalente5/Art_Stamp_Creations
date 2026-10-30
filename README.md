# ArtStampCreations — Website

Site institucional (montra + pedido de orçamento) da **ArtStampCreations**, personalização e estampagem (t-shirts, sweats, polos, bonés, canecas, autocolantes, DTF têxtil/UV, vinil, lonas e banners).

- **Stack:** site estático (HTML/CSS/JS), sem framework. Alojado em **GitHub Pages**.
- **Backoffice:** painel próprio em https://backoffice.artstampcreations.pt (repositório privado `renatovalente5/artstamp-painel`) — o cliente edita textos, fotografias, serviços, catálogos e galeria sem tocar em código, e cada «Gravar» é um commit no `main`. Ver `GUIA-BACKOFFICE.md`.
- **Guarda do conteúdo:** `.github/regras.mjs` (as regras do que pode ir para o site; o painel tem uma cópia byte a byte) e `.github/guardas.mjs` (o passo «Conferir o conteúdo» do `prerender.yml`). Baterias, em local: `node .github/test-guardas.mjs` e `node .github/test-app.mjs`.
- **Dados editáveis:** `data/*.json`.
- **Conteúdos:** cores/tipografia do logo da marca; fotos reais + modelos base THCLOTHES.

## Desenvolvimento local
```bash
python3 _source/dev-server.py    # http://localhost:8099
```

## Estrutura
- `index.html` — página principal
- `assets/` — css, js, imagens, fontes (self-hosted)
- `data/` — conteúdo editável (site, serviços, modelos, galeria)
- `legal/` — privacidade, termos, cookies
- `_source/` — materiais em bruto (catálogos/fotos do fornecedor); **não publicado**

> Este site não vende online (sem carrinho). Os pedidos são por WhatsApp/formulário.
