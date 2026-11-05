window.addEventListener("keydown", event => {
    if (event.code === "Enter" && !window.CodingManUI.isTyping(event) && !event.ctrlKey && !event.metaKey &&
        !event.target.closest("a, button")) {
        event.preventDefault();
        document.getElementById("start").click();
    }
});
