// Versão do logo para o modo claro (icons/logo-light.webp). O original tem um halo escuro semitransparente que,
// sobre fundo claro, vira uma mancha cinza. Aqui o que é quase invisível some e o resto vira sólido sobre o
// azul-marinho do próprio logo, mantendo a faixa do "TCG TRACKER" e o contorno firmes.
// Uso, numa pasta com sharp instalado: node logo-light.js icons/logo.webp icons/logo-light.webp
const sharp = require('sharp');
(async () => {
  const [src, out] = process.argv.slice(2);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const NAVY = [11, 16, 38], CUT = 70;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < CUT) { data[i + 3] = 0; continue; }
    const k = a / 255;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * k + NAVY[c] * (1 - k));
    data[i + 3] = Math.min(255, Math.round((a - CUT) * 3));
  }
  await sharp(data, { raw: info }).webp({ quality: 90, alphaQuality: 100 }).toFile(out);
})();
