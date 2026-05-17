import { runAudit } from '../lib/metodologiaAudit.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  try {
    const report = await runAudit({ fix: true });

    console.log(`[MetodologiaAudit] ${report.politicians_checked} políticos, ${report.total_issues} issues, ${report.fixed} corrigidos`);

    if (report.issues.length > 0) {
      console.log('[MetodologiaAudit] Issues:');
      report.issues.forEach(i => {
        console.log(`  ${i.politician_name}: ${i.issues.join(', ')} ${i.action ? '→ ' + i.action : ''}`);
      });
    }

    return res.json({
      status: 'ok',
      checked: report.politicians_checked,
      issues_found: report.total_issues,
      fixed: report.fixed,
      details: report.issues.slice(0, 50)
    });
  } catch (err) {
    console.error('[MetodologiaAudit] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}