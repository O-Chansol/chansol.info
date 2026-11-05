(function (ui, model) {
    "use strict";
    const requested = Number(new URLSearchParams(location.search).get("stage") || 5);
    const stage = Number.isInteger(requested) && requested >= 5 && requested <= 10 ? requested : 5;
    const palette = document.getElementById("palette"), workspace = document.getElementById("bgd"), status = document.getElementById("editor-status");
    const draft = model.editorDraft(stage);
    let program = draft.program || model.empty();
    let destination = { owner: program.scripts.find(s => s.action === "start")?.id || null, branch: "body" };
    const history = [];
    const labels = { event: "이벤트", control: "제어", motion: "동작", looks: "형태", sound: "소리", sensing: "감지", operators: "연산", variables: "변수", lists: "리스트", myblocks: "나의 블록" };
    const sourceLabels = { number: "숫자", distance: "버그와 거리", life: "내 체력", bugLife: "버그 체력", variable: "변수", energy: "에너지", listLength: "리스트 길이", listItem: "리스트 항목" };
    const sensorLabels = { edge: "벽에 닿았는가?", always: "참", never: "거짓", visible: "버그가 보이는가?", touching: "버그에 닿았는가?", compare: "값 비교" };
    function element(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function find(id) {
        let result;
        model.walk(program, (node, info) => { if (node.id === id) result = { node, ...info }; });
        return result;
    }
    function snapshot() { history.push(JSON.stringify(program)); if (history.length > 30) history.shift(); }
    function update() {
        const result = model.validate(program, stage);
        document.getElementById("block-count").textContent = `블록 ${result.count}개`;
        document.getElementById("code").value = JSON.stringify(program);
        document.getElementById("undo").disabled = !history.length;
        try {
            model.save(stage, program);
            status.textContent = result.errors[0] || "자동 저장됨 · 전투에서 작성한 코드가 실행됩니다.";
            status.classList.toggle("is-error", Boolean(result.errors.length));
        } catch {
            status.textContent = "저장하지 못했습니다. 브라우저 저장 공간을 허용한 뒤 다시 시도해 주세요.";
            status.classList.add("is-error");
        }
    }
    function choose(owner, branch = "body", index) {
        destination = { owner, branch, index };
        const node = owner ? find(owner)?.node : null;
        document.getElementById("insertion-label").textContent = node ? `${model.definitions[node.action].label} ${branch === "elseBody" ? "else" : "안"}에 추가` : "시작 이벤트에 추가";
        workspace.querySelectorAll(".program-sequence").forEach(seq => seq.classList.toggle("selected-sequence", seq.dataset.owner === (owner || "") && seq.dataset.branch === branch));
    }
    function select(options, selected, label, change) {
        const input = element("select", "program-select"); input.setAttribute("aria-label", label);
        for (const option of options) {
            const [value, text] = Array.isArray(option) ? option : [option, option];
            const el = element("option", "", text); el.value = value; input.append(el);
        }
        input.value = selected;
        input.addEventListener("change", () => { snapshot(); change(input.value); update(); });
        return input;
    }
    function input(value, label, change, type = "number") {
        const el = element("input", "program-input");
        el.type = type; el.value = value; el.setAttribute("aria-label", label);
        if (type === "number") { el.step = "any"; el.min = -100000; el.max = 100000; } else el.maxLength = 24;
        el.addEventListener("focus", snapshot);
        el.addEventListener("input", () => { change(type === "number" ? (el.value === "" ? NaN : Number(el.value)) : el.value); update(); });
        return el;
    }
    function expressionEditor(expression, label) {
        const box = element("span", "expression-editor");
        function paint() {
            box.replaceChildren();
            box.append(select(Object.keys(model.sourceLevels).filter(source => model.sourceLevels[source] <= stage).map(source => [source, sourceLabels[source]]), expression.source, label + " 값 종류", source => { expression.source = source; paint(); }));
            if (expression.source === "number") box.append(input(expression.value, label, value => { expression.value = value; }));
            if (["variable", "listLength", "listItem"].includes(expression.source)) box.append(input(expression.name, label + " 이름", value => { expression.name = value; }, "text"));
            if (expression.source === "listItem") box.append(input(expression.index, "리스트 항목 번호", value => { expression.index = value; }));
            if (stage >= 7) {
                box.append(select([["none", "연산 없음"], "+", "-", "*", "/", "%"], expression.operator, label + " 연산", value => { expression.operator = value; paint(); }));
                if (expression.operator !== "none") box.append(input(expression.operand, label + " 연산 값", value => { expression.operand = value; }));
            }
        }
        paint(); return box;
    }
    function predicateEditor(predicate, label) {
        const box = element("span", "predicate-editor");
        function paint() {
            box.replaceChildren();
            const sensors = ["edge", "always", "never", ...(stage >= 6 ? ["visible", "touching"] : []), ...(stage >= 7 ? ["compare"] : [])];
            box.append(select(sensors.map(sensor => [sensor, sensorLabels[sensor]]), predicate.sensor, label, value => { predicate.sensor = value; paint(); }));
            if (predicate.sensor === "compare") {
                box.append(expressionEditor(predicate.left, label + " 왼쪽"));
                box.append(select([["lt", "<"], ["lte", "≤"], ["eq", "="], ["gt", ">"], ["gte", "≥"]], predicate.comparison, label + " 비교", value => { predicate.comparison = value; }));
                box.append(expressionEditor(predicate.right, label + " 오른쪽"));
            }
        }
        paint(); return box;
    }
    function fieldEditor(field, args) {
        const box = element("div", "program-field"); box.append(element("span", "field-label", field.label));
        if (field.kind === "expression") box.append(expressionEditor(args[field.key], field.label));
        else if (field.kind === "name") box.append(input(args[field.key], field.label, value => { args[field.key] = value; }, "text"));
        else if (field.kind === "select") box.append(select(field.options, args[field.key], field.label, value => { args[field.key] = value; }));
        else {
            const test = args[field.key], parts = element("span", "condition-editor");
            function paint() {
                parts.replaceChildren(predicateEditor(test, "첫 조건"));
                if (stage >= 7) {
                    parts.append(select([["none", "단일 조건"], ["and", "그리고 (and)"], ["or", "또는 (or)"]], test.join, "조건 연결", value => { test.join = value; paint(); }));
                    if (test.join !== "none") parts.append(predicateEditor(test.other, "두 번째 조건"));
                    parts.append(select([["false", "그대로"], ["true", "아니다 (not)"]], String(test.not), "조건 반전", value => { test.not = value === "true"; }));
                }
            }
            paint(); box.append(parts);
        }
        return box;
    }
    function tool(label, text, handler) {
        const button = element("button", "node-tool", text); button.type = "button";
        button.setAttribute("aria-label", label); button.addEventListener("click", handler); return button;
    }
    function remove(id) {
        const info = find(id); if (!info) return;
        snapshot(); info.nodes.splice(info.index, 1);
        if (destination.owner && !find(destination.owner)) destination = { owner: null, branch: "body" };
        render(); update();
    }
    function move(id, offset) {
        const info = find(id), next = info.index + offset;
        if (next < 0 || next >= info.nodes.length) return;
        snapshot(); info.nodes.splice(info.index, 1); info.nodes.splice(next, 0, info.node); render(); update();
    }
    function drawNode(node) {
        const def = model.definitions[node.action], frame = element("div", "program-node"); frame.dataset.nodeId = node.id;
        const row = element("div", "assembled-row"), block = element("div", "assembled-block " + def.type);
        block.id = node.id; block.dataset.action = node.action; block.tabIndex = 0; block.draggable = true;
        if (def.kind === "hat") block.dataset.shape = "hat";
        if (node.action === "stop") block.dataset.shape = "cap";
        block.append(element("span", "program-block-title", def.label));
        for (const field of def.fields) block.append(fieldEditor(field, node.args));
        block.addEventListener("click", event => {
            if (event.target.closest("input, select")) return;
            const info = find(node.id);
            if (node.body) choose(node.id); else choose(info.owner?.id || null, info.branch, info.index + 1);
        });
        const tools = element("div", "node-tools");
        tools.append(tool("위로 이동", "↑", () => move(node.id, -1)), tool("아래로 이동", "↓", () => move(node.id, 1)), tool("블록 삭제", "×", () => remove(node.id)));
        row.append(block, tools); frame.append(row); ui.enhance(block);
        if (node.body) { frame.classList.add("has-body"); frame.append(drawSequence(node.body, node.id, "body")); }
        if (node.elseBody) frame.append(element("div", "else-label", "else · 아니라면"), drawSequence(node.elseBody, node.id, "elseBody"));
        return frame;
    }
    function drawSequence(nodes, owner = null, branch = "scripts") {
        const sequence = element("div", "program-sequence"); sequence.dataset.owner = owner || ""; sequence.dataset.branch = branch;
        for (const node of nodes) sequence.append(drawNode(node));
        if (owner) {
            const target = element("button", "insert-here", "+ 여기에 코드 추가"); target.type = "button";
            target.addEventListener("click", () => choose(owner, branch)); sequence.append(target);
        }
        return sequence;
    }
    function render() {
        workspace.querySelectorAll(".scratch-block").forEach(ui.removeBlock);
        workspace.replaceChildren(drawSequence(program.scripts));
        if (!program.scripts.length) workspace.append(element("p", "workspace-placeholder", "시작 이벤트 또는 실행할 블록을 선택하세요."));
        choose(destination.owner, destination.branch, destination.index);
    }
    function add(action, target = destination) {
        const def = model.definitions[action];
        if (!def || def.level > stage || model.validate(program, stage).count >= 256) return;
        snapshot(); const node = model.node(action);
        if (def.kind === "hat") program.scripts.push(node);
        else {
            let parent = target.owner && find(target.owner)?.node;
            if (!parent) {
                parent = program.scripts.find(s => s.action === "start");
                if (!parent) { parent = model.node("start"); program.scripts.push(parent); }
                target = { owner: parent.id, branch: "body" };
            }
            const sequence = parent[target.branch];
            const index = target.index ?? sequence.length;
            sequence.splice(index, 0, node);
            destination = { owner: parent.id, branch: target.branch, index: index + 1 };
        }
        if (node.body) destination = { owner: node.id, branch: "body" };
        render(); update();
    }
    function buildPalette() {
        const groups = element("div", "palette-groups");
        for (const type of Object.keys(labels)) {
            const defs = model.catalog.filter(def => def.type === type && def.level <= stage); if (!defs.length) continue;
            const section = element("section", "block-group"); section.append(element("h3", "", labels[type]));
            for (const def of defs) {
                const button = element("button", def.type, def.label); button.id = "palette-" + def.action;
                button.type = "button"; button.dataset.action = def.action; button.draggable = true;
                if (def.kind === "hat") button.dataset.shape = "hat";
                if (def.action === "stop") button.dataset.shape = "cap";
                button.addEventListener("click", () => add(def.action)); section.append(button);
            }
            groups.append(section);
        }
        palette.append(groups); ui.enhanceAll(palette);
    }
    document.getElementById("title").textContent = `Stage ${stage} · 전투 프로그래밍`;
    document.title = `Stage ${stage} 프로그래밍 | Coding Man`;
    const selector = document.getElementById("editor-stage"); selector.value = stage;
    selector.addEventListener("change", () => { location.href = `code5.html?stage=${selector.value}`; });
    document.getElementById("submit").textContent = `코드 실행 · Stage ${stage} 시작`;
    document.getElementById("run-code").addEventListener("click", () => document.getElementById("assembler-form").requestSubmit());
    document.getElementById("step-out").addEventListener("click", () => {
        const info = destination.owner && find(destination.owner);
        choose(info?.owner?.id || null, info?.branch || "body", info ? info.index + 1 : undefined);
    });
    document.getElementById("undo").addEventListener("click", () => {
        if (!history.length) return;
        program = JSON.parse(history.pop()); destination = { owner: null, branch: "body" }; render(); update();
    });
    document.getElementById("clear-code").addEventListener("click", () => {
        snapshot(); program = model.empty(); destination = { owner: null, branch: "body" }; render(); update();
    });
    document.getElementById("example-code").addEventListener("click", () => {
        snapshot(); program = model.example(stage); destination = { owner: program.scripts[0].id, branch: "body" }; render(); update();
    });
    document.addEventListener("keydown", event => {
        if (event.code === "Enter" && event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); document.getElementById("assembler-form").requestSubmit(); return; }
        if (ui.isTyping(event) || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.code === "Escape") location.href = "mainpage.html";
        const template = ui.commandFor(event, palette);
        if (template) { event.preventDefault(); if (!event.repeat) add(template.dataset.action); }
        else if (["Delete", "Backspace"].includes(event.code)) {
            const node = event.target.closest(".program-node"); if (node) { event.preventDefault(); remove(node.dataset.nodeId); }
        }
    });
    document.addEventListener("dragstart", event => {
        if (event.target.closest("input, select")) { event.preventDefault(); return; }
        const block = event.target.closest("[data-action]"); if (!block) return;
        event.dataTransfer.setData("text/plain", palette.contains(block) ? "palette:" + block.dataset.action : "node:" + block.id);
        event.dataTransfer.effectAllowed = palette.contains(block) ? "copy" : "move";
    });
    workspace.addEventListener("dragover", event => { event.preventDefault(); });
    workspace.addEventListener("drop", event => {
        event.preventDefault();
        const sequence = event.target.closest(".program-sequence"); if (!sequence) return;
        const [kind, id] = event.dataTransfer.getData("text/plain").split(":");
        const rows = [...sequence.children].filter(child => child.matches(".program-node"));
        let index = rows.findIndex(row => event.clientY < row.getBoundingClientRect().top + row.clientHeight / 2);
        if (index < 0) index = rows.length;
        const target = { owner: sequence.dataset.owner || null, branch: sequence.dataset.branch, index };
        if (kind === "palette") { add(id, target); return; }
        const info = find(id); if (!info) return;
        const owner = target.owner && find(target.owner)?.node;
        if (Boolean(owner) === (model.definitions[info.node.action].kind === "hat")) return;
        let invalid = false;
        model.walk({ scripts: [info.node] }, node => { if (node.id === target.owner) invalid = true; });
        if (invalid) return;
        const nodes = owner ? owner[target.branch] : program.scripts;
        snapshot(); if (info.nodes === nodes && info.index < index) index--;
        info.nodes.splice(info.index, 1); nodes.splice(index, 0, info.node);
        destination = target; render(); update();
    });
    document.getElementById("assembler-form").addEventListener("submit", event => {
        event.preventDefault(); const result = model.validate(program, stage);
        if (result.errors.length) { status.textContent = result.errors.join(" "); status.classList.add("is-error"); status.focus(); return; }
        try { model.save(stage, program); } catch { status.textContent = "코드를 저장하지 못해 전투를 시작할 수 없습니다."; return; }
        location.href = `stage${stage}.html?run=1`;
    });
    buildPalette();
    try { render(); }
    catch { program = model.empty(); destination = { owner: null, branch: "body" }; render(); }
    if (draft.error) { status.textContent = draft.error; status.classList.add("is-error"); }
    else { update(); if (draft.inherited) status.textContent = `Stage ${draft.inherited}의 코드를 이어받았습니다. 새 블록을 추가해 보세요.`; }
}(window.CodingManUI, window.CodingManProgram));
