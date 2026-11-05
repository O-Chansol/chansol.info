(function (app) {
    "use strict";

    class Game {
        constructor(stage) {
            this.stage = stage;
            this.arena = document.getElementById("arena");
            this.log = document.getElementById("code-log");
            this.status = document.getElementById("game-status");
            this.timeouts = new Set();
            this.actors = {};
            for (const id of ["char", "bug"]) {
                this.actors[id] = {
                    element: document.getElementById(id),
                    lifeBar: document.getElementById(id + "_life")
                };
            }
            this.buttons = Object.fromEntries(["restart", "nextlevel", "exit"].map(
                id => [id, document.getElementById(id)]
            ));
            this.turnCount = 0;
            this.muted = false;
            this.effects = new app.Effects(this);
            this.challenge = stage.advanced ? new app.AdvancedBattle(this) : null;
            this.resetActors();
        }

        resetActors() {
            document.body.classList.remove("game-ended");
            const vertical = this.stage.mode === "vertical";
            Object.assign(this.actors.char, { x: vertical ? 45 : -25, y: vertical ? 75 : 0, direction: 90, life: 10, radius: 5 });
            Object.assign(this.actors.bug, { x: vertical ? 45 : 25, y: vertical ? 15 : 0, direction: -90, life: this.stage.enemyLife || 10, radius: 5 });
            this.playing = true;
            for (const actor of Object.values(this.actors)) {
                actor.element.classList.remove("is-small");
                actor.element.style.display = "flex";
                actor.lifeBar.style.width = "100%";
                actor.maxLife = actor.life;
                actor.lifeBar.setAttribute("aria-valuemax", actor.maxLife);
                actor.lifeBar.setAttribute("aria-valuenow", actor.life);
            }
            this.challenge?.reset();
        }

        start() {
            if (this.stage.control) this.startControlStage();
            else this.render();
            this.enemyTimer = setInterval(() => this.challenge ? this.challenge.enemyTurn() : app.enemyTurn(this), this.stage.enemyInterval);
            if (this.stage.control) this.repeatTimer = setInterval(() => this.repeatEnemyMovement(), 600);
            this.program?.start();
        }

        restart() {
            this.stop();
            this.resetActors();
            this.turnCount = 0;
            this.muted = false;
            this.buttons.restart.style.display = "none";
            this.buttons.nextlevel.style.display = "none";
            this.log.querySelectorAll(".scratch-block").forEach(window.CodingManUI.removeBlock);
            this.status.textContent = "";
            this.start();
        }

        later(callback, delay) {
            const timer = setTimeout(() => {
                this.timeouts.delete(timer);
                callback();
            }, delay);
            this.timeouts.add(timer);
            return timer;
        }

        stop() {
            clearInterval(this.enemyTimer);
            clearInterval(this.repeatTimer);
            this.timeouts.forEach(clearTimeout);
            this.timeouts.clear();
            this.effects.clear();
            this.challenge?.stop();
            this.program?.stop();
            this.commands?.reset();
        }

        center(actor) {
            return this.stage.mode === "vertical"
                ? { x: actor.x + actor.radius, y: actor.y + actor.radius }
                : { x: actor.x + 50, y: 50 - actor.y };
        }

        render() {
            for (const actor of Object.values(this.actors)) {
                const vertical = this.stage.mode === "vertical";
                const min = vertical ? 0 : -45;
                const max = vertical ? 90 : 45;
                actor.x = Math.max(min, Math.min(max, actor.x));
                actor.y = Math.max(min, Math.min(max, actor.y));
                const center = this.center(actor);
                actor.element.style.left = center.x - actor.radius + "%";
                actor.element.style.top = center.y - actor.radius + "%";
                actor.element.style.width = actor.element.style.height = actor.radius * 2 + "%";
                actor.element.style.fontSize = actor.radius * 1.6 + "cqw";
                actor.element.style.transform = "rotate(" + (vertical ? (actor === this.actors.char ? 0 : 180) : actor.direction) + "deg)";
            }
            this.challenge?.render();
        }

        move(key) {
            const actor = this.actors.char;
            if (this.stage.mode === "vertical") {
                if (key === "ArrowLeft") actor.x--;
                else if (key === "ArrowUp") actor.y--;
                else if (key === "ArrowRight") actor.x++;
                else if (key === "ArrowDown") actor.y++;
            } else {
                if (key === "ArrowLeft") actor.direction -= 10;
                else if (key === "ArrowRight") actor.direction += 10;
                else if (key === "ArrowUp" || key === "ArrowDown") {
                    const sign = key === "ArrowUp" ? 1 : -1;
                    actor.x += sign * Math.sin(actor.direction / 180 * Math.PI);
                    actor.y += sign * Math.cos(actor.direction / 180 * Math.PI);
                }
            }
            this.render();
        }

        randomizeEnemy() {
            const actor = this.actors.bug;
            actor.x = (100 - actor.radius * 2) * Math.random();
            this.render();
        }

        motion(action, id, log = true, value) {
            const actor = this.actors[id];
            const player = this.actors.char;
            const enemy = this.actors.bug;
            switch (action) {
                case "random":
                    actor.x = 45 * (2 * Math.random() - 1);
                    actor.y = 45 * (2 * Math.random() - 1);
                    break;
                case "point": {
                    const target = id === "char" ? enemy : player;
                    actor.direction = Math.atan2(target.x - actor.x, target.y - actor.y) / Math.PI * 180;
                    break;
                }
                case "move1":
                case "move2":
                case "move": {
                    const distance = action === "move" ? Math.max(-100, Math.min(100, value ?? 10)) : action === "move1" ? 10 : -10;
                    actor.x += distance * Math.sin(actor.direction / 180 * Math.PI);
                    actor.y += distance * Math.cos(actor.direction / 180 * Math.PI);
                    break;
                }
                case "bounce":
                    actor.x = Math.max(-45, Math.min(45, actor.x));
                    actor.y = Math.max(-45, Math.min(45, actor.y));
                    break;
                case "clock": actor.direction += 45; break;
                case "counter_clock": actor.direction -= 45; break;
                case "turn": actor.direction += (value ?? 45) % 360; break;
            }
            if (id === "bug") this.program?.emit("bug", "move");
            if (id === "bug" && log) this.message(app.motionMessages[action], "motion");
            this.render();
        }

        looks(action, id, log = true, value = 50) {
            const actor = this.actors[id];
            const element = actor.element;
            if (action === "size") {
                actor.radius = Math.max(1, Math.min(100, value)) / 100 * 5;
                element.classList.add("is-small");
                this.render();
                if (log) this.message(`set size to ${Math.max(1, Math.min(100, value))}%`, "looks");
                this.later(() => {
                    actor.radius = 5;
                    element.classList.remove("is-small");
                    this.render();
                    this.message("set size to 100%", "looks");
                }, 1000);
            } else if (action === "hide") {
                if (id === "bug") this.program?.emit("bug", "hide");
                element.style.display = "none";
                if (log) this.message("hide", "looks");
                this.later(() => {
                    element.style.display = "flex";
                    if (log) this.message("show", "looks");
                }, 1000);
            }
        }

        message(text, type) {
            const element = window.CodingManUI.blockMessage(text, type);
            this.log.appendChild(element);
            this.later(() => window.CodingManUI.removeBlock(element), 1500);
        }

        damage(id, amount = 1) {
            const actor = this.actors[id];
            const dealt = this.challenge ? this.challenge.adjustDamage(id, amount) : amount;
            actor.life = Math.max(0, actor.life - dealt);
            actor.lifeBar.style.width = actor.life / actor.maxLife * 100 + "%";
            actor.lifeBar.setAttribute("aria-valuenow", actor.life);
            this.challenge?.afterDamage();
            if (dealt > 0 && actor.life > 0) this.program?.emit("attacked", id);
            return dealt;
        }

        checkGameOver() {
            const lost = this.actors.char.life === 0;
            if (!lost && this.actors.bug.life !== 0) return;
            this.status.textContent = lost ? "YOU LOSE · Enter로 다시 도전하세요" : this.stage.number === 10 ? "ALL CLEAR · Enter로 엔딩 보기" : "YOU WIN · Enter로 다음 단계";
            this.playing = false;
            document.body.classList.add("game-ended");
            this.stop();
            this.buttons[lost ? "restart" : "nextlevel"].style.display = "inline";
        }

        repeatEnemyMovement() {
            this.motion("move1", "bug", false);
            this.motion("bounce", "bug", false);
            this.later(() => {
                this.motion("move2", "bug", false);
                this.motion("bounce", "bug", false);
            }, 300);
        }

        startControlStage() {
            this.render();
            for (const [text, type] of [
                ["forever", "control"],
                ["move 10 steps <<<", "motion"],
                ["if on edge, bounce <<<", "motion"],
                ["wait 0.3 seconds <<<", "control"],
                ["move -10 steps <<<", "motion"],
                ["if on edge, bounce <<<", "motion"],
                ["wait 0.3 seconds <<<", "control"]
            ]) this.message(text, type);
        }
    }

    app.Game = Game;
}(window.CodingMan));
