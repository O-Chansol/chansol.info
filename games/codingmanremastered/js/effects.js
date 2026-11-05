(function (app) {
    "use strict";

    // All positions and radii use the square arena's 0–100 coordinate system.
    class Effects {
        constructor(game) {
            this.game = game;
            this.active = new Map();
        }

        create(owner, wave = false) {
            const element = document.createElement("div");
            element.className = "effect";
            Object.assign(element.style, { position: "absolute", borderRadius: "50%", pointerEvents: "none" });
            if (wave) element.style.border = "2px solid gray";
            else element.style.backgroundColor = owner === "char" ? "rgb(0, 255, 0)" : "rgb(255, 0, 0)";
            this.game.arena.appendChild(element);
            return element;
        }

        draw(element, x, y, radius) {
            Object.assign(element.style, {
                width: radius * 2 + "%", height: radius * 2 + "%",
                left: x - radius + "%", top: y - radius + "%"
            });
        }

        remove(element) {
            clearInterval(this.active.get(element));
            this.active.delete(element);
            element.remove();
        }

        clear() {
            for (const element of this.active.keys()) this.remove(element);
            this.game.arena.querySelectorAll(".enemy-clone").forEach(clone => clone.remove());
        }

        canHit(id) {
            return this.game.playing && this.game.actors[id].element.style.display !== "none";
        }

        shoot(owner, options = {}) {
            const game = this.game;
            if (owner === "bug") game.program?.emit("bug", "attack");
            const damage = options.damage ?? (owner === "char" ? game.challenge?.attackDamage() ?? 1 : 1);
            const actor = game.actors[owner];
            const targetId = owner === "char" ? "bug" : "char";
            const target = game.actors[targetId];
            const origin = game.center(actor);
            let { x, y } = origin;
            let dx = 0;
            let dy = owner === "char" ? -1 : 1;
            if (game.stage.mode !== "vertical") {
                if (owner === "char") {
                    dx = Math.sin(actor.direction / 180 * Math.PI);
                    dy = -Math.cos(actor.direction / 180 * Math.PI);
                } else {
                    const aim = game.center(target);
                    const length = Math.hypot(aim.x - x, aim.y - y) || 1;
                    dx = (aim.x - x) / length;
                    dy = (aim.y - y) / length;
                }
            }
            if (options.angle) {
                const angle = options.angle * Math.PI / 180;
                [dx, dy] = [dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle)];
            }
            const element = this.create(owner);
            element.dataset.effect = "projectile";
            element.dataset.damage = damage;
            if (damage > 1) element.classList.add("charged-shot");
            this.draw(element, x, y, 1);
            const timer = setInterval(() => {
                x += dx;
                y += dy;
                this.draw(element, x, y, 1);
                const center = game.center(target);
                if (Math.hypot(x - center.x, y - center.y) <= 1 + target.radius && this.canHit(targetId)) {
                    game.damage(targetId, damage);
                    app.onProjectileHit(game, owner);
                    this.remove(element);
                    game.checkGameOver();
                    if (game.playing && game.stage.mode === "vertical" && owner === "char") game.randomizeEnemy();
                } else if (x <= -1 || x >= 101 || y <= -1 || y >= 101) this.remove(element);
            }, game.stage.projectileInterval);
            this.active.set(element, timer);
        }

        sound(action, owner, log = true) {
            const game = this.game;
            if (action === "mute") {
                game.muted = true;
                game.later(() => { game.muted = false; }, 25);
                return;
            }
            const element = this.create(owner, true);
            if (owner === "bug") game.program?.emit("bug", "sound");
            element.dataset.effect = "wave";
            const center = game.center(game.actors[owner]);
            let radius = 1;
            this.draw(element, center.x, center.y, radius);
            const targetId = owner === "char" ? "bug" : "char";
            if (owner === "bug" && log) game.message("start sound", "sound");
            const timer = setInterval(() => {
                radius++;
                this.draw(element, center.x, center.y, radius);
                const target = game.actors[targetId];
                const point = game.center(target);
                if (Math.hypot(center.x - point.x, center.y - point.y) <= radius + target.radius && this.canHit(targetId)) {
                    game.damage(targetId);
                    app.onSoundHit(game, owner);
                    this.remove(element);
                    game.checkGameOver();
                } else if (game.muted || !game.playing || radius > 150) this.remove(element);
            }, 25);
            this.active.set(element, timer);
        }

        cloneEnemy() {
            const game = this.game;
            const enemy = game.actors.bug;
            const clone = enemy.element.cloneNode(true);
            clone.removeAttribute("id");
            clone.classList.add("enemy-clone");
            clone.setAttribute("aria-hidden", "true");
            game.arena.appendChild(clone);
            clone.style.display = "flex";
            clone.style.left = 90 * Math.random() + "%";
            clone.style.top = 90 * Math.random() + "%";
            const x = Number.parseFloat(clone.style.left) - 45;
            const y = 45 - Number.parseFloat(clone.style.top);
            clone.style.transform = "rotate(" + Math.atan2(game.actors.char.x - x, game.actors.char.y - y) / Math.PI * 180 + "deg)";
            game.message("create clone of myself", "control");
            game.message("when I start as a clone", "control");
            const original = { x: enemy.x, y: enemy.y };
            enemy.x = x;
            enemy.y = y;
            this.sound("sound", "bug");
            Object.assign(enemy, original);
            game.later(() => {
                clone.remove();
                game.message("delete this clone", "control");
            }, 1500);
        }
    }

    app.Effects = Effects;
}(window.CodingMan));
