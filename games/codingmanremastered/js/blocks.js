(function (ui) {
    "use strict";

    const svgNS = "http://www.w3.org/2000/svg";
    const categories = ["motion", "looks", "sound", "event", "control", "myblocks", "sensing", "operators", "variables", "lists"];

    // Scratch 3 stack geometry: 4px corners, a 36px connector, and an 8px notch.
    // Draw at the measured size so connectors and corners never stretch with text.
    function outline(width, height, shape) {
        const w = Math.max(width, 84);
        if (shape === "reporter") return `M ${height / 2} 0 H ${w - height / 2} A ${height / 2} ${height / 2} 0 0 1 ${w - height / 2} ${height} H ${height / 2} A ${height / 2} ${height / 2} 0 0 1 ${height / 2} 0 Z`;
        if (shape === "boolean") return `M 0 ${height / 2} L 18 0 H ${w - 18} L ${w} ${height / 2} L ${w - 18} ${height} H 18 Z`;
        const bottom = height - 8;
        const top = shape === "hat"
            ? "M 0 16 C 20 -4 60 -4 80 16 H " + (w - 4)
            : "M 0 4 A 4 4 0 0 1 4 0 H 12 C 14 0 15 1 16 2 L 20 6 C 21 7 22 8 24 8 H 36 C 38 8 39 7 40 6 L 44 2 C 45 1 46 0 48 0 H " + (w - 4);
        const start = top + " A 4 4 0 0 1 " + w + " " + (shape === "hat" ? 20 : 4);
        if (shape === "c") return start
            + " V 32 A 4 4 0 0 1 " + (w - 4) + " 36 H 20 A 4 4 0 0 0 16 40"
            + " V " + (height - 24) + " A 4 4 0 0 0 20 " + (height - 20)
            + " H " + (w - 4) + " A 4 4 0 0 1 " + w + " " + (height - 16)
            + " V " + (height - 4) + " A 4 4 0 0 1 " + (w - 4) + " " + height
            + " H 4 A 4 4 0 0 1 0 " + (height - 4) + " Z";
        if (shape === "cap") return start + " V " + (height - 8) + " Q " + w + " " + height + " " + (w - 8) + " " + height
            + " H 8 Q 0 " + height + " 0 " + (height - 8) + " Z";
        return start
            + " V " + (bottom - 4) + " A 4 4 0 0 1 " + (w - 4) + " " + bottom
            + " H 48 C 46 " + bottom + " 45 " + (bottom + 1) + " 44 " + (bottom + 2)
            + " L 40 " + (bottom + 6) + " C 39 " + (bottom + 7) + " 38 " + (bottom + 8) + " 36 " + (bottom + 8)
            + " H 24 C 22 " + (bottom + 8) + " 21 " + (bottom + 7) + " 20 " + (bottom + 6)
            + " L 16 " + (bottom + 2) + " C 15 " + (bottom + 1) + " 14 " + bottom + " 12 " + bottom
            + " H 4 A 4 4 0 0 1 0 " + (bottom - 4) + " Z";
    }

    const observer = new ResizeObserver(entries => {
        for (const entry of entries) draw(entry.target);
    });

    function draw(block) {
        const svg = block.querySelector(":scope > .block-svg");
        if (!svg) return;
        const width = block.clientWidth;
        const height = block.clientHeight;
        if (!width || !height) return;
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.firstElementChild.setAttribute("d", outline(width, height, block.dataset.shape));
    }

    function addNumberFields(label) {
        for (const node of [...label.childNodes]) {
            if (node.nodeType !== Node.TEXT_NODE || !/\d/.test(node.textContent)) continue;
            const fragment = document.createDocumentFragment();
            for (const part of node.textContent.split(/(-?\d+(?:\.\d+)?%?)/g)) {
                if (/^-?\d/.test(part)) {
                    const field = document.createElement("span");
                    field.className = "block-input";
                    field.textContent = part.replace("%", "");
                    fragment.append(field);
                    if (part.endsWith("%")) fragment.append("%");
                } else fragment.append(part);
            }
            node.replaceWith(fragment);
        }
    }

    function enhance(block) {
        if (block.classList.contains("scratch-block")) {
            observer.observe(block);
            draw(block);
            return block;
        }
        const type = categories.find(category => block.classList.contains(category)) || "motion";
        block.classList.add("scratch-block", type);
        if (type === "event" || block.dataset.shape === "hat") block.dataset.shape = "hat";
        const label = document.createElement("span");
        label.className = "block-label";
        label.append(...block.childNodes);
        addNumberFields(label);
        const svg = document.createElementNS(svgNS, "svg");
        svg.classList.add("block-svg");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.appendChild(document.createElementNS(svgNS, "path"));
        block.append(svg, label);
        const shortcut = ui.shortcuts[block.dataset.action];
        if (shortcut && block.tagName === "BUTTON") {
            const badge = document.createElement("kbd");
            badge.className = "block-key";
            badge.textContent = shortcut[1];
            badge.setAttribute("aria-hidden", "true");
            block.append(badge);
            block.setAttribute("aria-keyshortcuts", shortcut[1]);
            block.title = label.textContent.trim() + " · " + shortcut[1];
        }
        observer.observe(block);
        draw(block);
        return block;
    }

    function message(text, type) {
        const block = document.createElement("div");
        block.className = type;
        block.textContent = text;
        if (/^when\b/.test(text)) block.dataset.shape = "hat";
        else if (text === "forever") block.dataset.shape = "c";
        else if (text === "delete this clone") block.dataset.shape = "cap";
        return enhance(block);
    }

    function enhanceAll(root = document) {
        root.querySelectorAll("button[data-action]").forEach(enhance);
    }

    function removeBlock(block) {
        observer.unobserve(block);
        block.remove();
    }

    Object.assign(ui, { enhance, enhanceAll, blockMessage: message, removeBlock });
}(window.CodingManUI));
