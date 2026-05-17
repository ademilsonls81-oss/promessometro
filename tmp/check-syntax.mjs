import fs from 'fs';
const c = fs.readFileSync('api/index.js', 'utf8');
// Replace imports and export to check syntax
try {
  const cleaned = c
    .replace(/import\s+.*?from\s+['"].*?['"]\s*;?\s*/g, '//import\n')
    .replace(/export\s+default\s+async\s+function\s+handler/, 'async function __handler');
  new Function(cleaned);
  console.log('SYNTAX OK');
} catch(e) {
  console.log('SYNTAX ERROR:', e.message.slice(0, 200));
  // Find line number
  const lines = c.split('\n');
  const m = e.message.match(/position\s+(\d+)/);
  if (m) {
    const pos = parseInt(m[1]);
    let line = 1;
    for (let i = 0; i < pos && i < c.length; i++) {
      if (c[i] === '\n') line++;
    }
    console.log('Near line:', line);
    console.log('Content:', lines[line-1]?.trim());
  }
}
