(function (app, ui) {
    "use strict";

    const game = new app.Game(app.stages[document.body.dataset.stage]);
    const commands = new app.PlayerCommands(game);
    game.commands = commands;
    const arrows = new Set(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]);
    ui.enhanceAll();

    function activate(button) {
        if (!button.disabled) commands.perform(button.dataset.action);
    }

    function restart() {
        commands.reset();
        game.restart();
    }

    window.addEventListener("keydown", event => {
        if (ui.isTyping(event) || event.altKey || event.ctrlKey || event.metaKey) return;
        if (game.playing && game.program?.hasKey(event.code)) {
            event.preventDefault();
            if (!event.repeat) game.program.emit("key", event.code);
            return;
        }
        if (event.code === "Escape") {
            event.preventDefault();
            window.location.href = "mainpage.html";
        } else if (event.code === "Enter" && !game.playing) {
            event.preventDefault();
            if (!document.body.classList.contains("game-ended")) document.getElementById("start-battle")?.click();
            else if (game.actors.char.life === 0) restart();
            else game.buttons.nextlevel.click();
        } else if (arrows.has(event.code)) {
            event.preventDefault();
            if (game.playing) game.move(event.code);
        } else {
            const button = ui.commandFor(event);
            if (button) {
                event.preventDefault();
                activate(button);
            }
        }
    });

    document.querySelectorAll("button[data-action]").forEach(button => {
        button.addEventListener("click", () => activate(button));
    });
    document.querySelectorAll("button[data-move]").forEach(button => {
        button.addEventListener("click", () => { if (game.playing) game.move(button.dataset.move); });
    });
    game.buttons.restart.addEventListener("click", restart);
    game.buttons.exit.addEventListener("click", () => { window.location.href = "mainpage.html"; });
    if (Number(document.body.dataset.stage) >= 5) app.prepareProgram(game, commands);
    else game.start();
}(window.CodingMan, window.CodingManUI));
