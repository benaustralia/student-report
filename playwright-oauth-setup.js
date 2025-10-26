/**
 * One-time OAuth login setup
 * This opens a browser where you manually login with Google OAuth
 * Then saves the authenticated session for automated tests
 * 
 * Run with: bun run oauth:setup
 */

const { chromium } = require('playwright');

const TEST_URL = process.env.TEST_URL || 'https://development--nsastudentreports.netlify.app';

async function setupOAuthSession() {
  console.log('🔐 OAuth Login Setup');
  console.log('📝 You will manually login with Google OAuth');
  console.log('💾 The session will be saved for automated tests\n');

  // Launch browser in headed mode with persistent context
  const userDataDir = './playwright-user-data';
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 720 }
  });

  const page = browser.pages()[0] || await browser.newPage();

  try {
    console.log('1️⃣ Opening app...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    
    console.log('\n✋ MANUAL STEP:');
    console.log('   1. Click "Sign in with Google"');
    console.log('   2. Complete the Google OAuth flow');
    console.log('   3. Wait until you see the authenticated app');
    console.log('   4. Press Enter in this terminal when done\n');
    
    // Wait for user to press Enter
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
    // Save the authentication state
    await page.context().storageState({ path: 'auth-state.json' });
    
    console.log('\n✅ Session saved to auth-state.json');
    console.log('🚀 You can now run automated tests with:');
    console.log('   bun run lighthouse:oauth');
    console.log('   bun run debug:oauth\n');
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

setupOAuthSession();

