const https = require('https');

async function main() {
  const res = await fetch('https://udhiyya-tzjh.vercel.app/');
  const html = await res.text();
  console.log('Vercel HTML length:', html.length);
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!match) {
    console.log('No index bundle match found in HTML.');
    return;
  }
  const jsUrl = 'https://udhiyya-tzjh.vercel.app' + match[1];
  console.log('Downloading deployed bundle:', jsUrl);
  const jsRes = await fetch(jsUrl);
  const jsText = await jsRes.text();
  console.log('Bundle length:', jsText.length);

  // Look for API_BASE or backend endpoints
  const matches = jsText.match(/https?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9_.-]*)*/g) || [];
  const interesting = [...new Set(matches)].filter(u => 
    !u.includes('w3.org') && 
    !u.includes('github') && 
    !u.includes('fonts.') &&
    !u.includes('vitejs')
  );
  console.log('Configured backend/external URLs in deployed bundle:', interesting);

  // Check if localhost:3000 is compiled in
  const hasLocalhost = jsText.includes('localhost:3000');
  console.log('Has localhost:3000 in bundle?', hasLocalhost);

  // Check auth provider in bundle
  const authModes = [];
  if (jsText.includes('VITE_AUTH_PROVIDER')) authModes.push('VITE_AUTH_PROVIDER present');
  if (jsText.includes('"nestjs"')) authModes.push('nestjs mode');
  if (jsText.includes('"supabase"')) authModes.push('supabase mode');
  console.log('Auth flags in bundle:', authModes);
}

main().catch(console.error);
