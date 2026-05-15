import pipelineHandler from './pipeline-orchestrator.js';

export default async function handler(req, res) {
  // Allow manual trigger
  req.query = { ...req.query, stage: 'all', manual: 'true' };
  
  console.log('[TestRun] Manually triggering pipeline-orchestrator');
  
  try {
    // Override the response to capture what would be sent
    const originalJson = res.json;
    const originalStatus = res.status;
    let captureStatus = 200;
    let captureBody = null;

    res.status = (s) => { captureStatus = s; return res; };
    res.json = (b) => { captureBody = b; return originalJson.call(res, b); };

    await pipelineHandler(req, res);

    return res.status(captureStatus).json({
      test_run: true,
      result: captureBody,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
