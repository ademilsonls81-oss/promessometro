import pipelineHandler from './pipeline-orchestrator.js';

export default async function handler(req, res) {
  req.query = { ...req.query, secret: process.env.CRON_SECRET };
  return pipelineHandler(req, res);
}
