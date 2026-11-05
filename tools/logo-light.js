// Versão do logo para o modo claro (icons/logo-light.webp).
// Dentro do contorno do logo tudo fica como no original (inclusive o fundo escuro da faixa "TCG TRACKER"),
// pintado sobre o azul-escuro do app e opaco; do contorno para fora fica transparente, sem o halo cinza.
// "Fora" = o que se alcança a partir das bordas da imagem sem atravessar partes sólidas do logo.
// Uso, numa pasta com sharp instalado: node logo-light.js icons/logo.webp icons/logo-light.webp 200   (limiar usado: 200)
const sharp = require('sharp');
(async () => {
  const [src, out, cut = '110'] = process.argv.slice(2);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, CUT = +cut, BG = [8, 12, 27];
  const solid = i => data[i * 4 + 3] >= CUT;
  const outside = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || solid(i)) continue;
    outside[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    const p = i * 4, a = data[p + 3] / 255;
    for (let c = 0; c < 3; c++) data[p + c] = Math.round(data[p + c] * a + BG[c] * (1 - a));
    if (!outside[i]) { data[p + 3] = 255; continue; }
    // Borda: pixels de fora vizinhos do logo ficam meio transparentes, para o contorno não serrilhar.
    const x = i % w, y = (i / w) | 0;
    const near = (x > 0 && !outside[i - 1]) || (x < w - 1 && !outside[i + 1]) || (y > 0 && !outside[i - w]) || (y < h - 1 && !outside[i + w]);
    data[p + 3] = near ? Math.round(data[p + 3] * .6) : 0;
  }
  await sharp(data, { raw: info }).webp({ quality: 90, alphaQuality: 100 }).toFile(out);
})();
