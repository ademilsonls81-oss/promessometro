const fs = require('fs');
const path = require('path');
const axios = require('axios');

const estados = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const PASTA_DESTINO = path.join(__dirname, 'storage');

if (!fs.existsSync(PASTA_DESTINO)) {
  fs.mkdirSync(PASTA_DESTINO, { recursive: true });
}

async function baixarPlanos() {
  let baixados = 0;
  let erros = 0;

  for (const uf of estados) {
    try {
      console.log(`\n🔍 ${uf} — buscando governador eleito...`);

      // 1. Listar candidatos
      const urlListar = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/2022/${uf}/2040602022/3/candidatos`;
      const r1 = await axios.get(urlListar, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });

      const vencedor = (r1.data?.candidatos || []).find(
        c => c.eleito === true || c.descricaoTotalizacao === "Eleito"
      );

      if (!vencedor) {
        console.log(`⚠️  Nenhum eleito encontrado em ${uf}`);
        erros++;
        continue;
      }

      console.log(`🟩 ${vencedor.nomeUrna} (ID: ${vencedor.id})`);

      // 2. Buscar detalhes para pegar o ID do plano de governo
      const urlDetalhes = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/2022/${uf}/2040602022/candidato/${vencedor.id}`;
      const r2 = await axios.get(urlDetalhes, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });

      const plan = (r2.data?.arquivos || []).find(a => a.codTipo === '5');
      if (!plan || !plan.idArquivo) {
        console.log(`⚠️  Plano de governo não disponível para ${vencedor.nomeUrna}`);
        erros++;
        continue;
      }

      console.log(`📄 Plano ID: ${plan.idArquivo}`);

      // 3. Baixar o PDF
      const urlPdf = `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/doc/${plan.idArquivo}`;
      const r3 = await axios({
        method: 'get',
        url: urlPdf,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        responseType: 'stream',
        timeout: 30000
      });

      const nomeArquivo = `${uf}_${vencedor.nomeUrna.replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '')}.pdf`;
      const writer = fs.createWriteStream(path.join(PASTA_DESTINO, nomeArquivo));
      r3.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const size = fs.statSync(path.join(PASTA_DESTINO, nomeArquivo)).size;
      console.log(`💾 Salvo: ${nomeArquivo} (${(size/1024).toFixed(0)} KB)`);
      baixados++;
    } catch (err) {
      console.error(`❌ Erro em ${uf}: ${err.message}`);
      erros++;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`\n📊 Resumo: ${baixados} PDFs baixados, ${erros} erros em ${estados.length} estados`);
}

baixarPlanos();
