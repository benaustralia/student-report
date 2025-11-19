/**
 * Lighthouse test for local development
 * 
 * Usage:
 *   1. Build: bun run build
 *   2. Preview: bun run preview (in another terminal - note the port!)
 *   3. Run: bun run lighthouse
 * 
 * Or test dev server:
 *   1. Dev: bun run dev (in another terminal)
 *   2. Run: TEST_URL=http://localhost:5173 bun run lighthouse
 * 
 * If preview uses a different port (e.g., 4174), specify it:
 *   TEST_URL=http://localhost:4174 bun run lighthouse
 */

import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import fs from 'fs';

// Default to preview port, but check common ports if not specified
const getDefaultUrl = () => {
  if (process.env.TEST_URL) return process.env.TEST_URL;
  
  // Try common Vite preview ports (4173, 4174, 4175, etc.)
  const port = process.env.PORT || '4173';
  return `http://localhost:${port}`;
};

const TEST_URL = getDefaultUrl();
const CATEGORIES = process.env.CATEGORIES?.split(',') || ['performance', 'accessibility', 'best-practices', 'seo'];

async function runLighthouse() {
  console.log('🚀 Starting Lighthouse test...');
  console.log(`🌐 URL: ${TEST_URL}`);
  console.log(`📊 Categories: ${CATEGORIES.join(', ')}`);
  console.log(`💡 Tip: If preview is on a different port, use: TEST_URL=http://localhost:PORT bun run lighthouse\n`);

  const chrome = await launch({
    chromeFlags: [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  try {
    const options = {
      logLevel: 'info',
      output: ['html', 'json'],
      onlyCategories: CATEGORIES,
      port: chrome.port,
    };

    console.log('\n⏳ Running Lighthouse audit...');
    const runnerResult = await lighthouse(TEST_URL, options);

    // Generate report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const htmlFilename = `lighthouse-${timestamp}.html`;
    const jsonFilename = `lighthouse-${timestamp}.json`;

    fs.writeFileSync(htmlFilename, runnerResult.report[0]);
    fs.writeFileSync(jsonFilename, runnerResult.report[1]);
    
    console.log(`\n✅ Reports saved:`);
    console.log(`   HTML: ${htmlFilename}`);
    console.log(`   JSON: ${jsonFilename}`);

    // Print key metrics
    const { categories, audits } = runnerResult.lhr;
    console.log('\n📊 Lighthouse Scores:');
    
    Object.entries(categories).forEach(([key, category]) => {
      if (CATEGORIES.includes(key)) {
        const score = Math.round((category.score || 0) * 100);
        const emoji = score >= 90 ? '🟢' : score >= 50 ? '🟡' : '🔴';
        console.log(`   ${emoji} ${category.title}: ${score}%`);
      }
    });

    console.log('\n⚡ Performance Metrics:');
    console.log(`   FCP: ${audits['first-contentful-paint'].displayValue}`);
    console.log(`   LCP: ${audits['largest-contentful-paint'].displayValue}`);
    console.log(`   TBT: ${audits['total-blocking-time'].displayValue}`);
    console.log(`   CLS: ${audits['cumulative-layout-shift'].displayValue}`);
    console.log(`   Speed Index: ${audits['speed-index'].displayValue}`);

    await chrome.kill();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await chrome.kill();
    process.exit(1);
  }
}

runLighthouse();

