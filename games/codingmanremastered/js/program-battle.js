(function (app, model) {
    "use strict";
    app.prepareProgram = function (game, commands) {
        const stage = Number(document.body.dataset.stage);
        const saved = model.load(stage);
        const program = saved.error ? model.empty() : saved.program || model.empty();
        const toolbar = document.createElement("section"); toolbar.className = "program-toolbar"; toolbar.setAttribute("aria-label", "작성한 코드 실행");
        const label = document.createElement("span"); label.id = "program-status";
        const start = document.createElement("button"); start.id = "start-battle"; start.textContent = "전투 시작";
        const edit = document.createElement("a"); edit.id = "edit-program"; edit.href = `code5.html?stage=${stage}`; edit.textContent = "코드 수정";
        const monitor = document.createElement("details"); monitor.className = "program-monitor";
        const summary = document.createElement("summary"); summary.textContent = "내 코드 상태";
        const values = document.createElement("pre"); values.id = "program-values"; values.textContent = "변수와 리스트가 여기에 표시됩니다.";
        monitor.append(summary, values); toolbar.append(label, start, edit, monitor);
        document.querySelector(".game-header").after(toolbar);
        game.program = new app.ProgramRunner(game, commands, program, state => {
            label.textContent = state.running ? `코드 ${state.threads ? "실행 중" : "대기"} · ${state.current}` : "코드 정지";
            const rows = [...Object.entries(state.variables).map(([name, value]) => `${name} = ${value}`),
                ...Object.entries(state.lists).map(([name, list]) => `${name} = [${list.join(", ")}]`)];
            values.textContent = rows.join("\n") || "변수와 리스트가 여기에 표시됩니다.";
            values.dataset.variables = JSON.stringify(state.variables);
            values.dataset.lists = JSON.stringify(state.lists);
        });
        game.playing = false;
        game.render();
        label.textContent = saved.error || (saved.program ? `준비 · 저장된 코드 ${model.validate(program, stage).count}개` : "준비 · 코드 수정에서 전투를 프로그래밍하세요");
        start.disabled = Boolean(saved.error);
        function launch() {
            if (saved.error || game.playing) return;
            commands.reset(); game.resetActors(); game.start(); start.hidden = true;
        }
        start.addEventListener("click", launch);
        edit.addEventListener("click", () => game.stop());
        if (new URLSearchParams(location.search).get("run") === "1" && saved.program && !saved.error) launch();
    };
}(window.CodingMan, window.CodingManProgram));
