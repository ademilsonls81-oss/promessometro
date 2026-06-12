import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMESSAS_DIR = join(__dirname, 'promessas');

// Find all md files
const files = globSync ? [] : [];
import { execSync } from 'child_process';
const result = execSync(`Get-ChildItem -Path "${PROMESSAS_DIR}" -Recurse -Filter "*.md" | Select-Object -ExpandProperty FullName`, {shell:'powershell'});
const lines = result.toString().trim().split('\n');

let fixed = 0;
for (const file of lines) {
  if (!file) continue;
  const content = readFileSync(file.trim(), 'utf-8');
  
  // Extract status from frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) continue;
  const fm = fmMatch[1];
  const statusLine = fm.split('\n').find(l => l.startsWith('status:'));
  if (!statusLine) continue;
  const statusVal = statusLine.replace('status:', '').trim().replace(/"/g, '');
  
  // Check if body table status matches frontmatter
  const bodyStatusRegex = /\*\*Status Atual\*\* \| .+/;
  if (!bodyStatusRegex.test(content)) continue;
  
  const newContent = content.replace(bodyStatusRegex, `**Status Atual** | ${statusVal}`);
  
  if (newContent !== content) {
    writeFileSync(file.trim(), newContent, 'utf-8');
    fixed++;
  }
}

console.log(`Fixed status in ${fixed} files`);
