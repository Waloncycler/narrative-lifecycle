import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

(async () => {
  console.log('[1/5] Launching browser to fetch REAL Tabbit download...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  console.log('[2/5] Navigating to download page...');
  await page.goto('https://www.tabbit.ai/download', { waitUntil: 'networkidle' });

  // Look for download buttons
  console.log('[3/5] Triggering download...');
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  
  // Try to find the Mac download link
  const macLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const dmgLink = links.find(a => a.href && a.href.includes('.dmg'));
    return dmgLink ? dmgLink.href : null;
  });

  if (macLink) {
    console.log('Found direct DMG link:', macLink);
    await page.goto(macLink);
  } else {
    // Click any button containing 'macOS' or 'Mac' or 'Apple'
    try {
      await page.getByText(/macOS|Apple Silicon|Apple Intel|Download for Mac/i).first().click();
    } catch(e) {
      console.log('Could not find standard download button, trying alternative layout...');
      await page.locator('button, a').filter({ hasText: /Mac/i }).first().click();
    }
  }

  const download = await downloadPromise;
  const savePath = path.join(process.cwd(), 'Tabbit.dmg');
  console.log(`[4/5] Downloading Tabbit Installer to ${savePath}... (this may take a minute)`);
  await download.saveAs(savePath);
  console.log('Download complete!');

  await browser.close();

  // Now install it
  console.log('[5/5] Mounting and installing Tabbit...');
  try {
    // Mount DMG
    console.log('Mounting DMG...');
    const mountOutput = execSync(`hdiutil attach "${savePath}" -nobrowse`).toString();
    const volumeMatch = mountOutput.match(/(\/Volumes\/[^ \n]+)/);
    if (!volumeMatch) {
      throw new Error('Could not find mounted volume path in hdiutil output.');
    }
    const volumePath = volumeMatch[1];
    console.log(`Mounted at ${volumePath}`);

    // Copy App
    console.log('Copying to /Applications...');
    execSync(`cp -R "${volumePath}"/*.app /Applications/`);

    // Unmount
    console.log('Unmounting DMG...');
    execSync(`hdiutil detach "${volumePath}"`);

    // Remove quarantine so it opens without prompting
    console.log('Removing Apple Quarantine attr...');
    execSync(`xattr -dr com.apple.quarantine /Applications/Tabbit.app || true`);

    console.log('\\n✅ Real Tabbit Browser successfully installed to /Applications/Tabbit.app!');
  } catch (err) {
    console.error('Installation failed:', err);
  }
})().catch(err => {
  console.error('Error fetching Tabbit:', err);
  process.exit(1);
});
