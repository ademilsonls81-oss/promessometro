export default async function handler(req, res) {
  const path = req.url;
  const method = req.method;

  res.setHeader('Content-Type', 'application/json');

  if (path === '/api/health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  return res.status(404).json({ error: 'Endpoint não encontrado', path });
}
