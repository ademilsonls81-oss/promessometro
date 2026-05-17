import fs from 'fs';

let code = fs.readFileSync('api/index.js.backup', 'utf8');

// Remove old import pattern
code = code.replace(
  /^import \{ createClient \} from '@supabase\/supabase-js';\n\nconst supabaseUrl = .*\nconst supabaseKey = .*\nconst supabase = createClient\(.*\);/m,
  `import { createClient } from '@supabase/supabase-js';\n\nfunction db(type) {\n  const url = process.env.VITE_S_URL || 'https://liqutcjzzrqstivvfele.supabase.co';\n  const key = type === 'admin'\n    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5ODAzNiwiZXhwIjoyMDkxMDc0MDM2fQ.CEwxEeOB2CoAF0JyreovFYhU4Ibc03np8RgU6B6SiP0')\n    : (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis');\n  return createClient(url, key);\n}`
);

// Replace supabaseService = createClient( with db('admin')
code = code.replace(/const supabaseService = createClient\([^;]+\)/g, 'const supabaseService = db("admin")');

// Replace all other supabase. references with db(). references
// First handle cases where supabase is part of an expression
code = code.replace(/(?<![a-zA-Z_$])supabase\./g, 'db().');
// Fix double db() from previous patterns
code = code.replace(/const db\(\)\./g, '');

// Remove any stray 'const db();' lines
code = code.replace(/^const db\(\);/gm, '');

fs.writeFileSync('api/index.js', code, 'utf8');
console.log('Done! Size:', code.length, 'bytes');
