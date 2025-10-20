import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Testing authentication with stealth mode...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Inject stealth JavaScript
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    delete window.chrome;
  });
  
  console.log('📱 Navigate to your app...');
  await page.goto('http://localhost:5173/');
  
  console.log('✅ Browser opened successfully!');
  console.log('🔍 Try logging in manually in the browser window...');
  
  // Keep the browser open for manual testing
  await page.waitForTimeout(30000); // Wait 30 seconds
  
  await browser.close();
})();
