(() => {
  const overlay = document.createElement("div");
  overlay.className = "click-loader";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-label", "読み込み中");
  overlay.setAttribute("aria-live", "polite");

  const frame = document.createElement("iframe");
  frame.src = "loader.html";
  frame.title = "読み込み中";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  overlay.append(frame);
  document.body.append(overlay);

  let hideTimer;
  let pending = 0;
  let transitionVisible = false;

  function updateVisibility() {
    overlay.hidden = pending === 0 && !transitionVisible;
  }

  function showTransition() {
    transitionVisible = true;
    overlay.hidden = false;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      transitionVisible = false;
      updateVisibility();
    }, 650);
  }

  function start() {
    pending += 1;
    updateVisibility();
    const startedAt = Date.now();
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      window.setTimeout(() => {
        pending -= 1;
        updateVisibility();
      }, Math.max(0, 400 - (Date.now() - startedAt)));
    };
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const navigation = event.target.closest(
      "[data-open], button[data-article], button[data-category], #browse-help, #app-home, #app-back, #sign-in, .history-item, .admin-thread, a[href]:not([href^='#'])"
    );
    if (!navigation || navigation.matches(":disabled")) return;
    showTransition();
  }, true);

  window.ClickLoader = Object.freeze({ start });
})();
