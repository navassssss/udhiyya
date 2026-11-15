async function main() {
  const origin = 'https://udhiyya-tzjh.vercel.app';
  console.log(`Testing Render API from origin: ${origin}...`);

  try {
    const health = await fetch('https://udhiyya-api.onrender.com/api/v1/health');
    console.log('Health status:', health.status, await health.text());
  } catch (e) {
    console.error('Health request failed:', e.message);
  }

  try {
    const optionsRes = await fetch('https://udhiyya-api.onrender.com/api/v1/auth/email/login', {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    console.log('CORS Preflight Status:', optionsRes.status);
    console.log('Access-Control-Allow-Origin:', optionsRes.headers.get('access-control-allow-origin'));
    console.log('Access-Control-Allow-Credentials:', optionsRes.headers.get('access-control-allow-credentials'));
    console.log('Access-Control-Allow-Headers:', optionsRes.headers.get('access-control-allow-headers'));
  } catch (e) {
    console.error('CORS preflight request failed:', e.message);
  }
}

main().catch(console.error);
