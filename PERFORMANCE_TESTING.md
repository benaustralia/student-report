# Performance Testing with Authentication

This project includes automated tools to test the authenticated app's performance using Playwright and Lighthouse.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your test credentials:**
   ```bash
   export TEST_EMAIL="your-email@example.com"
   export TEST_PASSWORD="your-password"
   ```

   Or create a `.env.local` file (don't commit this!):
   ```
   TEST_EMAIL=your-email@example.com
   TEST_PASSWORD=your-password
   ```

## Option 1: Interactive Debugging (Recommended)

Opens Chromium with DevTools so you can manually run Lighthouse and inspect performance:

```bash
npm run debug:auth
```

**What it does:**
- Launches visible Chromium browser
- Logs you in automatically
- Opens DevTools
- Keeps browser open for manual testing

**Then you can:**
- Click the Lighthouse tab in DevTools
- Run Lighthouse manually
- Check Performance tab
- Inspect Network requests
- Debug layout shifts in real-time

## Option 2: Automated Lighthouse Test

Runs a full Lighthouse audit and saves the report:

```bash
npm run lighthouse:auth
```

**What it does:**
- Logs in with Playwright
- Runs Lighthouse on authenticated app
- Saves HTML and JSON reports
- Prints key metrics to console

**Output:**
- `lighthouse-authenticated-YYYY-MM-DD.html` - Visual report
- `lighthouse-authenticated-YYYY-MM-DD.json` - Full data

## Testing Different Environments

**Development:**
```bash
export TEST_URL="https://development--nsastudentreports.netlify.app"
npm run debug:auth
```

**Production:**
```bash
export TEST_URL="https://nsastudentreports.netlify.app"
npm run debug:auth
```

**Local:**
```bash
export TEST_URL="http://localhost:5173"
npm run debug:auth
```

## Tips

1. **Use Option 1 (debug:auth) first** - It's easier to see what's happening
2. **Run multiple times** - Performance can vary, average 3-5 runs
3. **Clear cache between runs** - For consistent results
4. **Check CLS in real-time** - DevTools → Performance → Experience section
5. **Use Performance Insights** - DevTools → Lighthouse → View Trace

## Troubleshooting

**"TEST_EMAIL and TEST_PASSWORD environment variables are required"**
- Make sure you've exported the variables in your current terminal session

**"Timeout waiting for login"**
- Check that your credentials are correct
- Increase timeout in the script if needed
- Check if the app is accessible

**"Browser closes immediately"**
- For `debug:auth`, press Ctrl+C to close when done
- For `lighthouse:auth`, it closes automatically after generating report

## Security Note

⚠️ **Never commit credentials!**
- Don't add `.env.local` to git
- Don't hardcode passwords in scripts
- Use test accounts, not production accounts

