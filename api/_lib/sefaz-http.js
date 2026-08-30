// =====================================================================
//  Módulo compartilhado — chamada HTTPS com certificado cliente (mTLS)
// =====================================================================
const https = require('https');

// rejectUnauthorized: false é intencional — ver nota completa em
// fiscal-sefaz-status.js (Node não confia na raiz ICP-Brasil por padrão;
// a autenticação real desta chamada já é o mTLS, não a validação do
// certificado do servidor).
function chamarComCertificado(url, envelope, certPem, keyPem, soapActionUrl) {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ cert: certPem, key: keyPem, rejectUnauthorized: false });
    const body = Buffer.from(envelope, 'utf-8');
    const { hostname, pathname, search } = new URL(url);

    const req = https.request({
      hostname,
      path: pathname + search,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${soapActionUrl}"`,
        'Content-Length': body.length,
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('timeout', () => { req.destroy(new Error('Tempo esgotado ao conectar com a SEFAZ.')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extrairTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

module.exports = { chamarComCertificado, extrairTag };
