(function () {
    "use strict";
    const number = value => ({ source: "number", value, name: "score", index: 1, operator: "none", operand: 0 });
    const condition = () => ({ sensor: "edge", left: number(0), comparison: "lte", right: number(35), not: false, join: "none",
        other: { sensor: "always", left: number(0), comparison: "lte", right: number(0) } });
    const field = (key, kind, label, value, options) => ({ key, kind, label, value, options });
    const value = (label, initial) => field("value", "expression", label, number(initial));
    const name = initial => field("name", "name", "이름", initial);
    const test = () => field("condition", "condition", "조건", condition());
    const catalog = [
        ["start", "when started", "event", "hat", 5],
        ["key", "when key pressed", "event", "hat", 5, [field("key", "select", "키", "Space", ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(x => "Key" + x)])]],
        ["bug", "when Bug executes", "event", "hat", 5, [field("event", "select", "버그 동작", "attack", ["move", "attack", "hide", "sound"])]],
        ["attacked", "when hit", "event", "hat", 5, [field("target", "select", "피격 대상", "char", ["char", "bug"])]],
        ["repeat", "repeat", "control", "container", 5, [value("횟수", 3)]],
        ["forever", "forever", "control", "container", 5],
        ["wait", "wait seconds", "control", "command", 5, [value("초", 0.5)]],
        ["if", "if then", "control", "container", 5, [test()]],
        ["ifelse", "if then / else", "control", "branch", 5, [test()]],
        ["until", "repeat until", "control", "container", 5, [test()]],
        ["waitUntil", "wait until", "control", "command", 5, [test()]],
        ["stop", "stop this script", "control", "command", 5],
        ["random", "move to random position", "motion", "command", 5],
        ["point", "point towards Bug", "motion", "command", 5],
        ["move", "move steps", "motion", "command", 5, [value("걸음", 10)]],
        ["turn", "turn degrees", "motion", "command", 5, [value("도", 45)]],
        ["bounce", "if on edge, bounce", "motion", "command", 5],
        ["size", "set size to %", "looks", "command", 5, [value("크기 %", 50)]],
        ["hide", "hide for 1 second", "looks", "command", 5],
        ["sound", "start sound", "sound", "command", 5],
        ["mute", "stop all sounds", "sound", "command", 5],
        ["attack", "attack", "myblocks", "command", 5],
        ["scan", "scan Bug", "sensing", "command", 6],
        ["condition", "attack if distance ≤ 35", "operators", "command", 7],
        ["charge", "change energy by 1", "variables", "command", 8],
        ["setVariable", "set variable to", "variables", "command", 8, [name("score"), value("값", 0)]],
        ["changeVariable", "change variable by", "variables", "command", 8, [name("score"), value("값", 1)]],
        ["record", "add position to route", "lists", "command", 9],
        ["replay", "run route", "lists", "command", 9],
        ["listAdd", "add item to list", "lists", "command", 9, [name("steps"), value("항목", 10)]],
        ["listDelete", "delete item of list", "lists", "command", 9, [name("steps"), value("항목 번호", 1)]],
        ["listClear", "delete all of list", "lists", "command", 9, [name("steps")]],
        ["define", "define", "myblocks", "hat", 10, [name("debug")]],
        ["call", "run my block", "myblocks", "command", 10, [name("debug")]]
    ].map(([action, label, type, kind, level, fields = []]) => ({ action, label, type, kind, level, fields }));
    const definitions = Object.fromEntries(catalog.map(item => [item.action, item]));
    let serial = 0;
    function node(action, args = {}, body = []) {
        const def = definitions[action];
        return { id: "b" + Date.now().toString(36) + (++serial).toString(36), action,
            args: Object.assign(Object.fromEntries(def.fields.map(f => [f.key, structuredClone(f.value)])), args),
            ...(def.kind === "hat" || def.kind === "container" || def.kind === "branch" ? { body } : {}),
            ...(def.kind === "branch" ? { elseBody: [] } : {}) };
    }
    const empty = () => ({ version: 1, scripts: [] });
    function example(stage) {
        const body = [node("point"), ...(stage >= 8 ? [node("charge")] : []), node("attack"), node("wait", { value: number(0.4) })];
        const program = { version: 1, scripts: [node("start", {}, [node("forever", {}, body)])] };
        if (stage >= 6) program.scripts.push(node("start", {}, [node("forever", {}, [node("scan"), node("wait", { value: number(3) })])]));
        if (stage === 10) {
            program.scripts = [node("define", { name: "debug" }, body), node("start", {}, [node("forever", {}, [node("call", { name: "debug" })])]), program.scripts[1]];
        }
        return program;
    }
    function walk(program, callback) {
        function visit(nodes, owner = null, branch = "scripts") {
            nodes.forEach((item, index) => {
                callback(item, { nodes, index, owner, branch });
                if (item.body) visit(item.body, item, "body");
                if (item.elseBody) visit(item.elseBody, item, "elseBody");
            });
        }
        visit(program.scripts);
    }
    const validName = text => typeof text === "string" && /^[\p{L}\p{N}_]{1,24}$/u.test(text);
    const sourceLevels = { number: 5, distance: 6, life: 6, bugLife: 6, variable: 8, energy: 8, listLength: 9, listItem: 9 };
    function validate(program, stage) {
        const errors = [];
        const fail = text => { if (!errors.includes(text)) errors.push(text); };
        const numeric = n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100000;
        function expression(e) {
            if (!e || !Object.hasOwn(sourceLevels, e.source) || sourceLevels[e.source] > stage) return fail("아직 획득하지 않았거나 잘못된 값 블록입니다.");
            if (!numeric(e.value) || !numeric(e.operand) || !numeric(e.index)) fail("숫자는 -100000~100000 범위의 유한한 값이어야 합니다.");
            if (!validName(e.name)) fail("변수·리스트 이름은 글자, 숫자, 밑줄로 1~24자여야 합니다.");
            if (!["none", "+", "-", "*", "/", "%"].includes(e.operator) || e.operator !== "none" && stage < 7) fail("연산은 Stage 7부터 사용할 수 있습니다.");
            if (["/", "%"].includes(e.operator) && e.operand === 0) fail("0으로 나눌 수 없습니다.");
        }
        function predicate(c) {
            if (!c || !["always", "never", "edge", "visible", "touching", "compare"].includes(c.sensor)) return fail("조건을 선택해 주세요.");
            if (["visible", "touching"].includes(c.sensor) && stage < 6 || c.sensor === "compare" && stage < 7) fail("이 조건은 아직 획득하지 않았습니다.");
            if (!["lt", "lte", "eq", "gt", "gte"].includes(c.comparison)) fail("올바른 비교 연산을 선택해 주세요.");
            expression(c.left); expression(c.right);
        }
        let count = 0;
        const ids = new Set(), procedures = new Map(), calls = [];
        function sequence(nodes, depth, top = false, procedure = null) {
            if (!Array.isArray(nodes) || depth > 12) return fail("블록 중첩은 12단계까지 가능합니다.");
            for (const item of nodes) {
                if (++count > 256) { fail("프로그램은 256개 블록까지 가능합니다."); return; }
                const def = item && Object.hasOwn(definitions, item.action) && definitions[item.action];
                if (!def || def.level > stage) { fail("현재 단계에서 사용할 수 없는 블록입니다."); continue; }
                if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,60}$/.test(item.id) || ids.has(item.id)) fail("블록 식별자가 손상되었거나 중복됩니다.");
                ids.add(item.id);
                if (top !== (def.kind === "hat")) fail("이벤트와 정의 블록은 맨 위에, 실행 블록은 이벤트 안에 놓아 주세요.");
                if (def.kind === "command" && item.body !== undefined || def.kind !== "branch" && item.elseBody !== undefined) fail("이 블록 안에는 다른 코드를 넣을 수 없습니다.");
                if (!item.args || typeof item.args !== "object") { fail("블록 입력값이 없습니다."); continue; }
                for (const f of def.fields) {
                    const v = item.args[f.key];
                    if (f.kind === "expression") expression(v);
                    else if (f.kind === "name" && !validName(v)) fail("변수·리스트·블록 이름은 글자, 숫자, 밑줄로 1~24자여야 합니다.");
                    else if (f.kind === "select" && !f.options.includes(v)) fail("블록의 선택값이 올바르지 않습니다.");
                    else if (f.kind === "condition") {
                        predicate(v);
                        if (!v || typeof v.not !== "boolean" || !["none", "and", "or"].includes(v.join)) fail("조건 조합이 올바르지 않습니다.");
                        else {
                            predicate(v.other);
                            if ((v.not || v.join !== "none") && stage < 7) fail("and / or / not은 Stage 7부터 사용할 수 있습니다.");
                        }
                    }
                }
                const literal = item.args.value;
                if (literal?.source === "number" && literal.operator === "none") {
                    if (item.action === "repeat" && (!Number.isInteger(literal.value) || literal.value < 0 || literal.value > 1000)) fail("반복 횟수는 0~1000 사이 정수로 입력해 주세요.");
                    if (item.action === "wait" && (literal.value < 0 || literal.value > 60)) fail("기다리는 시간은 0~60초로 입력해 주세요.");
                    if (item.action === "size" && (literal.value < 1 || literal.value > 100)) fail("크기는 1~100%로 입력해 주세요.");
                    if (item.action === "move" && Math.abs(literal.value) > 100) fail("이동 거리는 -100~100걸음으로 입력해 주세요.");
                }
                if (item.action === "define") {
                    if (procedures.has(item.args.name)) fail("같은 이름의 나만의 블록이 두 개 있습니다.");
                    procedures.set(item.args.name, item);
                }
                if (item.action === "call") calls.push({ name: item.args.name, from: procedure });
                if (["hat", "container", "branch"].includes(def.kind)) sequence(item.body, depth + 1, false, item.action === "define" ? item.args.name : procedure);
                if (def.kind === "branch") sequence(item.elseBody, depth + 1, false, procedure);
            }
        }
        if (!program || program.version !== 1 || !Array.isArray(program.scripts)) return { errors: ["저장된 프로그램 형식을 읽을 수 없습니다."], count: 0 };
        if (program.scripts.length > 24) return { errors: ["이벤트·정의 묶음은 최대 24개입니다."], count: 0 };
        sequence(program.scripts, 0, true);
        for (const call of calls) if (!procedures.has(call.name)) fail(`'${String(call.name).slice(0, 24)}' 블록을 먼저 정의해 주세요.`);
        const checked = new Map();
        function checkCalls(name, path = []) {
            if (path.includes(name)) { fail("나만의 블록은 자신을 다시 호출할 수 없습니다."); return 13; }
            if (checked.has(name)) return checked.get(name);
            const depth = 1 + Math.max(0, ...calls.filter(c => c.from === name).map(call => checkCalls(call.name, [...path, name])));
            if (depth > 12) fail("나만의 블록은 12단계보다 깊게 호출할 수 없습니다.");
            checked.set(name, depth);
            return depth;
        }
        for (const name of procedures.keys()) checkCalls(name);
        return { errors, count };
    }
    const storageKey = stage => "codingman.program.v1.stage." + stage;
    function load(stage) {
        try {
            const raw = localStorage.getItem(storageKey(stage));
            if (raw === null) return { program: null, error: null };
            if (raw.length > 65536) throw new Error("프로그램 저장 크기가 너무 큽니다.");
            const program = JSON.parse(raw);
            const result = validate(program, stage);
            return { program, error: result.errors.join(" ") || null };
        } catch (error) { return { program: null, error: "저장된 코드를 읽을 수 없습니다. 편집기에서 다시 저장해 주세요." }; }
    }
    function save(stage, program) {
        const raw = JSON.stringify(program);
        if (raw.length > 65536) throw new Error("프로그램 저장 크기는 64KB까지입니다.");
        localStorage.setItem(storageKey(stage), raw);
    }
    function editorDraft(stage) {
        const current = load(stage);
        if (current.program || current.error) return current;
        for (let previous = stage - 1; previous >= 5; previous--) {
            const draft = load(previous);
            if (draft.program && !draft.error) return { program: structuredClone(draft.program), error: null, inherited: previous };
        }
        return { program: example(stage), error: null };
    }
    window.CodingManProgram = { catalog, definitions, number, condition, node, empty, example, walk, validate, load, save, editorDraft, storageKey, sourceLevels };
}());
