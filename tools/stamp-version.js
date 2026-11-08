// Carimba uma versão nova antes de publicar: o index.html passa a pedir styles.css?v=... e os scripts com a
// mesma versão, e o service worker troca o nome do cache. Assim o navegador nunca junta arquivos de versões diferentes.
// Uso: node tools/stamp-version.js   (a partir da pasta fichario)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const own = /(href|src)="((?:styles\.css|firebase-config\.js|app\.js|views\.js|desk\.js|sync\.js|social\.js|help\.js|access\.js|photos\.js|wish\.js|trades\.js|batch\.js|binders\.js|sealed\.js|share\.js))(?:\?v=\d+)?"/g;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(own, (_, attr, file) => `${attr}="${file}?v=${v}"`);
fs.writeFileSync(path.join(root, 'index.html'), html);
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').replace(/const SHELL = '[^']*'/, `const SHELL = 'boosterz-shell-${v}'`);
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log('versão', v);
