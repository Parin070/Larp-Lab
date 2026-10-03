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

  const keyPressHandlers = {};

  const resetKeys = () => {
    keys.w = false;
    keys.a = false;
    keys.s = false;
    keys.d = false;
    keys.shift = false;
    keys.space = false;
    keys.c = false;
  };

  const onKeyDown = (e) => {
    if (e.code === 'KeyW') keys.w = true;
    if (e.code === 'KeyA') keys.a = true;
    if (e.code === 'KeyS') keys.s = true;
    if (e.code === 'KeyD') keys.d = true;
    if (e.code === 'KeyC') keys.c = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
    if (e.code === 'Space') {
      e.preventDefault();
      keys.space = true;
    }

    // Special key handlers (P, [, ], F4, etc.)
    if (keyPressHandlers[e.code]) {
      keyPressHandlers[e.code](e);
    }
  };

  const onKeyUp = (e) => {
    if (e.code === 'KeyW') keys.w = false;
    if (e.code === 'KeyA') keys.a = false;
    if (e.code === 'KeyS') keys.s = false;
    if (e.code === 'KeyD') keys.d = false;
    if (e.code === 'KeyC') keys.c = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
    if (e.code === 'Space') keys.space = false;
  };

  const onMouseMove = (e) => {
    if (mouse.locked) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    }
  };

  const onPointerLockChange = () => {
    mouse.locked = document.pointerLockElement === canvas;
    if (!mouse.locked) resetKeys();
  };

  const onClick = () => {
    if (!mouse.locked) {
      canvas.requestPointerLock();
    }
  };

  window.addEventListener('blur', resetKeys);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('click', onClick);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return {
    keys,
    mouse,
    onKeyPress(code, handler) {
      keyPressHandlers[code] = handler;
    },
    consumeMouse() {
      const dx = mouse.dx;
      const dy = mouse.dy;
      mouse.dx = 0;
      mouse.dy = 0;
      return { dx, dy };
    },
    dispose() {
      window.removeEventListener('blur', resetKeys);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    }
  };
}
