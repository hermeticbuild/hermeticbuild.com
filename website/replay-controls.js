export function startReplay(replay, { viewport, duration, renderInterval, render, completionMessage }) {
  const surface = replay.querySelector('.build-surface');
  const status = replay.querySelector('[role="status"]');
  let frame;
  let elapsed = 0;
  let startedAt = null;
  let resumeOnDesktop = !viewport.matches;

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

  function pause() {
    cancelAnimationFrame(frame);
    elapsed = performance.now() - startedAt;
    if (elapsed >= duration) {
      complete();
      return;
    }
    startedAt = null;
    render(elapsed);
    surface.setAttribute('aria-label', 'Resume UEFI build replay');
    status.textContent = 'UEFI build replay paused.';
  }

  surface.addEventListener('click', () => {
    if (startedAt !== null) {
      pause();
      if (elapsed < duration) return;
    }
    play(elapsed < duration ? elapsed : 0);
  });

  viewport.addEventListener('change', ({ matches }) => {
    if (!matches && startedAt !== null) {
      pause();
      resumeOnDesktop = elapsed < duration;
    } else if (matches && resumeOnDesktop) {
      resumeOnDesktop = false;
      play(elapsed);
    }
  });

  surface.disabled = false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    resumeOnDesktop = false;
    complete();
  } else if (viewport.matches) {
    play(0);
  }
}
