(function (app) {
    "use strict";

    const stage = app.stages[document.body.dataset.stage];
    const unlocks = [
        { level: 6, label: "감지", type: "sensing", action: "scan", text: "distance to Bug", shape: "reporter", cooldown: 3000 },
        { level: 7, label: "연산", type: "operators", action: "condition", text: "distance ≤ 35", shape: "boolean", cooldown: 2200 },
        { level: 8, label: "변수", type: "variables", action: "charge", text: "change energy by 1", cooldown: 1200 },
        { level: 9, label: "리스트", type: "lists", action: "record", text: "add position to route" },
        { level: 9, label: "경로 실행", type: "myblocks", action: "replay", text: "run route", cooldown: 5000 },
        { level: 10, label: "나만의 블록", type: "myblocks", action: "combo", text: "debug combo", cooldown: 8000 }
    ];
    const basics = [
        { label: "동작", type: "motion", actions: [
            ["random", "move to random position", 3000], ["point", "point towards character", 3000],
            ["move1", "move 10 steps"], ["move2", "move -10 steps"], ["bounce", "if on edge, bounce"],
            ["clock", "turn ⟳ 45 degrees"], ["counter_clock", "turn ⟲ 45 degrees"]
        ] },
        { label: "형태", type: "looks", actions: [["size", "set size to 50%", 3000], ["hide", "hide", 3000]] },
        { label: "소리", type: "sound", actions: [["sound", "start sound", 3000], ["mute", "stop all sounds", 15000]] },
        { label: "공격", type: "myblocks", actions: [["attack", "attack", 350]] }
    ];
    function button({ type, action, text, shape = "stack", cooldown = 0 }) {
        return `<button class="${type}" id="${action}" data-action="${action}" data-shape="${shape}" data-cooldown="${cooldown}">${text}</button>`;
    }
    const palette = unlocks.filter(item => item.level <= stage.number).sort((a, b) => b.level - a.level)
        .map(item => `<section class="block-group"><h3>${item.label}${item.level === stage.number ? " · NEW" : ""}</h3>${button(item)}</section>`).join("")
        + basics.map(group => `<section class="block-group"><h3>${group.label}</h3>${group.actions.map(([action, text, cooldown]) => button({ type: group.type, action, text, cooldown })).join("")}</section>`).join("");
    const next = stage.number === 10 ? "complete.html" : "code5.html";
    const nextLabel = stage.number === 10 ? "엔딩 보기 ↵" : `Stage ${stage.number + 1}으로 ↵`;
    document.title = `Stage ${stage.number}. ${stage.name} | Coding Man`;
    document.body.style.setProperty("--stage-accent", stage.color);
    document.body.style.setProperty("--enemy-color", stage.color);
    document.body.insertAdjacentHTML("afterbegin", `
        <header class="game-header">
            <a class="brand" href="mainpage.html">CODING MAN<span>REMASTERED</span></a>
            <h1 id="title">Stage ${stage.number}. ${stage.name}</h1>
            <p class="controls-hint"><kbd>←</kbd> <kbd>→</kbd> 회전 · <kbd>↑</kbd> <kbd>↓</kbd> 이동 · <kbd>Space</kbd> 공격</p>
        </header>
        <main class="game-layout">
            <aside class="code-palette" aria-label="플레이어 코드">
                <h2 class="panel-title">내 코드 <span>KEYBOARD + MOUSE</span></h2>
                <div class="palette-groups">${palette}</div>
                <p class="palette-note">블록을 클릭하거나 표시된 키를 누르세요.</p>
            </aside>
            <section class="arena-column" aria-label="플레이 영역">
                <div class="health-bars">
                    <div class="health"><div class="health-label"><span>You</span></div><div class="health-track"><div id="char_life" role="progressbar" aria-label="플레이어 체력" aria-valuemin="0" aria-valuemax="10" aria-valuenow="10"></div></div></div>
                    <div class="health"><div class="health-label"><span>${stage.number === 10 ? "Core Bug" : "Bug"}</span></div><div class="health-track"><div id="bug_life" role="progressbar" aria-label="버그 체력" aria-valuemin="0" aria-valuemax="${stage.enemyLife}" aria-valuenow="${stage.enemyLife}"></div></div></div>
                </div>
                <div id="mission-state" class="mission-state" aria-label="코드 상태"></div>
                <div id="arena" class="arena" aria-label="정사각형 전투장">
                    <div id="char" class="actor" aria-label="플레이어"><span>^</span></div>
                    <div id="bug" class="actor" aria-label="버그"><span>^</span></div>
                </div>
                <nav class="movement-controls" aria-label="이동 조작">
                    <button class="move-button" data-move="ArrowLeft" aria-label="왼쪽 회전">←</button>
                    <button class="move-button" data-move="ArrowUp" aria-label="전진">↑</button>
                    <button class="move-button" data-move="ArrowDown" aria-label="후진">↓</button>
                    <button class="move-button" data-move="ArrowRight" aria-label="오른쪽 회전">→</button>
                </nav>
                <p id="game-status" class="game-status" role="status"></p>
                <div class="game-actions">
                    <form action="${next}" method="GET">${stage.number === 10 ? "" : `<input type="hidden" name="stage" value="${stage.number + 1}">`}<button type="submit" id="nextlevel">${nextLabel}</button></form>
                    <button id="restart">다시 시작 ↵</button><button id="exit">메뉴 · Esc</button>
                </div>
                <p class="shortcut-note"><kbd>Enter</kbd> 승패 후 진행 · <kbd>Esc</kbd> 메뉴</p>
            </section>
            <aside class="enemy-panel" aria-label="미션과 버그의 코드">
                <section class="mission-guide">
                    <p class="chapter-number">CHAPTER ${stage.number} / 10</p>
                    <h2>${stage.title}</h2><p>${stage.help}</p>
                    <p id="mission-feedback" class="mission-feedback" role="status"></p>
                </section>
                <h2 id="bug_code" class="panel-title">Bug Code <span>LIVE</span></h2>
                <div id="code-log" class="code-log"><p class="empty-log">실행되는 코드를<br>여기서 확인할 수 있어요.</p></div>
            </aside>
        </main>`);
}(window.CodingMan));
