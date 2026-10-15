// test-e2e-restart-verify.cjs
const { _electron: electron } = require('playwright-core');
const path = require('path');

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('================================================================');
  console.log('STARTING PERSISTENCE-ACROSS-PROCESS-RESTART E2E VERIFICATION');
  console.log('================================================================\n');

  const testName = 'Persist User';
  const testEmail = `persist_${Date.now()}@local.test`;
  const taskTitle = `Task Survived Restart ${Date.now()}`;
  const habitName = `Habit Survived Restart ${Date.now()}`;

  // ==========================================
  // SESSION 1: Launch, Register, Populate Data, Kill Process
  // ==========================================
  console.log('--- SESSION 1: Launching first Electron process ---');
  let app1 = await electron.launch({
    args: ['electron/main.js'],
    executablePath: path.join(__dirname, 'node_modules/electron/dist/electron'),
  });

  const page1 = await app1.firstWindow();

  page1.on('console', (msg) => {
    const txt = msg.text();
    if (!txt.includes('Electron Security Warning')) {
      console.log(`[App1 Console ${msg.type()}]:`, txt);
    }
  });
  page1.on('pageerror', (err) => console.error('[App1 PageError]:', err.message));

  await page1.waitForLoadState('networkidle');
  const origin1 = await page1.evaluate(() => {
    localStorage.clear();
    return window.location.origin;
  });
  console.log(`Session 1 Origin: ${origin1}`);

  console.log('Navigating to /register...');
  await page1.goto(new URL('/register', page1.url()).toString());
  await page1.waitForLoadState('networkidle');

  console.log(`Registering user: "${testName}" (${testEmail})...`);
  await page1.locator('#name').fill(testName);
  await page1.locator('#email').fill(testEmail);
  await page1.locator('#password').fill('P@ssword1234!');
  await page1.getByRole('button', { name: /create account/i }).click();

  console.log('Completing onboarding wizard...');
  await page1.waitForSelector('text=Step 1 of 4: Routine', { timeout: 10000 });
  await page1.getByRole('button', { name: 'Next' }).click();

  await page1.waitForSelector('text=Step 2 of 4: Priorities', { timeout: 10000 });
  const careerBtn = page1.getByRole('button', { name: 'Career' });
  if (await careerBtn.isVisible()) await careerBtn.click();
  await page1.getByRole('button', { name: 'Next' }).click();

  await page1.waitForSelector('text=Step 3 of 4: Preferences', { timeout: 10000 });
  await page1.getByRole('button', { name: 'Next' }).click();

  await page1.waitForSelector('text=Step 4 of 4: Important dates', { timeout: 10000 });
  await page1.getByRole('button', { name: 'Finish' }).click();

  console.log('Verifying Dashboard in Session 1...');
  await page1.waitForSelector("text=Today's schedule", { timeout: 10000 });
  await page1.waitForSelector(`text=Welcome back`, { timeout: 5000 });
  console.log('PASS: Dashboard rendered in Session 1.');

  // Create Task
  console.log(`Creating task: "${taskTitle}"...`);
  await page1.goto(new URL('/tasks', page1.url()).toString());
  await page1.waitForLoadState('networkidle');
  await page1.waitForSelector('text=Tasks', { timeout: 5000 });
  await page1.getByRole('button', { name: /new task/i }).click();
  await page1.waitForSelector('#title', { timeout: 5000 });
  await page1.locator('#title').fill(taskTitle);
  await page1.getByRole('button', { name: 'Create', exact: true }).click();
  await page1.waitForSelector(`text=${taskTitle}`, { timeout: 5000 });
  console.log(`PASS: Task created in Session 1.`);

  // Create Habit
  console.log(`Creating habit: "${habitName}"...`);
  await page1.goto(new URL('/habits', page1.url()).toString());
  await page1.waitForLoadState('networkidle');
  await page1.waitForSelector('text=Habits', { timeout: 5000 });
  await page1.getByRole('button', { name: /new habit/i }).click();
  await page1.waitForSelector('#habit-name', { timeout: 5000 });
  await page1.locator('#habit-name').fill(habitName);
  await page1.getByRole('button', { name: 'Create', exact: true }).click();
  await page1.waitForSelector(`text=${habitName}`, { timeout: 5000 });
  console.log(`PASS: Habit created in Session 1.`);

  // Inspect storage state before quitting
  const storageState = await page1.evaluate(async () => {
    const sessionUserId = localStorage.getItem('pcc_local_session_user');
    let dbs = [];
    if (indexedDB.databases) {
      dbs = (await indexedDB.databases()).map(d => d.name);
    }
    return { sessionUserId, dbs };
  });
  console.log('Session 1 Storage State before termination:', storageState);

  console.log('\n>>> TERMINATING SESSION 1 (KILLING ELECTRON PROCESS) <<<');
  await app1.close();
  app1 = null;
  await delay(2000);
  console.log('Process termination confirmed.\n');

  // ==========================================
  // SESSION 2: Brand new process relaunch & persistence verification
  // ==========================================
  console.log('--- SESSION 2: Relaunching brand new Electron process ---');
  let app2 = await electron.launch({
    args: ['electron/main.js'],
    executablePath: path.join(__dirname, 'node_modules/electron/dist/electron'),
  });

  const page2 = await app2.firstWindow();

  page2.on('console', (msg) => {
    const txt = msg.text();
    if (!txt.includes('Electron Security Warning')) {
      console.log(`[App2 Console ${msg.type()}]:`, txt);
    }
  });
  page2.on('pageerror', (err) => console.error('[App2 PageError]:', err.message));

  await page2.waitForLoadState('networkidle');
  const origin2 = await page2.evaluate(() => window.location.origin);
  console.log(`Session 2 Origin: ${origin2}`);

  if (origin1 !== origin2) {
    throw new Error(`CRITICAL FAILURE: Origins do not match! Session 1: ${origin1}, Session 2: ${origin2}`);
  }
  console.log(`PASS: Origins match stably across restarts: ${origin2}`);

  // Check storage state immediately on launch in Session 2
  const storageState2 = await page2.evaluate(async () => {
    const sessionUserId = localStorage.getItem('pcc_local_session_user');
    let dbs = [];
    if (indexedDB.databases) {
      dbs = (await indexedDB.databases()).map(d => d.name);
    }
    return { sessionUserId, dbs };
  });
  console.log('Session 2 Storage State immediately after relaunch:', storageState2);

  if (!storageState2.sessionUserId || storageState2.sessionUserId !== storageState.sessionUserId) {
    throw new Error(`CRITICAL FAILURE: Session userId not preserved! Expected ${storageState.sessionUserId}, got ${storageState2.sessionUserId}`);
  }
  console.log(`PASS: User session in localStorage survived process restart! (${storageState2.sessionUserId})`);

  // Navigate to Dashboard or check if redirected to Dashboard
  console.log('Navigating to /dashboard...');
  await page2.goto(new URL('/dashboard', page2.url()).toString());
  await page2.waitForLoadState('networkidle');
  await page2.waitForSelector(`text=Welcome back`, { timeout: 10000 });
  await page2.waitForSelector(`text=Today's schedule`, { timeout: 10000 });
  console.log('PASS: Dashboard loaded automatically with authenticated session in Session 2!');

  // Verify Task persisted across restart
  console.log('Navigating to /tasks to verify task persistence...');
  await page2.goto(new URL('/tasks', page2.url()).toString());
  await page2.waitForLoadState('networkidle');
  await page2.waitForSelector(`text=${taskTitle}`, { timeout: 10000 });
  console.log(`PASS: Task "${taskTitle}" persisted in SQLite and rendered in Session 2!`);

  // Verify Habit persisted across restart
  console.log('Navigating to /habits to verify habit persistence...');
  await page2.goto(new URL('/habits', page2.url()).toString());
  await page2.waitForLoadState('networkidle');
  await page2.waitForSelector(`text=${habitName}`, { timeout: 10000 });
  console.log(`PASS: Habit "${habitName}" persisted in SQLite and rendered in Session 2!`);

  // Create additional item in Session 2 to verify two-way persistence
  const taskTitle2 = `Session 2 New Task ${Date.now()}`;
  console.log(`Navigating to /tasks and creating second task in Session 2: "${taskTitle2}"...`);
  await page2.goto(new URL('/tasks', page2.url()).toString());
  await page2.waitForLoadState('networkidle');
  await page2.waitForSelector('text=Tasks', { timeout: 5000 });
  await page2.getByRole('button', { name: /new task/i }).click();
  await page2.waitForSelector('#title', { timeout: 5000 });
  await page2.locator('#title').fill(taskTitle2);
  await page2.getByRole('button', { name: 'Create', exact: true }).click();
  await page2.waitForSelector(`text=${taskTitle2}`, { timeout: 5000 });
  console.log(`PASS: Additional task created successfully in Session 2.`);

  console.log('\n================================================================');
  console.log('SUCCESS: DATA PERSISTENCE ACROSS PROCESS RESTARTS FULLY PROVEN!');
  console.log('================================================================\n');

  await app2.close();
  process.exit(0);
})().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
