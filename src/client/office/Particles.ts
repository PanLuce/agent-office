import { Container, Graphics } from "pixi.js";

const POOL_SIZE = 100;
const MAX_LIFE = 60;

interface Particle {
  graphic: Graphics;
  vx: number;
  vy: number;
  life: number;
  active: boolean;
}

export class Particles extends Container {
  private pool: Particle[] = [];

  constructor() {
    super();

    for (let i = 0; i < POOL_SIZE; i++) {
      const graphic = new Graphics();
      graphic.visible = false;
      this.addChild(graphic);
      this.pool.push({ graphic, vx: 0, vy: 0, life: 0, active: false });
    }
  }

  spawn(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.pool.find((p) => !p.active);
      if (!particle) return;

      const w = 3 + Math.random() * 3;
      const h = 1 + Math.random() * 2;

      particle.graphic.clear();
      particle.graphic.rect(-w / 2, -h / 2, w, h);
      particle.graphic.fill(color);
      particle.graphic.x = x;
      particle.graphic.y = y;
      particle.graphic.alpha = 1;
      particle.graphic.visible = true;

      particle.vx = Math.random() - 0.5;
      particle.vy = -(0.5 + Math.random());
      particle.life = MAX_LIFE;
      particle.active = true;
    }
  }

  update(): void {
    for (const p of this.pool) {
      if (!p.active) continue;

      p.graphic.x += p.vx;
      p.graphic.y += p.vy;
      p.life--;
      p.graphic.alpha = Math.max(0, p.life / MAX_LIFE);

      if (p.life <= 0) {
        p.active = false;
        p.graphic.visible = false;
      }
    }
  }
}
