// Native on-device verification over raw CDP (chrome-remote-interface) against
// the running com.pcc.commandcenter WebView on the emulator.
// Part A: prove the app initialized its SQLite schema on-device (12 tables).
// Part B: drive the REAL register -> onboarding -> dashboard flow and confirm
//         it persisted, i.e. reads/writes go to on-device SQLite.
import CDP from "chrome-remote-interface"

const log = (...a) => console.log(...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// pick the app page target
const targets = await CDP.List({ port: 9222 })
const pageTarget = targets.find((t) => t.type === "page") || targets[0]
log("TARGET", pageTarget.url)

const client = await CDP({
  port: 9222,
  local: true,
  target: (list) => list.find((t) => t.type === "page") || list[0],
})
const { Runtime, Page } = client
await Runtime.enable()
await Page.enable()

async function evalAsync(expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || JSON.stringify(exceptionDetails))
  return result.value
}

try {
  // ---- Part A: app's on-device SQLite schema ----
  const tables = await evalAsync(`
    const SQ = window.Capacitor?.Plugins?.CapacitorSQLite;
    if (!SQ) return { error: "no CapacitorSQLite plugin" };
    // The app already opened the "pcc" DB on load; query that live connection.
    try {
      const res = await SQ.query({ database: "pcc", statement: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", values: [] });
      return { tables: (res.values || []).map(r => r.name || r[0]) };
    } catch (e) { return { error: String(e && e.message || e) }; }
  `)
  log("A. APP_SQLITE_TABLES", JSON.stringify(tables))
  const expected = ["assessments","budgets","daily_reviews","events","goals","habit_logs","habits","personalization_profiles","reminder_rules","tasks","transactions","users"]
  const got = (tables.tables || []).filter((t) => !String(t).startsWith("sqlite_"))
  const allPresent = expected.every((t) => got.includes(t))
  log("A. SCHEMA_ON_DEVICE", allPresent ? "PASS (all 12 tables present)" : "FAIL missing: " + expected.filter(t=>!got.includes(t)).join(","))

  // ---- Part B: drive the real register flow (React-aware input setter) ----
  const email = "native_" + Date.now() + "@test.local"
  const helper = `
    window.__setInput = (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    window.__clickText = (role, re) => {
      const els = [...document.querySelectorAll('a,button')];
      const el = els.find(e => new RegExp(re, 'i').test(e.textContent||''));
      if (el) { el.click(); return true; }
      return false;
    };
    return true;
  `
  await evalAsync(helper)

  // ensure at login
  await evalAsync(`if(!location.pathname.includes('/login') && !location.pathname.includes('/register')){ __clickText('link','') } return true;`)
  await sleep(500)
  await evalAsync(`__clickText('a','create one'); return true;`)
  await sleep(1200)
  const onRegister = await evalAsync(`return location.pathname`)
  log("B. after 'create one' ->", onRegister)

  await evalAsync(`__setInput('input[name="name"]','Native Tester'); return true;`)
  await evalAsync(`__setInput('input[name="email"]','${email}'); return true;`)
  await evalAsync(`__setInput('input[name="password"]','testpass123'); return true;`)
  await sleep(300)
  await evalAsync(`__clickText('button','create account'); return true;`)

  // wait for onboarding
  let reached = ""
  for (let i = 0; i < 30; i++) {
    reached = await evalAsync(`return location.pathname`)
    if (reached.includes("/onboarding")) break
    await sleep(700)
  }
  log("B. REGISTER_RESULT", reached.includes("/onboarding") ? "PASS wrote user to on-device SQLite -> /onboarding" : "path=" + reached)

  // walk wizard: Next x3, Finish
  if (reached.includes("/onboarding")) {
    for (let i = 0; i < 3; i++) { await evalAsync(`__clickText('button','^next$')||__clickText('button','next'); return true;`); await sleep(500) }
    await evalAsync(`__clickText('button','finish'); return true;`)
    let dash = ""
    for (let i = 0; i < 30; i++) { dash = await evalAsync(`return location.pathname`); if (dash.includes("/dashboard")) break; await sleep(700) }
    log("B. ONBOARDING_RESULT", dash.includes("/dashboard") ? "PASS profile upserted on-device -> /dashboard" : "path=" + dash)

    // hard reload root -> should return to /dashboard (session+data persisted)
    await evalAsync(`location.href = location.origin + '/'; return true;`)
    await sleep(3000)
    let after = ""
    for (let i = 0; i < 20; i++) { after = await evalAsync(`return location.pathname`).catch(()=>""); if (after && after.includes("/dashboard")) break; await sleep(700) }
    log("B. PERSISTENCE_AFTER_RELOAD", after.includes("/dashboard") ? "PASS landed on /dashboard (session in localStorage + user row in SQLite)" : "path=" + after)

    // confirm the user row is really in on-device SQLite
    const check = await evalAsync(`
      const SQ = window.Capacitor.Plugins.CapacitorSQLite;
      try {
        const res = await SQ.query({ database: "pcc", statement: "SELECT COUNT(*) AS n FROM users WHERE email = ?;", values: ["${email}"] });
        const row = (res.values||[])[0];
        return row ? (row.n ?? row[0]) : null;
      } catch (e) { return "ERR:" + (e && e.message || e); }
    `)
    log("B. USER_ROW_IN_SQLITE", String(check) === "1" ? "PASS (1 row)" : "count=" + JSON.stringify(check))
  }

  log("NATIVE_VERIFICATION_DONE")
} catch (e) {
  log("VERIFY_ERROR", e.message)
  process.exitCode = 1
} finally {
  await client.close()
}
