(function (app) {
    "use strict";
    class PlayerCommands {
        constructor(game) {
            this.game = game;
            this.cooldowns = new Map();
            this.buttons = new Map([...document.querySelectorAll("button[data-action]")].map(button => [button.dataset.action, button]));
        }
        reset() {
            for (const timer of this.cooldowns.values()) clearTimeout(timer);
            this.cooldowns.clear();
            for (const button of this.buttons.values()) { button.disabled = false; button.removeAttribute("aria-label"); }
        }
        perform(action, value) {
            const game = this.game;
            if (!game.playing) return "unavailable";
            if (this.cooldowns.has(action)) return "busy";
            const log = !game.stage.control;
            if (game.challenge?.handles(action)) {
                if (!game.challenge.execute(action)) return "done";
            } else if (action === "attack") {
                app.reactToEvent(game, action);
                game.effects.shoot("char");
            } else {
                if (["random", "point", "move", "turn", "move1", "move2", "bounce", "clock", "counter_clock"].includes(action)) game.motion(action, "char", log, value);
                else if (["size", "hide"].includes(action)) game.looks(action, "char", log, value);
                else if (["sound", "mute"].includes(action)) game.effects.sound(action, "char", log);
                else return "unavailable";
                app.reactToEvent(game, action === "move" ? "move1" : action === "turn" ? "clock" : action);
            }
            const button = this.buttons.get(action);
            let delay = Number(button?.dataset.cooldown || 0);
            if (game.program && action === "point") delay = 0;
            if (game.program && action === "attack") delay = 350;
            if (delay) {
                if (button) { button.disabled = true; button.setAttribute("aria-label", `${button.title} · 재사용 대기 중`); }
                this.cooldowns.set(action, setTimeout(() => {
                    if (button) { button.disabled = false; button.removeAttribute("aria-label"); }
                    this.cooldowns.delete(action);
                }, delay));
            }
            return "done";
        }
    }
    app.PlayerCommands = PlayerCommands;
}(window.CodingMan));
