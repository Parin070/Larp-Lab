export function createInput(canvas) {
  const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    space: false,
    c: false
  };

  const mouse = {
    dx: 0,
    dy: 0,
    locked: false
  };

  const onKeyDown = (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = true;
    if (key === 'shift') keys.shift = true;
    if (key === ' ') keys.space = true;
  };

  const onKeyUp = (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = false;
    if (key === 'shift') keys.shift = false;
    if (key === ' ') keys.space = false;
  };

  const onMouseMove = (e) => {
    if (mouse.locked) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    }
  };

  const onPointerLockChange = () => {
    mouse.locked = document.pointerLockElement === canvas;
  };

  const onClick = () => {
    if (!mouse.locked) {
      canvas.requestPointerLock();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return {
    keys,
    mouse,
    consumeMouse() {
      const dx = mouse.dx;
      const dy = mouse.dy;
      mouse.dx = 0;
      mouse.dy = 0;
      return { dx, dy };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    }
  };
}
