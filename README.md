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

## Publicar

O app fica em https://boosterz.web.app (Firebase Hosting, site `boosterz` do projeto `fichario-4d2a8`). O endereço antigo do GitHub Pages redireciona para lá.

1. `node tools/stamp-version.js` (nova versão dos arquivos e do cache)
2. `npx firebase-tools deploy --only hosting` (no PowerShell, `npx.cmd`)
3. `git push` (mantém o repositório e o redirecionamento do endereço antigo)

As regras do Firestore ficam em `firestore.rules`: `npx firebase-tools deploy --only firestore:rules`.

Fotos aprovadas pela comunidade: `node tools/bake-photos.js .` (com sharp) e depois `node tools/update-index.js data catalog` para o scanner.

## Fontes

Cartas e preços: API pública TCGdex (TCGplayer e Cardmarket). Câmbio: Frankfurter. Leitura de texto: Tesseract.js. Projeto pessoal, sem vínculo com The Pokémon Company ou Nintendo.
