/* Browser checks for responsive play, circle geometry, command parity and keyboard editing.
 * npm test starts and stops a local PHP server. Microsoft Edge is the default browser.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const base = process.env.CODINGMAN_TEST_URL || "http://127.0.0.1:8766/games/codingmanremastered";
const artifacts = path.join(__dirname, "artifacts");
const viewports = [
    { width: 320, height: 480 }, { width: 390, height: 844 }, { width: 600, height: 360 },
    { width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }
];
let checks = 0;

function deterministicClock() {
    let now = 0, serial = 0, seed = 123456789;
    const timers = new Map();
    Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    function schedule(callback, delay, interval, args) {
        const id = ++serial;
        timers.set(id, { callback, time: now + delay, interval, args });
        return id;
    }
    window.setInterval = (callback, delay, ...args) => schedule(callback, delay, delay, args);
    window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, 0, args);
    window.clearInterval = window.clearTimeout = id => timers.delete(id);
    window.__periodicTimers = () => [...timers.values()].filter(timer => timer.interval).length;
    window.__advance = duration => {
        const end = now + duration;
        let calls = 0;
        while (true) {
            const entry = [...timers].filter(([, timer]) => timer.time <= end)
                .sort((a, b) => a[1].time - b[1].time || a[0] - b[0])[0];
            if (!entry) break;
            const [id, timer] = entry;
            now = timer.time;
            if (timer.interval) timer.time += timer.interval;
            else timers.delete(id);
            timer.callback(...timer.args);
            if (++calls > 500000) throw new Error("Unbounded timer loop");
        }
        now = end;
    };
}

function check(condition, message) { checks++; assert.ok(condition, message); }
function equal(actual, expected, message) { checks++; assert.deepStrictEqual(actual, expected, message); }
const stageFile = stage => `stage${stage}.${stage === 5 ? "php" : "html"}`;
const advance = (page, ms) => page.evaluate(ms => window.__advance(ms), ms);

async function open(browser, file, viewport = viewports[4]) {
    const page = await browser.newPage({ viewport });
    page.errors = [];
    page.on("pageerror", error => page.errors.push(error.message));
    await page.addInitScript(deterministicClock);
    await page.goto(`${base}/${file}`);
    await page.evaluate(() => document.fonts.ready);
    if (await page.locator("#start-battle").isVisible()) await page.locator("#start-battle").click();
    return page;
}

async function geometry(page) {
    return page.evaluate(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, x: r.x, y: r.y }; };
        return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            arena: document.getElementById("arena") ? rect(document.getElementById("arena")) : null,
            actors: [...document.querySelectorAll(".actor")].map(el => {
                const style = getComputedStyle(el);
                return { width: parseFloat(style.width), height: parseFloat(style.height), border: style.borderRadius };
            }),
            blocks: [...document.querySelectorAll(".code-palette .scratch-block")].map(el => ({
                rect: rect(el), path: el.querySelector("path")?.getAttribute("d"),
                shape: el.dataset.shape,
                key: el.querySelector("kbd")?.textContent, shortcut: el.getAttribute("aria-keyshortcuts"),
                labelWidth: el.querySelector(".block-label").scrollWidth,
                labelClient: el.querySelector(".block-label").clientWidth
            }))
        };
    });
}

async function state(page) {
    return page.evaluate(() => ({
        actors: ["char", "bug"].map(id => {
            const el = document.getElementById(id);
            return { left: el.style.left, top: el.style.top, direction: el.style.transform, display: el.style.display, small: el.classList.contains("is-small") };
        }),
        life: ["char_life", "bug_life"].map(id => document.getElementById(id).getAttribute("aria-valuenow")),
        effects: [...document.querySelectorAll(".effect")].map(el => ({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height, type: el.dataset.effect })),
        commands: [...document.querySelectorAll("button[data-action]")].map(el => [el.dataset.action, el.disabled]),
        messages: [...document.querySelectorAll(".code-log .block-label")].map(el => el.textContent),
        status: document.getElementById("game-status").textContent,
        hud: document.getElementById("mission-state")?.textContent,
        feedback: document.getElementById("mission-feedback")?.textContent
    }));
}

async function verifyLayouts(browser) {
    for (const viewport of viewports) {
        for (const file of ["mainpage.html", ...Array.from({ length: 11 }, (_, i) => stageFile(i)), "code5.html", "complete.html"]) {
            const page = await open(browser, file, viewport);
            const g = await geometry(page);
            check(g.overflow <= 1, `${file} overflows at ${viewport.width}x${viewport.height}: ${g.overflow}`);
            if (g.arena) {
                check(Math.abs(g.arena.width - g.arena.height) < .1, `${file}: arena must be square`);
                check(g.arena.x >= 0 && g.arena.x + g.arena.width <= viewport.width + 1, `${file}: arena must fit width`);
                for (const actor of g.actors) {
                    check(Math.abs(actor.width - actor.height) < .1, `${file}: actor must be a circle`);
                    equal(actor.border, "50%", `${file}: actor roundness`);
                }
            }
            for (const block of g.blocks) {
                check(Boolean(block.path?.includes("C 14 0") || block.path?.includes("C 20 -4") || ["reporter", "boolean"].includes(block.shape) && block.path?.endsWith("Z")), `${file}: SVG Scratch shape`);
                equal(block.key, block.shortcut, `${file}: visible key must match shortcut`);
                check(block.labelWidth <= block.labelClient + 1, `${file}: label must fit`);
            }
            equal(page.errors, [], `${file}: browser errors`);
            await page.close();
        }
        console.log(`Layouts: all 14 pages fit ${viewport.width}x${viewport.height}; arena and actors stay square.`);
    }
}

async function verifyCommands(browser) {
    for (let stage = 0; stage <= 10; stage++) {
        const keyboard = await open(browser, stageFile(stage));
        const mouse = await open(browser, stageFile(stage));
        const controls = await keyboard.locator("button[data-action]").evaluateAll(buttons => buttons.map(button => ({
            id: button.id, key: button.querySelector("kbd").textContent
        })));
        for (const { id, key } of controls) {
            await keyboard.keyboard.press(key);
            await mouse.locator(`#${id}`).click();
            equal(await state(keyboard), await state(mouse), `stage${stage}: ${id} mouse/keyboard parity`);
            if (await keyboard.locator(`#${id}`).isDisabled()) {
                const before = await state(keyboard);
                await keyboard.keyboard.press(key);
                equal(await state(keyboard), before, `stage${stage}: ${id} cooldown cannot be bypassed`);
            }
        }
        for (const code of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
            await keyboard.keyboard.press(code);
            await mouse.locator(`[data-move="${code}"]`).click();
            equal(await state(keyboard), await state(mouse), `stage${stage}: ${code} mouse/keyboard parity`);
        }
        for (const ms of [25, 1000, 2500, 12000]) {
            await Promise.all([advance(keyboard, ms), advance(mouse, ms)]);
            equal(await state(keyboard), await state(mouse), `stage${stage}: command timing parity after ${ms}ms`);
        }
        if (stage >= 2 && !(await keyboard.locator("#random").isDisabled())) {
            await keyboard.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR", key: "ㄱ", bubbles: true })));
            await mouse.locator("#random").click();
            equal(await state(keyboard), await state(mouse), `stage${stage}: physical keys also work with Korean layout`);
        }
        equal(keyboard.errors, [], `stage${stage}: keyboard errors`);
        equal(mouse.errors, [], `stage${stage}: mouse errors`);
        await keyboard.close();
        await mouse.close();
    }
    console.log("Commands: mouse/keyboard parity, cooldowns, physical keys, movement and AI passed for all stages.");
}

async function verifyResizeAndCollision(browser) {
    const page = await open(browser, "stage1.html");
    await page.keyboard.press("Space");
    await advance(page, 500);
    const before = await state(page);
    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        equal(await state(page), before, "live resize preserves normalized positions and projectiles");
        const g = await geometry(page);
        check(Math.abs(g.arena.width - g.arena.height) < .1, "live resize keeps arena square");
    }
    await advance(page, 600);
    equal((await state(page)).life, ["10", "9"], "a projectile hits the visible enemy after resize");
    await page.close();
    for (const viewport of [viewports[0], viewports[4], viewports[5]]) {
        const collision = await open(browser, "stage1.html", viewport);
        await collision.keyboard.press("f"); // This command is unavailable in stage 1; it must not corrupt direction.
        await collision.keyboard.press("Space");
        await advance(collision, 1100);
        equal((await state(collision)).life, ["10", "9"], "collision is independent of physical window size");
        await collision.close();
    }
    const small = await open(browser, "stage4.html");
    await small.keyboard.press("z");
    const g = await geometry(small);
    check(Math.abs(g.actors[0].width - g.actors[0].height) < .1, "shrink effect keeps a circle");
    await advance(small, 1000);
    check(!(await state(small)).actors[0].small, "shrink effect restores size");
    await small.keyboard.press("f");
    check(!(await state(small)).actors[0].direction.includes("NaN"), "pointing on a horizontal line gives a valid heading");
    await small.close();
    const narrow = await open(browser, "stage4.html", viewports[1]);
    await narrow.locator("#sound").click();
    const visibleArena = await narrow.locator("#arena").boundingBox();
    check(visibleArena.y >= 0 && visibleArena.y + visibleArena.height <= viewports[1].height, "narrow window keeps battle visible while clicking code");
    const scrollY = await narrow.evaluate(() => window.scrollY);
    await narrow.keyboard.press("Space");
    await narrow.keyboard.press("ArrowDown");
    equal(await narrow.evaluate(() => window.scrollY), scrollY, "game keys do not scroll the page");
    await narrow.close();
    console.log("Resize: active effects keep their positions; collisions match at small and large sizes.");
}

async function verifyLifecycle(browser) {
    for (let stage = 0; stage <= 10; stage++) {
        const page = await open(browser, stageFile(stage));
        for (let round = 0; round < 2; round++) {
            for (let tick = 0; tick < 400 && !(await page.locator("#game-status").textContent()); tick++) await advance(page, 300);
            check((await page.locator("#game-status").textContent()).includes("YOU LOSE"), `stage${stage}: combat reaches loss`);
            equal(await page.evaluate(() => window.__periodicTimers()), 0, "gameover stops all active intervals");
            await page.keyboard.press("Space");
            equal(await page.locator(".effect").count(), 0, "gameover rejects attacks");
            await page.keyboard.press("Enter");
            equal((await state(page)).life, ["10", String(({ 7: 12, 8: 14, 9: 14, 10: 18 })[stage] || 10)], "keyboard restart restores both health bars");
            if (stage >= 6) {
                equal(await page.locator("#mission-state").getAttribute("data-energy"), "0", "restart resets energy");
                equal(await page.locator("#mission-state").getAttribute("data-route"), "0", "restart resets route");
                equal(await page.locator("#mission-state").getAttribute("data-phase"), "1", "restart resets boss phase");
            }
            equal(await page.locator("#game-status").textContent(), "", "keyboard restart clears outcome");
            equal(await page.evaluate(() => window.__periodicTimers()), stage === 5 ? 2 : 1, "restart creates exactly one set of AI timers");
        }
        equal(page.errors, [], "lifecycle browser errors");
        await page.keyboard.press("Escape");
        await page.waitForURL("**/mainpage.html");
        await page.keyboard.press("Enter");
        await page.waitForURL("**/stage1.html");
        await page.close();
    }
    console.log("Lifecycle: combat, two keyboard restarts, timer cleanup and menu navigation passed.");
}

async function verifyAssembler(browser) {
    const page = await open(browser, "code5.html");
    await page.locator("#clear-code").click();
    for (const key of ["1", "a", "w", "y"]) await page.keyboard.press(key);
    equal(await page.locator(".assembled-block").count(), 4, "keyboard builds a nested repeat program");
    equal(await page.locator(".program-node:has(> .assembled-row [data-action='repeat']) > .program-sequence > .program-node").count(), 2, "repeat contains two instructions");
    await page.getByRole("spinbutton", { name: "걸음", exact: true }).fill("7");
    await page.getByRole("spinbutton", { name: "횟수", exact: true }).fill("2");
    await page.getByRole("spinbutton", { name: "초", exact: true }).fill("0.2");
    equal(await page.locator(".assembled-block").count(), 4, "editing fields does not trigger game keys");
    await page.reload();
    equal(await page.getByRole("spinbutton", { name: "걸음", exact: true }).inputValue(), "7", "draft values survive reload");
    const ids = await page.locator("[id]").evaluateAll(elements => elements.map(el => el.id));
    equal(ids.length, new Set(ids).size, "program nodes have unique IDs");
    await page.keyboard.press("Control+Enter");
    await page.waitForURL(url => url.pathname.endsWith("/stage5.html"));
    await advance(page, 1100);
    equal((await state(page)).actors[0].left, "34%", "editor program really moves fourteen steps in battle");
    await page.locator("#edit-program").click();
    await page.waitForURL("**/code5.html?stage=5");
    equal(await page.locator(".assembled-block").count(), 4, "return to editor preserves the program");
    equal(page.errors, [], "programming editor browser errors");
    await page.close();
    console.log("Editor: nested keyboard assembly, value editing, persistence and actual battle execution passed.");
}
async function verifyChapters(browser) {
    const sensing = await open(browser, "stage6.html");
    await advance(sensing, 3000);
    equal((await state(sensing)).actors[1].display, "none", "stage 6 enemy uses stealth");
    await sensing.keyboard.press("t");
    equal((await state(sensing)).actors[1].display, "flex", "scan reveals an invisible target");
    check(await sensing.locator("#bug").evaluate(el => el.classList.contains("detected")), "scan highlights the target");
    await advance(sensing, 2000);
    check(!(await sensing.locator("#bug").evaluate(el => el.classList.contains("detected"))), "scan expires");
    equal(sensing.errors, [], "sensing errors");
    await sensing.close();

    const operators = await open(browser, "stage7.html");
    await operators.keyboard.press("g");
    equal(await operators.locator(".effect").count(), 0, "false condition must not shoot");
    check(!(await operators.locator("#condition").isDisabled()), "false condition does not spend cooldown");
    await operators.keyboard.press("w");
    for (let n = 0; n < 5; n++) await operators.keyboard.press("ArrowUp");
    await operators.keyboard.press("g");
    equal(await operators.locator(".effect").count(), 1, "distance exactly 35 satisfies condition");
    await advance(operators, 800);
    equal((await state(operators)).life, ["10", "10"], "condition attack deals two damage");
    equal(operators.errors, [], "operators errors");
    await operators.close();

    const armor = await open(browser, "stage8.html");
    await armor.keyboard.press("Space");
    await advance(armor, 1100);
    equal((await state(armor)).life[1], "14", "armor blocks a basic shot");
    for (let n = 0; n < 3; n++) { await armor.keyboard.press("h"); await advance(armor, 1200); }
    await armor.keyboard.press("h");
    equal(await armor.locator("#mission-state").getAttribute("data-energy"), "3", "energy is capped at three");
    await armor.keyboard.press("f");
    await armor.keyboard.press("Space");
    equal(await armor.locator(".effect[data-damage='4']").count(), 1, "stored energy increases the next projectile damage");
    equal(await armor.locator("#mission-state").getAttribute("data-energy"), "0", "firing consumes energy once");
    await advance(armor, 1200);
    equal((await state(armor)).life[1], "11", "charged attack pierces armor with three damage");
    equal(armor.errors, [], "variables errors");
    await armor.close();

    const lists = await open(browser, "stage9.html");
    await lists.keyboard.press("k");
    check(!(await lists.locator("#replay").isDisabled()), "empty route rejects replay without cooldown");
    const saved = [];
    for (let n = 0; n < 4; n++) {
        await lists.keyboard.press("j");
        saved.push((await state(lists)).actors[0].left);
        await lists.keyboard.press("w");
    }
    equal(await lists.locator(".route-marker").count(), 3, "route has a maximum of three waypoints");
    await lists.keyboard.press("k");
    equal((await state(lists)).actors[0].left, saved[1], "full list drops the oldest position");
    await advance(lists, 450);
    equal((await state(lists)).actors[0].left, saved[2], "route visits second position in order");
    const beforeResize = await state(lists);
    await lists.setViewportSize(viewports[0]);
    equal(await state(lists), beforeResize, "resize preserves an executing route");
    await advance(lists, 450);
    equal((await state(lists)).actors[0].left, saved[3], "route visits final position in order");
    equal(lists.errors, [], "lists errors");
    await lists.close();

    const boss = await open(browser, "stage10.html");
    await boss.keyboard.press("l");
    equal(await boss.locator(".effect[data-damage='4']").count(), 1, "custom block composes a charged shot");
    equal((await state(boss)).actors[0].left, "10%", "custom block also retreats ten steps");
    await advance(boss, 1100);
    equal((await state(boss)).life[1], "14", "combo damages the boss");
    for (let n = 0; n < 5; n++) { await boss.keyboard.press("Space"); await advance(boss, 350); }
    await advance(boss, 900);
    equal(await boss.locator("#mission-state").getAttribute("data-phase"), "2", "half health triggers boss phase two");
    await advance(boss, 1250);
    equal(await boss.locator(".effect").count(), 3, "second phase fires three spread projectiles");
    equal(boss.errors, [], "boss errors");
    await boss.close();

    for (const viewport of [viewports[0], viewports[2]]) {
        const mobile = await open(browser, "stage10.html", viewport);
        await mobile.locator("#combo").click();
        await mobile.locator("#record").click();
        const rect = await mobile.locator("#arena").boundingBox();
        check(rect.y >= 0 && rect.y + rect.height <= viewport.height, "new blocks remain clickable with the arena visible in a small window");
        equal(mobile.errors, [], "small viewport chapter errors");
        await mobile.close();
    }

    // Win through real input and collisions; then follow the actual next-stage forms.
    const campaign = await open(browser, "stage5.php");
    equal(await campaign.locator("#nextlevel").evaluate(el => el.form.getAttribute("action")), "code5.html", "stage 5 leads to programming the next stage");
    await campaign.goto(`${base}/stage6.html`);
    await campaign.locator("#start-battle").click();
    for (let stage = 6; stage <= 10; stage++) {
        if (stage === 8) {
            for (let shot = 0; shot < 20 && !(await campaign.locator("#game-status").textContent()); shot++) {
                await campaign.keyboard.press("h");
                await campaign.keyboard.press("Space");
                await advance(campaign, 1200);
            }
        } else {
            for (let shot = 0; shot < 30 && !(await campaign.locator("#game-status").textContent()); shot++) {
                await campaign.keyboard.press("t");
                await campaign.keyboard.press("f");
                await campaign.keyboard.press("Space");
                await advance(campaign, 350);
            }
            await advance(campaign, 1100);
        }
        const outcome = await campaign.locator("#game-status").textContent();
        check(outcome.includes(stage === 10 ? "ALL CLEAR" : "YOU WIN"), `stage ${stage} can be won through real inputs: ${outcome}`);
        equal(await campaign.evaluate(() => window.__periodicTimers()), 0, "winning cancels AI and active effects");
        await campaign.keyboard.press("Enter");
        await campaign.waitForURL(url => url.pathname.endsWith(stage === 10 ? "/complete.html" : "/code5.html"));
        if (stage < 10) {
            equal(await campaign.locator("#editor-stage").inputValue(), String(stage + 1), "next stage opens its programming editor");
            await campaign.locator("#clear-code").click();
            await campaign.locator("#submit").click();
            await campaign.waitForURL(url => url.pathname.endsWith("/" + stageFile(stage + 1)));
        }
    }
    equal(campaign.errors, [], "whole campaign has no browser errors");
    await campaign.getByRole("link", { name: "스테이지 선택" }).click();
    await campaign.waitForURL("**/mainpage.html");
    equal(await campaign.locator(".stage-links a").count(), 11, "menu offers every stage");
    await campaign.close();
    console.log("Chapters: sensing, conditions, armor/energy, ordered routes, boss phases, small-window controls and a complete winning campaign passed.");
}

async function savePreviews(browser) {
    fs.mkdirSync(artifacts, { recursive: true });
    for (const [file, viewport, name] of [
        ["stage4.html", viewports[4], "stage4-desktop"], ["stage4.html", viewports[1], "stage4-mobile"],
        ["stage5.php", viewports[4], "stage5-desktop"],
        ["stage6.html", viewports[0], "stage6-mobile"], ["stage8.html", viewports[4], "stage8-desktop"],
        ["stage9.html", viewports[1], "stage9-mobile"], ["stage10.html", viewports[4], "stage10-desktop"],
        ["complete.html", viewports[1], "ending-mobile"],
        ["code5.html", viewports[4], "assembler-desktop"], ["mainpage.html", viewports[4], "menu-desktop"]
    ]) {
        const page = await open(browser, file, viewport);
        if (file === "stage4.html") await advance(page, 4100);
        if (file === "code5.html") for (const key of ["1", "w", "e", "Space"]) await page.keyboard.press(key);
        if (file === "stage9.html") for (const key of ["j", "w", "j", "w", "j"]) await page.keyboard.press(key);
        await page.screenshot({ path: path.join(artifacts, name + ".png"), fullPage: true });
        equal(page.errors, [], "preview browser errors");
        await page.close();
    }
}

(async () => {
    let server, browser;
    try {
        if (!process.env.CODINGMAN_TEST_URL) {
            server = spawn("php", ["-S", "127.0.0.1:8766", "-t", path.resolve(__dirname, "../../..")], { windowsHide: true });
            await new Promise((resolve, reject) => {
                server.on("error", reject);
                server.on("exit", code => reject(new Error(`PHP server exited with ${code}`)));
                server.stderr.on("data", data => { if (data.toString().includes("started")) resolve(); });
            });
        }
        browser = await chromium.launch({ headless: true, channel: process.env.CODINGMAN_TEST_BROWSER || "msedge" });
        if (process.env.CODINGMAN_TEST_FOCUS !== "programs") {
            await savePreviews(browser);
            await verifyLayouts(browser);
            await verifyCommands(browser);
            await verifyResizeAndCollision(browser);
            await verifyLifecycle(browser);
            await verifyAssembler(browser);
            await verifyChapters(browser);
        }
        fs.mkdirSync(artifacts, { recursive: true });
        await require("./program-checks.cjs")({ browser, open, advance, state, check, equal, base, artifacts });
        console.log(`PASS: ${checks} checks. Screenshots saved in tests/artifacts/.`);
    } finally {
        if (browser) await browser.close();
        if (server) server.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
