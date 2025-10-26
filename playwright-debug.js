/**
 * Open authenticated app in Chromium for debugging
 * Run with: node playwright-debug.js
 * 
 * Prerequisites:
 * npm install -D playwright
 * 
 * Set environment variables:
 * export TEST_EMAIL="your-email@example.com"
 * export TEST_PASSWORD="your-password"
 */

const { chromium } = require('playwright');

const TEST_URL = process.env.TEST_URL || 'https://development--nsastudentreports.netlify.app';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

async function openAuthenticatedApp() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.error('❌ Error: TEST_EMAIL and TEST_PASSWORD environment variables are required');
    console.log('\nUsage:');
    console.log('  export TEST_EMAIL="your-email@example.com"');
    console.log('  export TEST_PASSWORD="your-password"');
    console.log('  node playwright-debug.js');
    process.exit(1);
  }

  console.log('🚀 Opening authenticated app in Chromium...');
  console.log(`📧 Email: ${TEST_EMAIL}`);
  console.log(`🌐 URL: ${TEST_URL}`);

  // Launch browser in headed mode (visible)
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true // Open DevTools automatically
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();

  try {
    console.log('\n1️⃣ Navigating to app...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    
    console.log('2️⃣ Waiting for login form...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    console.log('3️⃣ Filling credentials...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    console.log('4️⃣ Clicking login...');
    await page.click('button[type="submit"]');
    
    console.log('5️⃣ Waiting for authentication...');
    await page.waitForTimeout(5000); // Wait for Firebase auth
    
    console.log('\n✅ Authenticated! Browser will stay open for debugging.');
    console.log('💡 You can now:');
    console.log('   - Run Lighthouse from DevTools (Lighthouse tab)');
    console.log('   - Check Performance tab');
    console.log('   - Inspect Network requests');
    console.log('   - Check Console for errors');
    console.log('\n⚠️  Press Ctrl+C to close the browser when done.\n');
    
    // Keep the browser open until manually closed
    await page.waitForTimeout(3600000); // 1 hour timeout
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

openAuthenticatedApp();

