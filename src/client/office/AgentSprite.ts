import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { AGENT_REGISTRY } from "../../shared/agentRegistry.js";
import type { Agent, AgentStatus } from "../../shared/types.js";

export const ROLE_COLORS: Record<string, number> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => [a.role, Number.parseInt(a.color.slice(1), 16)]),
);

const SHIRT_COLORS: Record<string, number> = Object.fromEntries(
  AGENT_REGISTRY.map((a) => [a.role, Number.parseInt(a.shirtColor.slice(1), 16)]),
);

const HAIR_STYLES: Record<string, { color: number; draw: (g: Graphics, x: number, y: number) => void }> = {
  Whip: {
    color: 0x4a2a1a,
    draw: (g, x, y) => {
      g.rect(x - 3, y - 3, 6, 3);
      g.fill(0x4a2a1a);
      g.rect(x - 4, y - 2, 1, 2);
      g.fill(0x4a2a1a);
      g.rect(x + 3, y - 2, 1, 2);
      g.fill(0x4a2a1a);
    },
  },
  devka: {
    color: 0x8a3a1a,
    draw: (g, x, y) => {
      g.rect(x - 3, y - 2, 6, 2);
      g.fill(0x8a3a1a);
      g.rect(x - 2, y - 3, 1, 1);
      g.fill(0x8a3a1a);
      g.rect(x + 0, y - 3, 1, 1);
      g.fill(0x8a3a1a);
      g.rect(x + 2, y - 3, 1, 1);
      g.fill(0x8a3a1a);
    },
  },
  "druhá devka": {
    color: 0x2a2a2a,
    draw: (g, x, y) => {
      g.rect(x - 3, y - 2, 6, 2);
      g.fill(0x2a2a2a);
      g.rect(x + 1, y - 2, 1, 1);
      g.fill(0x4a4a5a);
    },
  },
  Reviewer: {
    color: 0xd4a840,
    draw: (g, x, y) => {
      g.rect(x - 3, y - 2, 6, 2);
      g.fill(0xd4a840);
      g.rect(x - 4, y - 1, 1, 3);
      g.fill(0xd4a840);
      g.rect(x + 3, y - 1, 1, 3);
      g.fill(0xd4a840);
    },
  },
  Sceptic: {
    color: 0xe67e22,
    draw: (g, x, y) => {
      g.rect(x - 3, y - 2, 6, 2);
      g.fill(0xe67e22);
      // Beret
      g.rect(x - 4, y - 4, 8, 2);
      g.fill(0xd35400);
      g.rect(x - 3, y - 5, 6, 1);
      g.fill(0xd35400);
    },
  },
};

export const HAIR_STYLE_ROLES: string[] = Object.keys(HAIR_STYLES);

const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x5a5a5a,
  thinking: 0x3498db,
  coding: 0x2ecc71,
  reviewing: 0xf39c12,
  talking: 0xe67e22,
  walking: 0xffffff,
};

const SKIN = 0xf0c8a0;
const EYE = 0x2a2a2a;

export class AgentSprite extends Container {
  readonly agentId: string;

  private statusIndicator: Graphics;
  private roleLabel: Text;
  private characterGraphic: Graphics;
  private legsGraphic: Graphics | null = null;
  private currentRole: string;
  private currentStatus: AgentStatus;

  constructor(agent: Agent) {
    super();
    this.agentId = agent.id;
    this.currentRole = agent.role;
    this.currentStatus = agent.status;

    this.characterGraphic = this.drawCharacter(agent.role);
    this.addChild(this.characterGraphic);

    this.roleLabel = this.createRoleLabel(agent.role);
    this.addChild(this.roleLabel);

    this.statusIndicator = this.createStatusIndicator(agent.status);
    this.addChild(this.statusIndicator);

    this.drawAccessories(agent.role);

    this.x = agent.positionX;
    this.y = agent.positionY;
  }

  getStatus(): AgentStatus {
    return this.currentStatus;
  }

  getRole(): string {
    return this.currentRole;
  }

  updateData(agent: Agent): void {
    this.currentStatus = agent.status;
    this.updateStatusIndicator(agent.status);

    if (agent.role !== this.currentRole) {
      this.currentRole = agent.role;
      this.roleLabel.text = agent.role;
      this.rebuildCharacter(agent.role);
    }
  }

  private drawCharacter(role: string): Graphics {
    const g = new Graphics();
    const hx = 0;
    const hy = -8;

    // Head (6x6 centered)
    g.rect(hx - 3, hy - 3, 6, 6);
    g.fill(SKIN);
    g.rect(hx - 2, hy - 2, 1, 1);
    g.fill(SKIN);

    // Eyes
    g.rect(hx - 2, hy - 1, 1, 1);
    g.fill(EYE);
    g.rect(hx + 1, hy - 1, 1, 1);
    g.fill(EYE);

    // Hair
    const style = HAIR_STYLES[role];
    if (style) {
      style.draw(g, hx, hy);
    }

    // Body (8x6 seated)
    const shirt = SHIRT_COLORS[role] ?? 0xaaaaaa;
    const armColor = darken(shirt, 0.15);
    const by = hy + 3;

    g.rect(hx - 4, by, 8, 6);
    g.fill(shirt);

    // Arms
    g.rect(hx - 6, by + 1, 2, 4);
    g.fill(armColor);
    g.rect(hx + 4, by + 1, 2, 4);
    g.fill(armColor);

    // Whip tie
    if (role === "Whip") {
      g.rect(hx, by, 1, 3);
      g.fill(0xe74c3c);
    }

    return g;
  }

  private drawAccessories(role: string): void {
    if (role === "Whip") {
      const g = new Graphics();
      g.rect(7, -3, 3, 4);
      g.fill(0xd4c090);
      g.rect(7, -3, 3, 1);
      g.fill(0xb0a070);
      this.addChild(g);
    }
  }

  setWalking(walking: boolean): void {
    if (walking && !this.legsGraphic) {
      this.legsGraphic = this.drawLegs();
      this.addChildAt(this.legsGraphic, 0);
    } else if (!walking && this.legsGraphic) {
      this.removeChild(this.legsGraphic);
      this.legsGraphic.destroy();
      this.legsGraphic = null;
    }
  }

  private drawLegs(): Graphics {
    const g = new Graphics();
    const pants = 0x2a2a4a;
    const shoe = 0x1a1a1a;
    // Left leg
    g.rect(-3, 1, 3, 6);
    g.fill(pants);
    g.rect(-3, 7, 3, 2);
    g.fill(shoe);
    // Right leg
    g.rect(0, 1, 3, 6);
    g.fill(pants);
    g.rect(0, 7, 3, 2);
    g.fill(shoe);
    return g;
  }

  private rebuildCharacter(role: string): void {
    const idx = this.getChildIndex(this.characterGraphic);
    this.removeChild(this.characterGraphic);
    this.characterGraphic.destroy();
    this.characterGraphic = this.drawCharacter(role);
    this.addChildAt(this.characterGraphic, idx);
  }

  private createStatusIndicator(status: AgentStatus): Graphics {
    const g = new Graphics();
    g.rect(-2, -18, 4, 4);
    g.fill(STATUS_COLORS[status]);
    return g;
  }

  private updateStatusIndicator(status: AgentStatus): void {
    this.statusIndicator.clear();
    this.statusIndicator.rect(-2, -18, 4, 4);
    this.statusIndicator.fill(STATUS_COLORS[status]);
  }

  private createRoleLabel(role: string): Text {
    const color = ROLE_COLORS[role] ?? 0x888888;
    const hex = `#${color.toString(16).padStart(6, "0")}`;
    const label = new Text({
      text: role,
      style: new TextStyle({
        fontFamily: "Courier New, monospace",
        fontSize: 8,
        fontWeight: "bold",
        fill: hex,
        align: "center",
        stroke: { color: "#1a1a2e", width: 2 },
      }),
    });
    label.anchor.set(0.5);
    label.alpha = 0.9;
    label.y = -24;
    return label;
  }
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}
