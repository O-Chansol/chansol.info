(function (app) {
    "use strict";

    // Chapter mechanics own only their state. The shared game owns time and combat.
    class AdvancedBattle {
        constructor(game) {
            this.game = game;
            this.level = game.stage.number;
            this.hud = document.getElementById("mission-state");
            this.feedback = document.getElementById("mission-feedback");
        }

        reset() {
            this.energy = 0;
            this.route = [];
            this.phase = 1;
            this.scanning = false;
            this.scanVersion = 0;
            this.replaying = false;
            this.game.actors.bug.element.classList.toggle("armored", this.level === 8);
            this.game.actors.bug.element.classList.remove("boss-phase-two", "detected");
            this.game.arena.querySelectorAll(".route-marker").forEach(marker => marker.remove());
            this.tell(this.game.stage.objective);
            this.render();
        }

        stop() {
            this.scanning = false;
            this.replaying = false;
            this.game.actors.bug.element.classList.remove("detected");
        }

        distance() {
            const { char, bug } = this.game.actors;
            return Math.hypot(char.x - bug.x, char.y - bug.y);
        }

        tell(text) { this.feedback.textContent = text; }

        render() {
            const items = [this.scanning ? `거리 ${Math.round(this.distance())}` : "감지 T"];
            if (this.level >= 8) items.push(`에너지 ${this.energy}/3`);
            if (this.level >= 9) items.push(`경로 ${this.route.length}/3`);
            if (this.level === 8) items.push("장갑 −1");
            if (this.level === 10) items.push(`페이즈 ${this.phase}/2`);
            this.hud.textContent = items.join(" · ");
            this.hud.dataset.energy = this.energy;
            this.hud.dataset.route = this.route.length;
            this.hud.dataset.phase = this.phase;
        }

        handles(action) {
            return ["scan", "condition", "charge", "record", "replay", "combo"].includes(action);
        }

        execute(action) {
            const minimum = { scan: 6, condition: 7, charge: 8, record: 9, replay: 9, combo: 10 };
            if (this.level < minimum[action]) return false;
            return this[action]();
        }

        scan() {
            const bug = this.game.actors.bug.element;
            const version = ++this.scanVersion;
            this.scanning = true;
            bug.style.display = "flex";
            bug.classList.add("detected");
            this.tell(`버그 발견! 거리 ${Math.round(this.distance())} · 2초간 감지`);
            this.game.message("distance to Bug", "sensing");
            this.render();
            this.game.later(() => {
                if (version !== this.scanVersion) return;
                this.scanning = false;
                bug.classList.remove("detected");
                this.render();
            }, 2000);
            return true;
        }

        condition() {
            const near = this.distance() <= 35;
            this.game.message(`distance ≤ 35 : ${near}`, "operators");
            this.tell(near ? "참! 자동 조준 · 피해 2 공격" : `거짓! 거리 ${Math.round(this.distance())} · 35 안으로 접근하세요`);
            if (!near) return false;
            this.game.motion("point", "char", false);
            this.game.effects.shoot("char", { damage: 2 });
            return true;
        }

        charge() {
            if (this.energy >= 3) {
                this.tell("에너지 가득! F로 조준한 뒤 Space로 발사하세요.");
                return false;
            }
            this.energy++;
            this.game.message("change energy by 1", "variables");
            this.tell(`에너지 ${this.energy}/3 · 다음 기본 공격의 피해 ${1 + this.energy}`);
            this.render();
            return true;
        }

        attackDamage() {
            const damage = 1 + this.energy;
            if (this.energy) this.tell(`에너지 ${this.energy} 사용! 피해 ${damage} 탄환 발사`);
            this.energy = 0;
            this.render();
            return damage;
        }

        adjustDamage(id, amount) {
            if (id === "bug" && this.level === 8) {
                const reduced = Math.max(0, amount - 1);
                this.tell(reduced ? `장갑 관통! 피해 ${reduced}` : "장갑에 막혔어요. H로 충전한 뒤 공격하세요.");
                return reduced;
            }
            return amount;
        }

        afterDamage() {
            if (this.level === 10 && this.phase === 1 && this.game.actors.bug.life <= 9) {
                this.phase = 2;
                this.game.actors.bug.element.classList.add("boss-phase-two");
                this.game.message("if health ≤ 9 then", "control");
                this.tell("페이즈 2! 부채꼴 탄환에 주의하세요. X로 숨거나 저장한 경로로 피하세요.");
                this.render();
            }
        }

        record() {
            const { x, y } = this.game.actors.char;
            if (this.route.length === 3) this.route.shift();
            this.route.push({ x, y });
            this.game.arena.querySelectorAll(".route-marker").forEach(marker => marker.remove());
            this.route.forEach((point, index) => {
                const marker = document.createElement("span");
                marker.className = "route-marker";
                marker.textContent = index + 1;
                marker.style.left = point.x + 50 + "%";
                marker.style.top = 50 - point.y + "%";
                this.game.arena.appendChild(marker);
            });
            this.game.message("add position to route", "lists");
            this.tell(`위치 ${this.route.length} 저장 · 최대 3개, 가득 차면 오래된 위치부터 교체`);
            this.render();
            return true;
        }

        replay() {
            if (!this.route.length || this.replaying) {
                this.tell(this.replaying ? "경로를 실행하는 중이에요." : "먼저 J로 현재 위치를 저장하세요.");
                return false;
            }
            const route = this.route.map(point => ({ ...point }));
            this.replaying = true;
            route.forEach((point, index) => {
                const visit = () => {
                    Object.assign(this.game.actors.char, point);
                    this.game.motion("point", "char", false);
                    this.game.effects.shoot("char");
                    this.tell(`경로 ${index + 1}/${route.length} 실행 · 저장 위치로 이동 후 공격`);
                    this.game.message(`item ${index + 1} of route`, "lists");
                    if (index === route.length - 1) this.replaying = false;
                };
                if (index === 0) visit();
                else this.game.later(visit, index * 450);
            });
            return true;
        }

        combo() {
            this.scan();
            this.energy = 3;
            this.game.message("define debug combo", "myblocks");
            this.game.motion("point", "char", false);
            this.game.effects.shoot("char");
            this.game.motion("move2", "char", false);
            this.tell("debug combo! 감지 → 충전 3 → 조준 → 피해 4 공격 → 후퇴");
            return true;
        }

        enemyTurn() {
            const game = this.game;
            game.turnCount++;
            game.motion("point", "bug", false);
            if (this.level === 7) {
                game.message("if distance < 30 then retreat", "operators");
                game.motion(this.distance() < 30 ? "move2" : "move1", "bug", false);
            } else {
                game.motion(game.turnCount % 2 ? "move1" : "move2", "bug", false);
            }
            game.effects.shoot("bug");
            game.message("point towards character", "motion");
            if (this.level === 6 && !this.scanning) {
                game.looks("hide", "bug");
                game.message("if not detected then hide", "sensing");
            }
            if (this.level === 8) game.message("damage = attack − armor", "variables");
            if (this.level === 9 && game.turnCount % 3 === 0) {
                game.effects.cloneEnemy();
                game.message("add clone to swarm", "lists");
                this.tell("복제 버그 등장! 저장한 경로로 이동하거나 V로 파동을 지우세요.");
            }
            if (this.level === 10) {
                game.message("debug counterattack", "myblocks");
                if (this.phase === 2) {
                    game.effects.shoot("bug", { angle: -22 });
                    game.effects.shoot("bug", { angle: 22 });
                }
                if (game.turnCount % 4 === 0) game.effects.sound("sound", "bug");
            }
        }
    }

    app.AdvancedBattle = AdvancedBattle;
}(window.CodingMan));
