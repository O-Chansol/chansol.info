module.exports = async function verifyPrograms({ browser, open, advance, state, check, equal, base, artifacts }) {
    async function scenario(stage, name) {
        const page = await open(browser, `stage${stage}.html`);
        const errors = await page.evaluate(({ stage, name }) => {
            const m = window.CodingManProgram, n = m.node, v = m.number;
            const variable = name => ({ ...v(0), source: "variable", name });
            const listItem = (name, index) => ({ ...v(0), source: "listItem", name, index });
            const predicate = (sensor = "always") => ({ ...m.condition(), sensor });
            const start = body => n("start", {}, body);
            let scripts;
            if (name === "timing") scripts = [start([n("move", { value: v(10) }), n("wait", { value: v(1) }), n("move", { value: v(5) })])];
            if (name === "nested") scripts = [start([n("repeat", { value: v(2) }, [n("repeat", { value: v(3) }, [n("move", { value: v(2) })])])])];
            if (name === "until") scripts = [start([n("until", { condition: predicate("edge") }, [n("move", { value: v(15) })]), n("turn", { value: v(90) })])];
            if (name === "waitUntil") scripts = [start([n("waitUntil", { condition: predicate("edge") }), n("move", { value: v(-5) })])];
            if (name === "emptyLoop") scripts = [start([n("forever")])];
            if (name === "stop") scripts = [start([n("forever", {}, [n("move", { value: v(2) }), n("stop"), n("move", { value: v(50) })])])];
            if (name === "logic") {
                const test = predicate("compare"); test.left = { ...v(0), source: "life" }; test.right = v(0); test.comparison = "gt";
                test.join = "and"; test.other.sensor = "visible"; test.not = true;
                const branch = n("ifelse", { condition: test }, [n("move", { value: v(-20) })]);
                branch.elseBody = [n("move", { value: { ...v(10), operator: "+", operand: 5 } })];
                scripts = [start([branch])];
            }
            if (name === "events") scripts = [
                start([n("setVariable", { name: "hits", value: v(0) }), n("setVariable", { name: "attacks", value: v(0) })]),
                n("bug", { event: "attack" }, [n("changeVariable", { name: "attacks", value: v(1) })]),
                n("attacked", { target: "char" }, [n("changeVariable", { name: "hits", value: v(1) })])
            ];
            if (name === "key") scripts = [start([n("setVariable", { name: "keys", value: v(0) })]),
                n("key", { key: "Space" }, [n("wait", { value: v(.5) }), n("changeVariable", { name: "keys", value: v(1) })])];
            if (name === "concurrent") scripts = [start([n("repeat", { value: v(5) }, [n("changeVariable", { name: "a", value: v(1) })])]),
                start([n("repeat", { value: v(3) }, [n("changeVariable", { name: "b", value: v(1) })])])];
            if (name === "cooldown") scripts = [start([n("repeat", { value: v(3) }, [n("charge")]), n("attack")])];
            if (name === "lists") scripts = [start([
                n("listClear", { name: "steps" }), n("listAdd", { name: "steps", value: v(5) }), n("listAdd", { name: "steps", value: v(9) }),
                n("setVariable", { name: "length", value: { ...v(0), source: "listLength", name: "steps" } }),
                n("repeat", { value: variable("length") }, [n("move", { value: listItem("steps", 1) })]),
                n("listDelete", { name: "steps", value: v(1) }), n("move", { value: listItem("steps", 1) }), n("listClear", { name: "steps" })
            ])];
            if (name === "functions") scripts = [n("define", { name: "step" }, [n("move", { value: v(6) })]),
                n("define", { name: "twice" }, [n("repeat", { value: v(2) }, [n("call", { name: "step" })])]), start([n("call", { name: "twice" })])];
            if (name === "autoWin") scripts = m.example(stage).scripts;
            const program = { version: 1, scripts };
            const result = m.validate(program, stage);
            m.save(stage, program);
            return result.errors;
        }, { stage, name });
        equal(errors, [], `${name}: fixture is a valid player program`);
        await page.goto(`${base}/stage${stage}.html?run=1`);
        return page;
    }
    const vars = page => page.locator("#program-values").getAttribute("data-variables").then(JSON.parse);
    const timing = await scenario(5, "timing");
    await advance(timing, 1000);
    equal((await state(timing)).actors[0].left, "30%", "wait delays the next movement for one second");
    await advance(timing, 200);
    equal((await state(timing)).actors[0].left, "35%", "execution resumes after wait");
    await timing.close();
    for (const [name, expected] of [["nested", "32%"], ["until", "90%"], ["stop", "22%"]]) {
        const page = await scenario(5, name); await advance(page, 1800);
        equal((await state(page)).actors[0].left, expected, `${name} has real movement semantics`);
        equal(page.errors, [], `${name}: no browser errors`); await page.close();
    }
    const waiting = await scenario(5, "waitUntil");
    await advance(waiting, 500);
    equal((await state(waiting)).actors[0].left, "20%", "wait until initially blocks");
    for (let i = 0; i < 7; i++) await waiting.keyboard.press("w");
    await advance(waiting, 100);
    equal((await state(waiting)).actors[0].left, "85%", "wait until reevaluates after manual input");
    await waiting.close();
    const empty = await scenario(5, "emptyLoop");
    await advance(empty, 2000); await empty.keyboard.press("w");
    equal((await state(empty)).actors[0].left, "30%", "an empty forever loop does not freeze inputs");
    for (let i = 0; i < 200 && !(await empty.locator("#game-status").textContent()); i++) await advance(empty, 500);
    check((await empty.locator("#game-status").textContent()).includes("YOU LOSE"), "programmed battle can lose normally");
    equal(await empty.evaluate(() => window.__periodicTimers()), 0, "gameover cancels program and combat intervals");
    await empty.keyboard.press("Enter");
    equal(await empty.evaluate(() => window.__periodicTimers()), 3, "restart runs one program scheduler and one set of stage 5 timers");
    await empty.close();
    const logic = await scenario(7, "logic"); await advance(logic, 300);
    equal((await state(logic)).actors[0].left, "35%", "if/else combines live sensing, comparison, and/not and arithmetic"); await logic.close();
    const events = await scenario(8, "events"); await advance(events, 4500);
    equal(await vars(events), { hits: 1, attacks: 1 }, "actual enemy fire and actual damage trigger their event handlers"); await events.close();
    const key = await scenario(8, "key"); await advance(key, 100);
    for (let i = 0; i < 6; i++) await key.keyboard.press("Space");
    equal(await key.locator(".effect").count(), 0, "a programmed key overrides its default action");
    await advance(key, 700);
    equal(await vars(key), { keys: 1 }, "repeated events coalesce while the handler is waiting");
    await key.keyboard.press("Space"); await advance(key, 700);
    equal(await vars(key), { keys: 2 }, "a completed event handler can run again"); await key.close();
    const concurrent = await scenario(8, "concurrent"); await advance(concurrent, 1200);
    equal(await vars(concurrent), { a: 5, b: 3 }, "multiple start events execute independently"); await concurrent.close();
    const cooldown = await scenario(8, "cooldown"); await advance(cooldown, 100);
    equal(await cooldown.locator("#mission-state").getAttribute("data-energy"), "1", "program charges energy");
    check(await cooldown.locator("#charge").isDisabled(), "program and mouse share ability cooldowns");
    await cooldown.keyboard.press("h");
    equal(await cooldown.locator("#mission-state").getAttribute("data-energy"), "1", "manual input cannot bypass program cooldown");
    await advance(cooldown, 2700);
    equal(await cooldown.locator(".effect[data-damage='4']").count(), 1, "script waits for cooldowns and then fires all stored energy"); await cooldown.close();
    const lists = await scenario(9, "lists"); await advance(lists, 1200);
    equal((await state(lists)).actors[0].left, "39%", "list items and variable repeat counts drive movement");
    equal(await vars(lists), { length: 2 }, "list length can be stored in a variable");
    equal(JSON.parse(await lists.locator("#program-values").getAttribute("data-lists")), { steps: [] }, "list deletion and clearing work"); await lists.close();
    const functions = await scenario(10, "functions"); await advance(functions, 1500);
    equal((await state(functions)).actors[0].left, "32%", "player-defined blocks can call other player-defined blocks"); await functions.close();
    const auto = await scenario(6, "autoWin");
    for (let i = 0; i < 120 && !(await auto.locator("#game-status").textContent()); i++) await advance(auto, 250);
    check((await auto.locator("#game-status").textContent()).includes("YOU WIN"), "saved program wins a battle with no combat input");
    equal(await auto.evaluate(() => window.__periodicTimers()), 0, "autonomous victory stops every program timer");
    await auto.close();

    const editor = await open(browser, "code5.html?stage=10");
    await editor.locator("#clear-code").click();
    await editor.locator("#palette-define").click();
    await editor.locator("#palette-call").click();
    await editor.locator("#submit").click();
    check(editor.url().includes("code5.html"), "recursive definitions cannot start a battle");
    check((await editor.locator("#editor-status").textContent()).includes("자신"), "recursive call error is explained");
    await editor.reload();
    equal(await editor.locator(".assembled-block").count(), 2, "invalid but editable drafts survive reload for correction");
    const validation = await editor.evaluate(() => {
        const m = window.CodingManProgram, n = m.node, v = m.number;
        const p = node => ({ version: 1, scripts: [n("start", {}, [node])] });
        return {
            locked: m.validate(p(n("charge")), 5).errors.length,
            divide: m.validate(p(n("move", { value: { ...v(1), operator: "/", operand: 0 } })), 7).errors.length,
            unknown: m.validate({ version: 1, scripts: [{ id: "bad", action: "__proto__", args: {} }] }, 10).errors.length,
            missing: m.validate(p(n("call", { name: "missing" })), 10).errors.length,
            wait: m.validate(p(n("wait", { value: v(-1) })), 5).errors.length
        };
    });
    for (const [name, errors] of Object.entries(validation)) check(errors > 0, `${name}: invalid programs are rejected`);
    await editor.goto(`${base}/code5.html?stage=5`); await editor.locator("#clear-code").click();
    await editor.locator("#palette-repeat").click();
    const repeatBody = editor.locator(".program-node:has(> .assembled-row [data-action='repeat']) > .program-sequence");
    await editor.locator("#palette-move").dragTo(repeatBody);
    equal(await repeatBody.locator(":scope > .program-node").count(), 1, "dragging nests an instruction in a loop");
    await editor.locator("#palette-wait").click();
    await editor.locator(".assembled-block[data-action='wait']").locator("..").getByRole("button", { name: "위로 이동" }).click();
    equal(await repeatBody.locator(":scope > .program-node > .assembled-row > .assembled-block").evaluateAll(nodes => nodes.map(n => n.dataset.action)), ["wait", "move"], "reordering changes actual instruction order");
    await editor.getByRole("spinbutton", { name: "걸음", exact: true }).fill("7");
    await editor.goto(`${base}/code5.html?stage=6`);
    equal(await editor.getByRole("spinbutton", { name: "걸음", exact: true }).inputValue(), "7", "next stage inherits the edited code");
    check(await editor.locator("#palette-scan").isVisible(), "next stage unlocks its new instruction");
    equal(await editor.locator("#palette-charge").count(), 0, "later blocks stay unavailable");
    await editor.setViewportSize({ width: 320, height: 480 });
    check(await editor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "nested editor fits a narrow screen");
    await editor.screenshot({ path: require("node:path").join(artifacts, "program-editor-mobile.png"), fullPage: true });
    equal(editor.errors, [], "advanced program checks have no editor browser errors"); await editor.close();

    const corrupt = await open(browser, "stage5.html");
    await corrupt.evaluate(() => localStorage.setItem(window.CodingManProgram.storageKey(5), "{broken"));
    await corrupt.goto(`${base}/stage5.html?run=1`);
    check(await corrupt.locator("#start-battle").isDisabled(), "corrupt programs cannot autostart or start manually");
    equal(await corrupt.evaluate(() => window.__periodicTimers()), 0, "invalid programs never start combat");
    equal(corrupt.errors, [], "corrupt storage is handled without browser errors"); await corrupt.close();
    const local = await open(browser, "code5.html");
    await local.goto(require("node:url").pathToFileURL(require("node:path").resolve(__dirname, "../code5.html")).href);
    await local.locator("#clear-code").click();
    await local.locator("#palette-move").click();
    await local.getByRole("spinbutton", { name: "걸음", exact: true }).fill("7");
    await local.locator("#run-code").click();
    await local.waitForURL(url => url.pathname.endsWith("/stage5.html"));
    await advance(local, 200);
    equal((await state(local)).actors[0].left, "27%", "opening HTML files directly also carries code into the battle");
    equal(local.errors, [], "local file programming has no browser errors");
    await local.close();
    console.log("Programs: nested control flow, live conditions, concurrent events, cooldowns, variables, lists, custom calls, autonomous victory, persistence, drag/drop and invalid-program handling passed.");
};
