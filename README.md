# ArtStampCreations — Website

Site institucional (montra + pedido de orçamento) da **ArtStampCreations**, personalização e estampagem (t-shirts, sweats, polos, bonés, canecas, autocolantes, DTF têxtil/UV, vinil, lonas e banners).

- **Stack:** site estático (HTML/CSS/JS), sem framework. Alojado em **GitHub Pages**.
- **Backoffice:** Pages CMS — o cliente edita textos, imagens, serviços, modelos e galeria sem tocar em código. Ver `GUIA-BACKOFFICE.md`.
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
