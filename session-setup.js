import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Starting session setup with built-in stealth mode...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Inject stealth JavaScript to avoid detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Remove automation indicators
    delete window.chrome;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    
    // Add realistic properties
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
  
  console.log('📱 Navigate to your app...');
  await page.goto('http://localhost:5173/');
  
  console.log('⏳ Please log in manually in the browser window...');
  console.log('⏳ After logging in successfully, press Enter in this terminal...');
  
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
