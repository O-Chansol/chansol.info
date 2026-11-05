(function () {
    "use strict";

    // Stage differences live here; movement, drawing and effects are shared.
    const stages = {
        0: { mode: "vertical", enemyInterval: 1200, projectileInterval: 20 },
        1: { mode: "directional", enemyInterval: 3000, projectileInterval: 25 },
        2: { mode: "directional", enemyInterval: 3000, projectileInterval: 25, looks: true },
        3: { mode: "directional", enemyInterval: 3000, projectileInterval: 25, looks: true, sound: true },
        4: { mode: "directional", enemyInterval: 3000, projectileInterval: 25, looks: true, sound: true, events: true },
        5: { mode: "directional", enemyInterval: 3000, projectileInterval: 25, looks: true, sound: true, events: true, control: true }
    };

    const chapters = [
        [6, "sensing", "감지 · 보이지 않는 버그", "#5cb1d6", "은신하는 버그를 찾아내세요.", "T로 2초간 위치와 거리를 감지하고, F로 조준한 뒤 Space로 공격하세요.", 10, 3000],
        [7, "operators", "연산 · 거리의 조건", "#59c059", "거리를 비교해 조건 공격을 실행하세요.", "W로 접근하세요. G는 거리 ≤ 35일 때 자동 조준해 피해 2의 탄환을 발사합니다.", 12, 2800],
        [8, "variables", "변수 · 에너지 저장", "#ff8c1a", "충전으로 버그의 장갑을 뚫으세요.", "H로 에너지를 최대 3까지 저장하세요. 다음 Space 공격에 모두 사용됩니다. 장갑은 피해를 1 줄입니다.", 14, 2800],
        [9, "lists", "리스트 · 경로 기억", "#ff661a", "여러 위치를 저장하고 순서대로 공격하세요.", "이동하며 J로 위치를 최대 3개 저장하세요. K는 저장 순서대로 순간이동하며 자동 조준·공격합니다.", 14, 2600],
        [10, "my blocks", "나만의 블록 · 최종 디버그", "#ff6680", "배운 코드로 코어 버그를 정지시키세요.", "L의 debug combo는 감지 → 최대 충전 → 조준 → 공격 → 후퇴를 실행합니다. 체력 절반부터 부채꼴 공격이 시작됩니다.", 18, 2500]
    ];
    for (const [number, name, title, color, objective, help, enemyLife, enemyInterval] of chapters) {
        stages[number] = { number, name, title, color, objective, help, enemyLife, enemyInterval,
            mode: "directional", projectileInterval: 25, advanced: true };
    }

    const motionMessages = {
        random: "move to random position",
        point: "point towards character",
        move1: "move 10 steps",
        move2: "move -10 steps",
        bounce: "if on edge, bounce",
        clock: "turn ⟳ 90 degrees",
        counter_clock: "turn ⟲ 90 degrees"
    };

    const eventMessages = {
        attack: "when space key pressed",
        random: "when move to random position clicked",
        point: "when point towards character clicked",
        move1: "when move 10 steps clicked",
        move2: "when move -10 steps clicked",
        bounce: "when if on edge, bounce clicked",
        clock: "when turn ⟳ 45 degrees clicked",
        counter_clock: "when turn ⟲ 90 degrees clicked",
        size: "when set size to 50% clicked",
        hide: "when hide clicked",
        sound: "when start sound clicked",
        mute: "when stop all sounds clicked"
    };

    function retreat(game, annotate = false) {
        const logMotion = !game.stage.control;
        game.motion("move2", "bug", logMotion);
        if (annotate) game.message("move -10 steps <<<", "motion");
        game.motion("bounce", "bug", logMotion);
        if (annotate) game.message("if on edge, bounce <<<", "motion");
    }

    function reactToEvent(game, action) {
        if (game.challenge) return;
        if (!game.stage.events) return;
        game.message(eventMessages[action], "event");
        if (action === "random" && !game.stage.control) {
            for (let turn = 0; turn < 4; turn++) {
                game.motion("clock", "bug");
                game.message("turn ⟳ 45 degrees <<<", "motion");
            }
        }
        if (["attack", "random", "point", "hide", "sound"].includes(action)) {
            retreat(game, true);
        }
    }

    function enemyTurn(game) {
        if (game.stage.mode === "vertical") {
            game.randomizeEnemy();
            game.effects.shoot("bug");
            return;
        }
        game.motion("random", "bug");
        game.motion("point", "bug");
        game.motion("move1", "bug");
        game.motion("bounce", "bug");
        game.effects.shoot("bug");
        game.motion("move2", "bug");
        game.motion("bounce", "bug");
        if (game.stage.looks) game.looks("hide", "bug");
        if (game.stage.sound && game.turnCount % 5 === 0) {
            game.effects.sound("sound", "bug");
            if (game.stage.control) game.effects.cloneEnemy();
        }
        if (game.stage.sound) game.turnCount++;
    }

    function onProjectileHit(game, owner) {
        if (game.challenge) return;
        if (game.stage.mode === "vertical") return;
        if (owner === "char") {
            game.motion("random", "bug");
            game.motion("point", "bug");
            if (game.stage.looks) game.looks("hide", "bug");
        } else if (game.stage.events) {
            game.motion("move2", "bug");
            game.motion("bounce", "bug");
            game.looks("size", "bug");
        }
    }

    function onSoundHit(game, owner) {
        if (game.challenge) return;
        if (owner === "char" && game.stage.events) {
            onProjectileHit(game, owner);
        } else if (!game.stage.events) {
            game.motion(Math.random() < 0.5 ? "clock" : "counter_clock", "bug");
            game.motion("move2", "bug");
            game.motion("bounce", "bug");
            game.looks("size", "bug");
        } else {
            const logActions = !game.stage.control;
            game.message("when attack succesed", "event");
            game.motion("clock", "bug", logActions);
            game.message("turn 90 degrees <<<", "motion");
            game.motion("move2", "bug", logActions);
            game.message("move -10 steps <<<", "motion");
            game.motion("bounce", "bug", logActions);
            game.message("if on edge, bounce", "motion");
            game.looks("size", "bug", logActions);
            game.message("set size to 50%", "looks");
        }
    }

    window.CodingMan = { stages, motionMessages, reactToEvent, enemyTurn, onProjectileHit, onSoundHit };
}());
