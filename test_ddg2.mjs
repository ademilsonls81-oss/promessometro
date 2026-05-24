const params = new URLSearchParams({ q: 'Tarcísio de Freitas SP' });
const res = await fetch('https://html.duckduckgo.com/html/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  body: params.toString()
});
const text = await res.text();

// Check if we got a CAPTCHA or block page
if (text.includes('captcha') || text.includes('verify') || text.includes('blocked')) {
  console.log('BLOCKED: CAPTCHA or block page detected');
} else if (text.includes('result__a')) {
  console.log('SUCCESS: Found results');
  // Extract first few
  const re = /result__a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m; let count = 0;
  while ((m = re.exec(text)) !== null && count < 3) {
    console.log(`  ${m[2].replace(/<[^>]+>/g,'').trim().substring(0,60)} | ${m[1].substring(0,60)}`);
    count++;
  }
} else {
  console.log('UNKNOWN: No recognizable elements');
  console.log('First 500 chars:', text.substring(0, 500));
}
