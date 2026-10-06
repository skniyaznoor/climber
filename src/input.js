const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const JUMP = ['Space', 'KeyK', 'KeyZ'];

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.listeners = [];

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        this.listeners.forEach((fn) => fn(e.code));
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  onKey(fn) {
    this.listeners.push(fn);
  }

  // Touch buttons map onto the same virtual key codes as the keyboard.
  bindTouch(el, code) {
    const down = (e) => {
      e.preventDefault();
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
      el.classList.add('active');
    };
    const up = (e) => {
      e.preventDefault();
      this.keys.delete(code);
      el.classList.remove('active');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  any(list) { return list.some((k) => this.keys.has(k)); }
  anyPressed(list) { return list.some((k) => this.pressed.has(k)); }

  get x() { return (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0); }
  get y() { return (this.any(UP) ? 1 : 0) - (this.any(DOWN) ? 1 : 0); }
  get up() { return this.any(UP); }
  get down() { return this.any(DOWN); }
  get upPressed() { return this.anyPressed(UP); }
  get downPressed() { return this.anyPressed(DOWN); }
  get jumpPressed() { return this.anyPressed(JUMP); }
  get jumpHeld() { return this.any(JUMP) || this.any(UP); }

  endFrame() {
    this.pressed.clear();
  }
}
