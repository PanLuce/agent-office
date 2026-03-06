import { Container, Graphics, Text, TextStyle } from "pixi.js";

const DW = 32;
const DH = 20;
const FRONT_H = 4;

const SURFACE = 0xc4a060;
const FRONT = 0x8a6a30;
const LEFT_EDGE = 0x9a7a40;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class Desk extends Container {
  private readonly nameLabel: Text;

  constructor(label: string, seed: number = 0) {
    super();
    this.drawDesk();
    this.drawMonitor();
    this.drawKeyboard();
    this.drawChair();
    this.drawRandomItems(seed);
    this.nameLabel = this.createLabel(label);
    this.addChild(this.nameLabel);
  }

  setLabel(name: string): void {
    this.nameLabel.text = name;
  }

  private drawDesk(): void {
    const g = new Graphics();
    // Top surface
    g.rect(-DW / 2, -DH / 2, DW, DH);
    g.fill(SURFACE);
    // Front face (3D depth)
    g.rect(-DW / 2, DH / 2, DW, FRONT_H);
    g.fill(FRONT);
    // Left edge
    g.rect(-DW / 2, -DH / 2, 1, DH + FRONT_H);
    g.fill(LEFT_EDGE);
    this.addChild(g);
  }

  private drawMonitor(): void {
    const g = new Graphics();
    const mx = -6;
    const my = -DH / 2 + 2;
    // Screen border
    g.rect(mx, my, 12, 8);
    g.fill(0x4a4a5a);
    // Screen
    g.rect(mx + 1, my + 1, 10, 6);
    g.fill(0x2a2a3a);
    // Code pixels
    g.rect(mx + 2, my + 2, 2, 1);
    g.fill(0x2ecc71);
    g.rect(mx + 5, my + 2, 3, 1);
    g.fill(0x3498db);
    g.rect(mx + 3, my + 4, 4, 1);
    g.fill(0x2ecc71);
    g.rect(mx + 2, my + 5, 2, 1);
    g.fill(0xf39c12);
    // Stand
    g.rect(mx + 4, my + 8, 4, 3);
    g.fill(0x4a4a4a);
    // Base
    g.rect(mx + 2, my + 11, 8, 2);
    g.fill(0x4a4a4a);
    this.addChild(g);
  }

  private drawKeyboard(): void {
    const g = new Graphics();
    const kx = -5;
    const ky = DH / 2 - 5;
    g.rect(kx, ky, 10, 3);
    g.fill(0xb0b0b0);
    // Key dots
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        g.rect(kx + 1 + c * 2, ky + r * 2, 1, 1);
        g.fill(0x9a9a9a);
      }
    }
    this.addChild(g);
  }

  private drawChair(): void {
    const g = new Graphics();
    const cy = DH / 2 + FRONT_H + 4;
    // Chair back
    g.rect(-5, cy - 2, 10, 4);
    g.fill(0x1a4a2a);
    // Seat
    g.rect(-5, cy + 2, 10, 8);
    g.fill(0x2a5a3a);
    // Legs
    g.rect(-5, cy + 10, 2, 2);
    g.fill(0x3a3a3a);
    g.rect(3, cy + 10, 2, 2);
    g.fill(0x3a3a3a);
    this.addChild(g);
  }

  private drawRandomItems(seed: number): void {
    const rand = seededRandom(seed || 1);
    const count = Math.floor(rand() * 3);

    const items = [() => this.drawMug(rand), () => this.drawPaperStack(rand), () => this.drawPlant(rand)];

    const used = new Set<number>();
    for (let i = 0; i < count; i++) {
      let idx = Math.floor(rand() * items.length);
      while (used.has(idx)) idx = (idx + 1) % items.length;
      used.add(idx);
      items[idx]();
    }
  }

  private drawMug(rand: () => number): void {
    const g = new Graphics();
    const side = rand() > 0.5 ? 1 : -1;
    const mx = side * 12;
    const my = -2;
    const colors = [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60];
    const color = colors[Math.floor(rand() * colors.length)];
    g.rect(mx, my, 4, 5);
    g.fill(color);
    // Handle
    g.rect(mx + 4, my + 1, 1, 3);
    g.fill(color);
    this.addChild(g);
  }

  private drawPaperStack(rand: () => number): void {
    const g = new Graphics();
    const side = rand() > 0.5 ? 10 : -14;
    g.rect(side, -4, 6, 4);
    g.fill(0xf0f0f0);
    // Lines
    g.rect(side + 1, -3, 4, 0.5);
    g.fill(0xcccccc);
    g.rect(side + 1, -1.5, 3, 0.5);
    g.fill(0xcccccc);
    this.addChild(g);
  }

  private drawPlant(rand: () => number): void {
    const g = new Graphics();
    const side = rand() > 0.5 ? 11 : -15;
    // Pot
    g.rect(side, 0, 5, 3);
    g.fill(0x7a5a2a);
    // Green blob
    g.rect(side - 1, -5, 7, 5);
    g.fill(0x3a8a3a);
    g.rect(side, -6, 5, 1);
    g.fill(0x4a9a4a);
    this.addChild(g);
  }

  private createLabel(name: string): Text {
    const label = new Text({
      text: name,
      style: new TextStyle({
        fontFamily: "Courier New, monospace",
        fontSize: 7,
        fill: "#ccccdd",
        align: "center",
      }),
    });
    label.anchor.set(0.5, 0);
    label.y = DH / 2 + FRONT_H + 18;
    return label;
  }
}
