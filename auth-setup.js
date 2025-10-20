import { chromium } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';

// Use stealth plugin
chromium.use(StealthPlugin());

(async () => {
  console.log('🚀 Starting authentication setup with stealth mode...');
  
  // Launch browser in non-headless mode with stealth settings
  const browser = await chromium.launch({ 
    headless: false, // This is key - shows the browser window
    slowMo: 1000, // Slow down actions for easier interaction
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  
  const page = await context.newPage();
  
  // Remove webdriver property to avoid detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  console.log('📱 Navigate to your app...');
  await page.goto('http://localhost:5173/');

  console.log('⏳ Please log in manually in the browser window that opened...');
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
