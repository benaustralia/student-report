/**
 * Lighthouse test with authentication
 * Run with: node lighthouse-auth.js
 * 
 * Prerequisites:
 * npm install -D playwright lighthouse chrome-launcher
 * 
 * Set environment variables:
 * export TEST_EMAIL="your-email@example.com"
 * export TEST_PASSWORD="your-password"
 */

const { chromium } = require('playwright');
const lighthouse = require('lighthouse');
const { launch } = require('chrome-launcher');
const fs = require('fs');

const TEST_URL = process.env.TEST_URL || 'https://development--nsastudentreports.netlify.app';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

async function runLighthouseWithAuth() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.error('❌ Error: TEST_EMAIL and TEST_PASSWORD environment variables are required');
    console.log('\nUsage:');
    console.log('  export TEST_EMAIL="your-email@example.com"');
    console.log('  export TEST_PASSWORD="your-password"');
    console.log('  node lighthouse-auth.js');
    process.exit(1);
  }

  console.log('🚀 Starting authenticated Lighthouse test...');
  console.log(`📧 Email: ${TEST_EMAIL}`);
  console.log(`🌐 URL: ${TEST_URL}`);

  // Step 1: Use Playwright to login and save cookies
  console.log('\n1️⃣ Logging in with Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    
    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Fill in credentials
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation to authenticated app
    await page.waitForURL(/.*/, { timeout: 15000 });
    await page.waitForTimeout(3000); // Give Firebase time to complete auth
    
    console.log('✅ Login successful!');
    
    // Save cookies for Lighthouse
    const cookies = await context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // Save storage state
    await context.storageState({ path: 'auth-state.json' });
    
    await browser.close();
    
    // Step 2: Run Lighthouse with authentication
    console.log('\n2️⃣ Running Lighthouse with authentication...');
    
    const chrome = await launch({
      chromeFlags: [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const options = {
      logLevel: 'info',
      output: 'html',
      onlyCategories: ['performance'],
      port: chrome.port,
      extraHeaders: {
        Cookie: cookieString
      }
    };
    
    const runnerResult = await lighthouse(TEST_URL, options);
    
    // Generate report
    const reportHtml = runnerResult.report;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `lighthouse-authenticated-${timestamp}.html`;
    
    fs.writeFileSync(filename, reportHtml);
    console.log(`\n✅ Report saved: ${filename}`);
    
    // Print key metrics
    const { categories, audits } = runnerResult.lhr;
    console.log('\n📊 Performance Metrics:');
    console.log(`  Performance Score: ${Math.round(categories.performance.score * 100)}%`);
    console.log(`  FCP: ${audits['first-contentful-paint'].displayValue}`);
    console.log(`  LCP: ${audits['largest-contentful-paint'].displayValue}`);
    console.log(`  TBT: ${audits['total-blocking-time'].displayValue}`);
    console.log(`  CLS: ${audits['cumulative-layout-shift'].displayValue}`);
    
    // Save JSON report
    const jsonFilename = `lighthouse-authenticated-${timestamp}.json`;
    fs.writeFileSync(jsonFilename, JSON.stringify(runnerResult.lhr, null, 2));
    console.log(`  JSON Report: ${jsonFilename}`);
    
    await chrome.kill();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

runLighthouseWithAuth();

