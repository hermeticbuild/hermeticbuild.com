export function startReplay(replay, { duration, renderInterval, render, completionMessage }) {
  const surface = replay.querySelector('.build-surface');
  const status = replay.querySelector('[role="status"]');
  let frame;
  let elapsed = 0;
  let startedAt = null;

  function complete() {
    startedAt = null;
    elapsed = duration;
    render(elapsed);
    surface.setAttribute('aria-label', 'Replay UEFI build');
    status.textContent = completionMessage;
  }

  function play(from) {
    elapsed = from;
    startedAt = performance.now() - from;
    surface.setAttribute('aria-label', 'Pause UEFI build replay');
    status.textContent = from ? 'UEFI build replay resumed.' : 'UEFI build replay started.';
    render(from);
    let lastRender = from;

    function tick(now) {
      elapsed = now - startedAt;
      if (elapsed >= duration) {
        complete();
        return;
      }
      if (elapsed - lastRender >= renderInterval) {
        render(elapsed);
        lastRender = elapsed;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  surface.addEventListener('click', () => {
    if (startedAt !== null) {
      cancelAnimationFrame(frame);
      elapsed = performance.now() - startedAt;
      if (elapsed < duration) {
        startedAt = null;
        render(elapsed);
        surface.setAttribute('aria-label', 'Resume UEFI build replay');
        status.textContent = 'UEFI build replay paused.';
        return;
      }
    }
    play(elapsed < duration ? elapsed : 0);
  });

  replay.hidden = false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    complete();
  } else {
    play(0);
  }
}
