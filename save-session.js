import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Saving your authentication session...');
  
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
  
  console.log('⏳ Please log in manually in the browser window...');
  console.log('⏳ After logging in successfully, press Enter in this terminal to save the session...');
  
  // Wait for user to press Enter after manual login
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  // Save the authentication state
  await context.storageState({ path: 'auth.json' });
  console.log('✅ Authentication state saved to auth.json');
  
  await browser.close();
  console.log('🎉 Setup complete! You can now run tests with saved authentication.');
})();
