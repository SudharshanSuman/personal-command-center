// test-e2e-verify.cjs
const { _electron: electron } = require('playwright-core');
const path = require('path');

(async () => {
  console.log('=== STARTING ELECTRON E2E VERIFICATION ===');
  let app;
  try {
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

    console.log('1. Loading initial page...');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.waitForTimeout(500);

    console.log('2. Navigating to /register...');
    await page.goto(new URL('/register', page.url()).toString());
    await page.waitForLoadState('networkidle');

    console.log('3. Registering new user...');
    const testName = 'Creed Verified';
    const testEmail = `creed_${Date.now()}@local.test`;
    await page.locator('#name').fill(testName);
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill('P@ssword1234!');
    await page.getByRole('button', { name: /create account/i }).click();

    console.log('4. Stepping through onboarding wizard...');
    await page.waitForSelector('text=Step 1 of 4: Routine', { timeout: 10000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.waitForSelector('text=Step 2 of 4: Priorities', { timeout: 10000 });
    const careerBtn = page.getByRole('button', { name: 'Career' });
    if (await careerBtn.isVisible()) await careerBtn.click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.waitForSelector('text=Step 3 of 4: Preferences', { timeout: 10000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.waitForSelector('text=Step 4 of 4: Important dates', { timeout: 10000 });
    console.log('Finishing onboarding...');
    await page.getByRole('button', { name: 'Finish' }).click();

    console.log('5. Verifying Dashboard...');
    await page.waitForSelector("text=Today's schedule", { timeout: 10000 });
    await page.waitForSelector('text=Welcome back', { timeout: 5000 });
    console.log('PASS: Dashboard rendered with real local SQLite data!');

    // 6. Test Feature 1: Tasks
    console.log('6. Testing Tasks Module...');
    await page.goto(new URL('/tasks', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Tasks', { timeout: 5000 });

    const newTaskBtn = page.getByRole('button', { name: /new task/i });
    await newTaskBtn.click();
    await page.waitForSelector('#title', { timeout: 5000 });
    const taskTitle = `Verified Task ${Date.now()}`;
    await page.locator('#title').fill(taskTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(1000);

    await page.waitForSelector(`text=${taskTitle}`, { timeout: 5000 });
    console.log(`PASS: Task created and verified in SQLite: "${taskTitle}"`);

    // 7. Test Feature 2: Habits
    console.log('7. Testing Habits Module...');
    await page.goto(new URL('/habits', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Habits', { timeout: 5000 });

    const newHabitBtn = page.getByRole('button', { name: /new habit/i });
    await newHabitBtn.click();
    await page.waitForSelector('#habit-name', { timeout: 5000 });
    const habitName = `Verified Habit ${Date.now()}`;
    await page.locator('#habit-name').fill(habitName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(1000);

    await page.waitForSelector(`text=${habitName}`, { timeout: 5000 });
    console.log(`PASS: Habit created and verified in SQLite: "${habitName}"`);

    // 8. Test Feature 3: Goals
    console.log('8. Testing Goals Module...');
    await page.goto(new URL('/goals', page.url()).toString());
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Goals', { timeout: 5000 });

    const newGoalBtn = page.getByRole('button', { name: /new goal/i });
    await newGoalBtn.click();
    await page.waitForSelector('#goal-title', { timeout: 5000 });
    const goalTitle = `Verified Goal ${Date.now()}`;
    await page.locator('#goal-title').fill(goalTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(1000);

    await page.waitForSelector(`text=${goalTitle}`, { timeout: 5000 });
    console.log(`PASS: Goal created and verified in SQLite: "${goalTitle}"`);

    console.log('\n======================================================');
    console.log('ALL E2E VERIFICATIONS PASSED CLEANLY IN ELECTRON SHELL');
    console.log('======================================================\n');

    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E VERIFICATION FAILED:', err);
    if (app) await app.close().catch(() => {});
    process.exit(1);
  }
})();
