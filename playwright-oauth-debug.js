/**
 * Open authenticated app using saved OAuth session
 * Run with: bun run debug:oauth
 * 
 * Prerequisites:
 * 1. Run "bun run oauth:setup" first to save your session
 */

const { chromium } = require('playwright');
const fs = require('fs');

const TEST_URL = process.env.TEST_URL || 'https://development--nsastudentreports.netlify.app';

async function openAuthenticatedApp() {
  if (!fs.existsSync('auth-state.json')) {
    console.error('❌ Error: auth-state.json not found');
    console.log('\n📝 First, run the OAuth setup:');
    console.log('   bun run oauth:setup\n');
    process.exit(1);
  }

  console.log('🚀 Opening authenticated app with saved session...');
  console.log(`🌐 URL: ${TEST_URL}`);

  // Launch browser with saved authentication
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext({
    storageState: 'auth-state.json',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();

  try {
    console.log('\n1️⃣ Loading authenticated app...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    
    console.log('\n✅ Authenticated! Browser will stay open for debugging.');
    console.log('💡 You can now:');
    console.log('   - Run Lighthouse from DevTools (Lighthouse tab)');
    console.log('   - Check Performance tab');
    console.log('   - Inspect Network requests');
    console.log('   - Check Console for errors');
    console.log('\n⚠️  Press Ctrl+C to close the browser when done.\n');
    
    // Keep the browser open
    await page.waitForTimeout(3600000); // 1 hour
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Your session might have expired. Run:');
    console.log('   bun run oauth:setup\n');
    await browser.close();
    process.exit(1);
  }
}

openAuthenticatedApp();

