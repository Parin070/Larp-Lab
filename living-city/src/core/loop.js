export function startLoop(updateFn, renderFn) {
  let lastTime = performance.now();

  function tick(currentTime) {
    let deltaTime = (currentTime - lastTime) / 1000;
    deltaTime = Math.min(deltaTime, 0.1); // Clamp to 0.1s max
    lastTime = currentTime;

    updateFn(deltaTime);
    renderFn(deltaTime);

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
