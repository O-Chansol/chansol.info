(function () {
    "use strict";

    const shortcuts = {
        random: ["KeyR", "R"], point: ["KeyF", "F"],
        move1: ["KeyW", "W"], move: ["KeyW", "W"], move2: ["KeyS", "S"],
        bounce: ["KeyB", "B"], clock: ["KeyE", "E"], turn: ["KeyE", "E"],
        counter_clock: ["KeyQ", "Q"], size: ["KeyZ", "Z"], hide: ["KeyX", "X"],
        sound: ["KeyC", "C"], mute: ["KeyV", "V"], attack: ["Space", "Space"],
        scan: ["KeyT", "T"], condition: ["KeyG", "G"], charge: ["KeyH", "H"],
        record: ["KeyJ", "J"], replay: ["KeyK", "K"], combo: ["KeyL", "L"],
        start: ["Digit1", "1"], bug: ["Digit2", "2"], attacked: ["Digit3", "3"],
        key: ["KeyP", "P"], repeat: ["KeyA", "A"], forever: ["KeyD", "D"], wait: ["KeyY", "Y"],
        if: ["KeyI", "I"], ifelse: ["KeyO", "O"], until: ["KeyU", "U"], waitUntil: ["KeyN", "N"], stop: ["Backquote", "`"],
        setVariable: ["Digit4", "4"], changeVariable: ["Digit5", "5"], listAdd: ["Digit6", "6"],
        listDelete: ["Digit7", "7"], listClear: ["Digit8", "8"], define: ["Digit9", "9"], call: ["Digit0", "0"]
    };

    function isTyping(event) {
        return event.isComposing || event.target instanceof Element &&
            Boolean(event.target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function commandFor(event, root = document) {
        if (isTyping(event) || event.altKey || event.ctrlKey || event.metaKey) return null;
        return [...root.querySelectorAll("button[data-action]")].find(button =>
            shortcuts[button.dataset.action]?.[0] === event.code
        ) || null;
    }

    window.CodingManUI = { shortcuts, isTyping, commandFor };
}());
