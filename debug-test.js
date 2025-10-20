import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Starting debug test with error handling...');
  
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
  
  // Add error handling
  page.on('console', msg => {
    console.log('🔍 Console:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('❌ Page Error:', error.message);
  });
  
  try {
    console.log('📱 Navigate to your app...');
    await page.goto('http://localhost:5173/');
    
    console.log('✅ Browser opened successfully!');
    console.log('🔍 Please log in manually if needed...');
    console.log('🎯 Try opening classes and see if the browser stays open...');
    
    // Keep the browser open for longer testing
    await page.waitForTimeout(120000); // Wait 2 minutes for testing
    
  } catch (error) {
    console.log('❌ Error occurred:', error.message);
  } finally {
    await browser.close();
  }
})();
