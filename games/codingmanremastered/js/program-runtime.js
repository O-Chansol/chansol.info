(function (app, model) {
    "use strict";
    const TICK = 50;
    const bounded = value => Number.isFinite(value) ? Math.max(-100000, Math.min(100000, value)) : 0;
    class ProgramRunner {
        constructor(game, commands, program, update = () => {}) {
            this.game = game;
            this.commands = commands;
            this.program = structuredClone(program);
            this.update = update;
            this.threads = new Map();
            this.variables = new Map();
            this.lists = new Map();
            this.procedures = new Map(program.scripts.filter(s => s.action === "define").map(s => [s.args.name, s]));
        }
        start() {
            this.stop();
            this.variables.clear(); this.lists.clear();
            this.running = true;
            this.current = "이벤트 대기";
            this.emit("start");
            if (this.program.scripts.some(s => s.action !== "define")) this.timer = setInterval(() => this.tick(), TICK);
            this.report();
        }
        stop() {
            clearInterval(this.timer);
            this.running = false;
            this.threads.clear();
            this.current = "정지";
            this.report();
        }
        report() {
            this.update({ running: this.running, current: this.current, threads: this.threads.size,
                variables: Object.fromEntries(this.variables), lists: Object.fromEntries(this.lists) });
        }
        emit(event, value) {
            if (!this.running || !this.game.playing) return;
            for (const script of this.program.scripts) {
                const match = script.action === event && (event === "start" || script.args[{ key: "key", bug: "event", attacked: "target" }[event]] === value);
                // Repeated events coalesce while that script is still running.
                if (match && !this.threads.has(script.id)) this.threads.set(script.id, { iterator: this.sequence(script.body), wait: 0, pending: null });
            }
        }
        hasKey(code) { return this.program.scripts.some(script => script.action === "key" && script.args.key === code); }
        value(expression) {
            const { char, bug } = this.game.actors;
            const list = this.lists.get(expression.name) || [];
            const sources = {
                number: () => expression.value, variable: () => this.variables.get(expression.name) || 0,
                distance: () => Math.hypot(char.x - bug.x, char.y - bug.y), life: () => char.life, bugLife: () => bug.life,
                energy: () => this.game.challenge?.energy || 0, listLength: () => list.length,
                listItem: () => list[Math.trunc(expression.index) - 1] || 0
            };
            let result = sources[expression.source]();
            const other = expression.operand;
            if (expression.operator === "+") result += other;
            if (expression.operator === "-") result -= other;
            if (expression.operator === "*") result *= other;
            if (expression.operator === "/") result = other ? result / other : 0;
            if (expression.operator === "%") result = other ? result % other : 0;
            return bounded(result);
        }
        predicate(test) {
            const { char, bug } = this.game.actors;
            if (test.sensor === "always") return true;
            if (test.sensor === "never") return false;
            if (test.sensor === "edge") return Math.abs(char.x) >= 45 || Math.abs(char.y) >= 45;
            if (test.sensor === "visible") return bug.element.style.display !== "none";
            if (test.sensor === "touching") return Math.hypot(char.x - bug.x, char.y - bug.y) <= char.radius + bug.radius;
            const a = this.value(test.left), b = this.value(test.right);
            return ({ lt: a < b, lte: a <= b, eq: a === b, gt: a > b, gte: a >= b })[test.comparison];
        }
        condition(test) {
            let result = this.predicate(test);
            if (test.join === "and") result = result && this.predicate(test.other);
            if (test.join === "or") result = result || this.predicate(test.other);
            return test.not ? !result : result;
        }
        *sequence(nodes, depth = 0) {
            if (depth > 12) { yield { kind: "stop" }; return; }
            for (const node of nodes) {
                const { action, args } = node;
                if (action === "repeat") {
                    const count = Math.max(0, Math.min(1000, Math.trunc(this.value(args.value))));
                    for (let i = 0; i < count; i++) { yield { kind: "checkpoint", node }; yield* this.sequence(node.body, depth + 1); }
                } else if (action === "forever" || action === "until") {
                    while (action === "forever" || !this.condition(args.condition)) {
                        yield { kind: "checkpoint", node };
                        yield* this.sequence(node.body, depth + 1);
                    }
                } else if (action === "if" || action === "ifelse") {
                    yield { kind: "checkpoint", node };
                    yield* this.sequence(this.condition(args.condition) ? node.body : node.elseBody || [], depth + 1);
                } else if (action === "waitUntil") {
                    while (!this.condition(args.condition)) yield { kind: "checkpoint", node };
                } else if (action === "call") {
                    yield { kind: "checkpoint", node };
                    const definition = this.procedures.get(args.name);
                    if (definition) yield* this.sequence(definition.body, depth + 1);
                } else if (action === "stop") { yield { kind: "stop", node }; return; }
                else yield { kind: action === "wait" ? "wait" : "command", node };
            }
        }
        execute(node) {
            const { action, args } = node;
            const value = args.value ? this.value(args.value) : undefined;
            if (action === "setVariable") this.variables.set(args.name, value);
            else if (action === "changeVariable") this.variables.set(args.name, bounded((this.variables.get(args.name) || 0) + value));
            else if (action.startsWith("list")) {
                const list = this.lists.get(args.name) || [];
                if (action === "listAdd" && list.length < 64) list.push(value);
                if (action === "listDelete" && value >= 1 && value <= list.length) list.splice(Math.trunc(value) - 1, 1);
                if (action === "listClear") list.length = 0;
                this.lists.set(args.name, list);
            } else return this.commands.perform(action, value);
            return "done";
        }
        tick() {
            if (!this.running || !this.game.playing) return;
            // One yielded operation per script per tick: even empty loops yield control.
            for (const [id, thread] of this.threads) {
                thread.wait -= TICK;
                if (thread.wait > 0) continue;
                let operation = thread.pending;
                if (!operation) {
                    const next = thread.iterator.next();
                    if (next.done) { this.threads.delete(id); continue; }
                    operation = next.value;
                }
                this.current = model.definitions[operation.node?.action]?.label || "정지";
                if (operation.kind === "stop") { this.threads.delete(id); continue; }
                if (operation.kind === "wait") thread.wait = Math.max(TICK, Math.min(60000, this.value(operation.node.args.value) * 1000));
                thread.pending = operation.kind === "command" && this.execute(operation.node) === "busy" ? operation : null;
            }
            if (!this.threads.size) this.current = "이벤트 대기";
            this.report();
        }
    }
    app.ProgramRunner = ProgramRunner;
}(window.CodingMan, window.CodingManProgram));
