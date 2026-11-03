# Boosterz

App web (PWA) para colecionar Pokémon TCG: escaneia cartas, mostra preços e acompanha o progresso de cada set.

## Publicar

Qualquer hospedagem estática com HTTPS serve; a câmera do iPhone não funciona sem HTTPS. Publique o conteúdo desta pasta, por exemplo no GitHub Pages.

No iPhone: abra o link no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".

## Atualizar o banco de reconhecimento

`data/hashes.bin` e `data/index.json` são gerados uma vez. Cartas lançadas depois disso são reconhecidas só pelo número impresso ou pela Busca. Para incluir as novas, numa pasta com `sharp` instalado:

```bash
node build-thumbs.js
```

```bash
node export-index.js . caminho/para/fichario/data
```

Os dois scripts estão em `tools/`. O primeiro retoma de onde parou e baixa apenas as cartas que faltam.

## Fontes

Cartas e preços: API pública TCGdex (TCGplayer e Cardmarket). Câmbio: Frankfurter. Leitura de texto: Tesseract.js. Projeto pessoal, sem vínculo com The Pokémon Company ou Nintendo.
