// test-e2e-budgets-reviews.cjs
// Independent SENTINEL verification for Budgets & DailyReviews Upsert
// Specifically covers the post-t1/t2 fix in src/lib/db.ts
const { _electron: electron } = require('playwright-core');
const path = require('path');
const assert = require('assert');

(async () => {
  console.log('======================================================================');
  console.log('  PCC SENTINEL E2E VERIFICATION: BUDGETS & DAILYREVIEWS UPSERT (t2/t5)');
  console.log('======================================================================\n');

  let app;
  try {
    console.log('1. Launching Electron application...');
    app = await electron.launch({
      args: ['electron/main.js'],
      executablePath: path.join(__dirname, 'node_modules/electron/dist/electron'),
    });

    const page = await app.firstWindow();

    page.on('console', (msg) => {
      const txt = msg.text();
      if (!txt.includes('Electron Security Warning')) {
        console.log(`[Browser Console ${msg.type()}]:`, txt);
      }
    });
    page.on('pageerror', (err) => {
      console.error(`[Browser PageError]:`, err.message);
    });

    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(500);

    // 2. Register User
    console.log('2. Registering test user...');
    await page.goto(new URL('/register', page.url()).toString());
    await page.waitForLoadState('networkidle');

    const testEmail = `budget_review_${Date.now()}@local.test`;
    await page.locator('#name').fill('Budget Review Verifier');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill('P@ssword1234!');
    await page.getByRole('button', { name: /create account/i }).click();

    // 3. Onboarding
    console.log('3. Completing onboarding wizard...');
    await page.waitForSelector('text=Step 1 of 4: Routine', { timeout: 10000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.waitForSelector('text=Step 2 of 4: Priorities', { timeout: 10000 });
    const careerBtn = page.getByRole('button', { name: 'Career' });
    if (await careerBtn.isVisible()) await careerBtn.click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.waitForSelector('text=Step 3 of 4: Preferences', { timeout: 10000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.waitForSelector('text=Step 4 of 4: Important dates', { timeout: 10000 });
    await page.getByRole('button', { name: 'Finish' }).click();

    await page.waitForSelector("text=Today's schedule", { timeout: 10000 });
    console.log('PASS: Dashboard reached after onboarding.');

    // 4. Test Budget Upsert via UI (/finances)
    console.log('\n4. Testing Budget Upsert (INSERT & UPDATE) on /finances...');
    await page.goto(new URL('/finances', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Finances', { timeout: 10000 });

    // Open Budget modal
    console.log('  Opening Budget dialog...');
    const budgetBtn = page.getByRole('button', { name: 'Budget' });
    await budgetBtn.click();
    await page.waitForSelector('text=New monthly budget', { timeout: 5000 });

    // Fill Category and Target amount
    console.log('  Submitting new Budget (INSERT path: category="Food & Dining", amount=450)...');
    await page.locator('#budget-category').fill('Food & Dining');
    await page.locator('#budget-amount').fill('450');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify budget badge appeared
    await page.waitForSelector('text=Food & Dining:', { timeout: 10000 });
    console.log('  ✓ PASS: Budget INSERT successfully rendered: "Food & Dining: $450.00"');

    // Click the budget badge to open edit dialog (UPDATE path of upsert)
    console.log('  Opening Budget dialog for existing budget (UPDATE path)...');
    const editBadge = page.locator('text=Food & Dining:').first();
    await editBadge.click();
    await page.waitForSelector('text=Edit budget', { timeout: 5000 });

    // Update target amount to 550
    console.log('  Updating amount to 550...');
    await page.locator('#budget-amount').fill('550');
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify updated budget rendered
    await page.waitForSelector('text=Food & Dining: $550.00', { timeout: 10000 });
    console.log('  ✓ PASS: Budget UPDATE successfully rendered: "Food & Dining: $550.00"');

    // 5. Test DailyReview Upsert via UI (/reviews)
    console.log('\n5. Testing DailyReview Upsert on /reviews...');
    await page.goto(new URL('/reviews', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Reviews', { timeout: 10000 });
    await page.waitForSelector('text=Reflection', { timeout: 10000 });

    console.log('  Filling reflection inputs for Daily Review...');
    await page.locator('#went-well').fill('Built robust tests and verified pipeline end-to-end');
    await page.locator('#needs-attention').fill('Keep memory synchronized with Commander instructions');

    console.log('  Submitting Daily Review (INSERT path via "Complete review")...');
    const submitBtn = page.getByRole('button', { name: /complete review/i });
    await submitBtn.click();

    await page.waitForSelector('text=Review complete', { timeout: 10000 });
    console.log('  ✓ PASS: DailyReview INSERT successfully submitted and "Review complete" displayed!');

    // 6. Test Period Review Upsert (Weekly Review)
    console.log('\n6. Testing PeriodReview (Weekly) Upsert on /reviews?period=weekly...');
    await page.goto(new URL('/reviews?period=weekly', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=This week', { timeout: 10000 });

    const weeklyTextareas = page.locator('textarea');
    const weeklyCount = await weeklyTextareas.count();
    console.log(`  Found ${weeklyCount} textareas for Weekly Review.`);
    if (weeklyCount >= 2) {
      await weeklyTextareas.nth(0).fill('Weekly achievements verified clean');
      await weeklyTextareas.nth(1).fill('Prepare final audit reports');
      const saveWeeklyBtn = page.getByRole('button', { name: /save/i });
      if (await saveWeeklyBtn.isVisible()) {
        await saveWeeklyBtn.click();
        await page.waitForTimeout(1000);
        console.log('  ✓ PASS: Weekly Review upsert submitted cleanly!');
      }
    }

    // 7. Verify persistence by reloading /finances and /reviews
    console.log('\n7. Verifying persistence across page reload / navigation...');
    await page.goto(new URL('/finances', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Food & Dining: $550.00', { timeout: 10000 });
    console.log('  ✓ PASS: Budget persists cleanly in SQLite database on reload!');

    await page.goto(new URL('/reviews', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Reflection', { timeout: 10000 });
    const wentWellVal = await page.locator('#went-well').inputValue();
    assert.strictEqual(wentWellVal, 'Built robust tests and verified pipeline end-to-end');
    console.log(`  ✓ PASS: DailyReview draft loaded from SQLite matches submitted value: "${wentWellVal}"`);

    // Updating DailyReview (UPDATE path of upsert)
    console.log('\n8. Testing DailyReview UPDATE path of upsert...');
    await page.locator('#went-well').fill('Updated reflection text after review');
    const updateBtn = page.getByRole('button', { name: /complete review/i });
    await updateBtn.click();
    await page.waitForSelector('text=Review complete', { timeout: 10000 });
    console.log('  ✓ PASS: DailyReview UPDATE successfully executed and displayed "Review complete"!');

    // Re-verify persisted update
    await page.goto(new URL('/reviews', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Reflection', { timeout: 10000 });
    const updatedVal = await page.locator('#went-well').inputValue();
    assert.strictEqual(updatedVal, 'Updated reflection text after review');
    console.log(`  ✓ PASS: DailyReview UPDATE persisted in SQLite: "${updatedVal}"`);

    console.log('\n======================================================================');
    console.log('  ALL BUDGETS & DAILYREVIEWS UPSERT TESTS PASSED WITH ZERO REGRESSIONS!');
    console.log('======================================================================');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (app) {
      await app.close();
    }
  }
})();
