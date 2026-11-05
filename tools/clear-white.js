// Deixa transparente o fundo branco de uma imagem de produto: pinta só o branco ligado às bordas
// (preenchimento a partir dos cantos), assim o branco dentro da arte do pacote continua lá.
// Usado por ja-set-art.js e zh-set-art.js. Recebe um Buffer de imagem e devolve um pipeline sharp com alfa.
const sharp = require('sharp');
module.exports = async function clearWhite(buf, limit = 238) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const seen = new Uint8Array(w * h), stack = [];
  const white = i => data[i * 4] >= limit && data[i * 4 + 1] >= limit && data[i * 4 + 2] >= limit || data[i * 4 + 3] < 16;
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !white(i)) continue;
    seen[i] = 1; data[i * 4 + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim();
};
