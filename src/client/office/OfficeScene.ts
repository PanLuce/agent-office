import { Container, Graphics, Text, TextStyle, type Ticker } from "pixi.js";
import { AGENT_REGISTRY } from "../../shared/agentRegistry.js";
import type { Agent, AgentStatus } from "../../shared/types.js";
import { AgentSprite, ROLE_COLORS } from "./AgentSprite.js";
import { AnimationManager } from "./AnimationManager.js";
import { Desk } from "./Desk.js";
import { Particles } from "./Particles.js";
import { Room } from "./Room.js";

const ROOM_WIDTH = 480;
const ROOM_HEIGHT = 320;
const MARGIN = 20;

const DESK_POSITIONS: { x: number; y: number }[] = [
  { x: 90, y: 110 },
  { x: 240, y: 105 },
  { x: 385, y: 112 },
  { x: 95, y: 225 },
  { x: 238, y: 230 },
  { x: 380, y: 222 },
];

const POINTS_OF_INTEREST = [
  { x: 430, y: 40 }, // coffee machine
  { x: 240, y: 50 }, // whiteboard
  { x: 40, y: 50 }, // bookshelf
  { x: 240, y: 300 }, // door
];

const AGENT_SEEDS = [7, 13, 29, 41, 53, 67];

const STATUS_BAR_AGENTS = AGENT_REGISTRY.map((a) => ({
  id: a.id,
  label: a.shortLabel,
  role: a.role,
}));

export class OfficeScene extends Container {
  private room: Room;
  private desks: Map<string, Desk> = new Map();
  private agents: Map<string, AgentSprite> = new Map();
  private agentDeskPositions: Map<string, { x: number; y: number }> = new Map();
  private roomContainer: Container;
  private particles: Particles;
  private animationManager: AnimationManager;
  private highlightGraphic: Graphics | null = null;
  private highlightedAgentId: string | null = null;
  private highlightElapsed = 0;

  // Status bar
  private statusBarContainer: Container;
  private statusBarSquares: Map<string, Graphics> = new Map();
  private agentStatuses: Map<string, AgentStatus> = new Map();

  // Idle wandering
  private idleTimers: Map<string, number> = new Map();

  // Ambient effects
  private coffeeSteamContainer: Container;
  private clockContainer: Container;
  private monitorFlickerElapsed = 0;
  private coffeeSteamParticles: { x: number; y: number; life: number; maxLife: number }[] = [];

  constructor(ticker: Ticker) {
    super();

    this.roomContainer = new Container();
    this.addChild(this.roomContainer);

    this.room = new Room(ROOM_WIDTH, ROOM_HEIGHT);
    this.roomContainer.addChild(this.room);

    this.particles = new Particles();
    this.roomContainer.addChild(this.particles);

    // Coffee steam container (above room elements)
    this.coffeeSteamContainer = new Container();
    this.roomContainer.addChild(this.coffeeSteamContainer);

    // Clock container
    this.clockContainer = new Container();
    this.roomContainer.addChild(this.clockContainer);
    this.drawWallClock();

    this.animationManager = new AnimationManager(this.particles, (id) => this.agents.get(id));

    // Status bar (drawn last, on top)
    this.statusBarContainer = new Container();
    this.roomContainer.addChild(this.statusBarContainer);
    this.drawStatusBar();

    ticker.add((t) => {
      this.animationManager.update(t.deltaTime);
      this.particles.update();
      this.updateHighlight(t.deltaTime);
      this.updateAmbientEffects(t.deltaTime);
      this.updateStatusBarBlink(t.deltaTime);
      this.updateIdleWandering(t.deltaTime);
    });
  }

  populate(agentList: Agent[]): void {
    this.animationManager.stopAll();
    this.clearAgentsAndDesks();

    agentList.forEach((agent, index) => {
      const pos = DESK_POSITIONS[index] ?? { x: 240, y: 160 };

      const desk = new Desk(agent.role, AGENT_SEEDS[index]);
      desk.x = pos.x;
      desk.y = pos.y;
      this.roomContainer.addChild(desk);
      this.desks.set(agent.id, desk);

      const spritePos = { x: pos.x, y: pos.y - 6 };
      this.agentDeskPositions.set(agent.id, spritePos);

      const sprite = new AgentSprite({
        ...agent,
        positionX: spritePos.x,
        positionY: spritePos.y,
      });
      this.roomContainer.addChild(sprite);
      this.agents.set(agent.id, sprite);

      this.agentStatuses.set(agent.id, agent.status);

      this.animationManager.startAnimation(agent.id, agent.status, {
        talkingTo: agent.talkingTo,
      });
    });

    // Keep status bar on top
    this.roomContainer.removeChild(this.statusBarContainer);
    this.roomContainer.addChild(this.statusBarContainer);
  }

  updateAgent(agent: Agent): void {
    const sprite = this.agents.get(agent.id);
    if (!sprite) return;

    const oldStatus = sprite.getStatus();
    sprite.updateData(agent);
    this.agentStatuses.set(agent.id, agent.status);
    this.updateStatusBarSquare(agent.id, agent.status);

    // Auto-dismiss highlight if status changes
    if (this.highlightedAgentId === agent.id && oldStatus !== agent.status) {
      this.clearHighlight();
    }

    const desk = this.desks.get(agent.id);
    if (desk) {
      desk.setLabel(agent.role);
    }

    if (oldStatus === agent.status) return;

    this.animationManager.stopAnimation(agent.id);

    const deskPos = this.agentDeskPositions.get(agent.id);
    const needsWalk =
      deskPos &&
      agent.status !== "walking" &&
      (Math.abs(sprite.x - deskPos.x) > 2 || Math.abs(sprite.y - deskPos.y) > 2);

    if (needsWalk && deskPos) {
      this.animationManager.startAnimation(agent.id, "walking", {
        targetX: deskPos.x,
        targetY: deskPos.y,
        nextStatus: agent.status,
        talkingTo: agent.talkingTo,
      });
    } else if (agent.status === "talking" && agent.talkingTo) {
      const targetSprite = this.agents.get(agent.talkingTo);
      if (targetSprite) {
        const midX = (sprite.x + targetSprite.x) / 2;
        const midY = (sprite.y + targetSprite.y) / 2;
        const dx = sprite.x - targetSprite.x;
        const dy = sprite.y - targetSprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offsetX = dist > 1 ? (dx / dist) * 15 : 0;
        const offsetY = dist > 1 ? (dy / dist) * 15 : 0;

        this.animationManager.startAnimation(agent.id, "walking", {
          targetX: midX + offsetX,
          targetY: midY + offsetY,
          nextStatus: "talking" as AgentStatus,
          talkingTo: agent.talkingTo,
        });
      } else {
        this.animationManager.startAnimation(agent.id, agent.status, {
          talkingTo: agent.talkingTo,
        });
      }
    } else {
      this.animationManager.startAnimation(agent.id, agent.status, {
        talkingTo: agent.talkingTo,
      });
    }
  }

  highlightAgent(agentId: string): void {
    this.clearHighlight();
    this.highlightedAgentId = agentId;
    this.highlightElapsed = 0;

    const sprite = this.agents.get(agentId);
    if (!sprite) return;

    this.highlightGraphic = new Graphics();
    sprite.addChild(this.highlightGraphic);
  }

  clearHighlight(): void {
    if (this.highlightGraphic && this.highlightedAgentId) {
      const sprite = this.agents.get(this.highlightedAgentId);
      if (sprite) {
        sprite.removeChild(this.highlightGraphic);
      }
      this.highlightGraphic.destroy();
      this.highlightGraphic = null;
    }
    this.highlightedAgentId = null;
  }

  getAgentScreenPosition(agentId: string): { x: number; y: number } | null {
    const sprite = this.agents.get(agentId);
    if (!sprite) return null;

    return {
      x: this.roomContainer.x + sprite.x * this.roomContainer.scale.x,
      y: this.roomContainer.y + sprite.y * this.roomContainer.scale.y,
    };
  }

  resize(screenWidth: number, screenHeight: number): void {
    const scaleX = (screenWidth - MARGIN * 2) / ROOM_WIDTH;
    const scaleY = (screenHeight - MARGIN * 2) / ROOM_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const snapped = Math.max(1, Math.floor(scale * 2) / 2);

    this.roomContainer.scale.set(snapped);
    this.roomContainer.x = Math.floor((screenWidth - ROOM_WIDTH * snapped) / 2);
    this.roomContainer.y = Math.floor((screenHeight - ROOM_HEIGHT * snapped) / 2);
  }

  private updateHighlight(delta: number): void {
    if (!this.highlightGraphic || !this.highlightedAgentId) return;

    this.highlightElapsed += delta;
    const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.highlightElapsed * 0.1));
    const sprite = this.agents.get(this.highlightedAgentId);
    if (!sprite) return;

    const role = sprite.getRole();
    const color = ROLE_COLORS[role] ?? 0xffffff;

    this.highlightGraphic.clear();
    this.highlightGraphic.rect(-20, -22, 40, 42);
    this.highlightGraphic.setStrokeStyle({ width: 2, color, alpha });
    this.highlightGraphic.stroke();
  }

  // --- Status Bar ---

  private drawStatusBar(): void {
    const barWidth = STATUS_BAR_AGENTS.length * 12;
    const startX = (ROOM_WIDTH - barWidth) / 2;
    const barY = 2;

    // Background
    const bg = new Graphics();
    bg.rect(startX - 4, barY, barWidth + 8, 16);
    bg.fill({ color: 0x000000, alpha: 0.3 });
    this.statusBarContainer.addChild(bg);

    for (let i = 0; i < STATUS_BAR_AGENTS.length; i++) {
      const info = STATUS_BAR_AGENTS[i];
      const x = startX + i * 12;

      const square = new Graphics();
      const roleColor = ROLE_COLORS[info.role] ?? 0x888888;
      square.rect(x, barY + 1, 8, 8);
      square.fill({ color: roleColor, alpha: 0.3 });
      square.rect(x, barY + 1, 8, 8);
      square.setStrokeStyle({ width: 1, color: 0x111111 });
      square.stroke();
      this.statusBarContainer.addChild(square);
      this.statusBarSquares.set(info.id, square);

      const label = new Text({
        text: info.label,
        style: new TextStyle({
          fontFamily: "Courier New, monospace",
          fontSize: 5,
          fill: "#888888",
          align: "center",
        }),
      });
      label.x = x + 4;
      label.y = barY + 11;
      label.anchor.set(0.5, 0);
      this.statusBarContainer.addChild(label);
    }
  }

  private updateStatusBarSquare(agentId: string, status: AgentStatus): void {
    const square = this.statusBarSquares.get(agentId);
    if (!square) return;

    const info = STATUS_BAR_AGENTS.find((a) => a.id === agentId);
    if (!info) return;

    const barX = (ROOM_WIDTH - STATUS_BAR_AGENTS.length * 12) / 2;
    const idx = STATUS_BAR_AGENTS.indexOf(info);
    const x = barX + idx * 12;

    const roleColor = ROLE_COLORS[info.role] ?? 0x888888;
    const isActive = status !== "idle";
    const fillAlpha = isActive ? 1.0 : 0.3;
    const fillColor = status === "idle" ? roleColor : roleColor;

    square.clear();
    square.rect(x, 3, 8, 8);
    square.fill({ color: fillColor, alpha: fillAlpha });
    square.rect(x, 3, 8, 8);
    square.setStrokeStyle({ width: 1, color: 0x111111 });
    square.stroke();
  }

  private statusBarBlinkElapsed = 0;

  private updateStatusBarBlink(delta: number): void {
    this.statusBarBlinkElapsed += delta;

    for (const [agentId, status] of this.agentStatuses) {
      if (status !== "thinking") continue;
      const square = this.statusBarSquares.get(agentId);
      if (!square) continue;
      const blink = Math.sin(this.statusBarBlinkElapsed * 0.15) > 0;
      square.alpha = blink ? 1.0 : 0.5;
    }
  }

  // --- Ambient Effects ---

  private drawWallClock(): void {
    const g = new Graphics();
    const cx = ROOM_WIDTH / 2 + 80;
    const cy = 14;
    // Clock face
    g.circle(cx, cy, 6);
    g.fill(0xf0f0f0);
    g.circle(cx, cy, 6);
    g.setStrokeStyle({ width: 1, color: 0x5a5a5a });
    g.stroke();
    // Center dot
    g.circle(cx, cy, 1);
    g.fill(0x2a2a2a);
    this.clockContainer.addChild(g);
  }

  private updateAmbientEffects(delta: number): void {
    this.monitorFlickerElapsed += delta;
    this.updateCoffeeSteam(delta);
    this.updateClockHands();
    this.updateMonitorFlicker();
  }

  private updateCoffeeSteam(_delta: number): void {
    // Coffee machine position in room space
    const cx = ROOM_WIDTH - 8 - 36 + 10;
    const cy = 8 + 12 - 24 - 4;

    // Spawn a new steam particle occasionally
    if (Math.random() < 0.05) {
      this.coffeeSteamParticles.push({
        x: cx + Math.random() * 4 - 2,
        y: cy,
        life: 0,
        maxLife: 30 + Math.random() * 20,
      });
    }

    // Update and draw
    this.coffeeSteamContainer.removeChildren();
    const g = new Graphics();

    this.coffeeSteamParticles = this.coffeeSteamParticles.filter((p) => {
      p.life++;
      p.y -= 0.3;
      p.x += (Math.random() - 0.5) * 0.3;
      if (p.life >= p.maxLife) return false;

      const alpha = 0.3 * (1 - p.life / p.maxLife);
      g.rect(p.x, p.y, 2, 1);
      g.fill({ color: 0xffffff, alpha });
      return true;
    });

    // Cap particle count
    if (this.coffeeSteamParticles.length > 20) {
      this.coffeeSteamParticles.splice(0, this.coffeeSteamParticles.length - 20);
    }

    this.coffeeSteamContainer.addChild(g);
  }

  private updateClockHands(): void {
    if (this.clockContainer.children.length < 1) return;

    // Remove old hand graphics (keep the face at index 0)
    while (this.clockContainer.children.length > 1) {
      const child = this.clockContainer.children[1];
      this.clockContainer.removeChild(child);
      child.destroy();
    }

    const cx = ROOM_WIDTH / 2 + 80;
    const cy = 14;
    const now = new Date();

    const g = new Graphics();

    // Minute hand
    const minuteAngle = (now.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(minuteAngle) * 4, cy + Math.sin(minuteAngle) * 4);
    g.setStrokeStyle({ width: 0.5, color: 0x2a2a2a });
    g.stroke();

    // Hour hand
    const hourAngle = ((now.getHours() % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(hourAngle) * 3, cy + Math.sin(hourAngle) * 3);
    g.setStrokeStyle({ width: 1, color: 0x2a2a2a });
    g.stroke();

    this.clockContainer.addChild(g);
  }

  private updateMonitorFlicker(): void {
    // Subtle random flicker on desks' monitors at low frequency
    if (Math.floor(this.monitorFlickerElapsed) % 120 !== 0) return;

    for (const sprite of this.agents.values()) {
      if (Math.random() < 0.1) {
        sprite.alpha = 0.97;
        setTimeout(() => {
          sprite.alpha = 1.0;
        }, 50);
      }
    }
  }

  private updateIdleWandering(delta: number): void {
    for (const [agentId, status] of this.agentStatuses) {
      if (status !== "idle") {
        this.idleTimers.delete(agentId);
        continue;
      }

      if (this.animationManager.isAnimating(agentId, "walking")) continue;

      const timer = (this.idleTimers.get(agentId) ?? 0) + delta;
      this.idleTimers.set(agentId, timer);

      // Wait at least 900 frames (~15s at 60fps), then ~0.1% chance per frame
      if (timer < 900) continue;
      if (Math.random() > 0.001) continue;

      const deskPos = this.agentDeskPositions.get(agentId);
      if (!deskPos) continue;

      const sprite = this.agents.get(agentId);
      if (!sprite) continue;

      // Only trigger if agent is at desk
      if (Math.abs(sprite.x - deskPos.x) > 2 || Math.abs(sprite.y - deskPos.y) > 2) continue;

      const poi = POINTS_OF_INTEREST[Math.floor(Math.random() * POINTS_OF_INTEREST.length)];
      this.idleTimers.set(agentId, 0);

      this.animationManager.stopAnimation(agentId);
      this.animationManager.startAnimation(agentId, "walking", {
        targetX: poi.x,
        targetY: poi.y,
        nextStatus: "walking" as AgentStatus,
        returnX: deskPos.x,
        returnY: deskPos.y,
      });
    }
  }

  private clearAgentsAndDesks(): void {
    for (const sprite of this.agents.values()) {
      this.roomContainer.removeChild(sprite);
      sprite.destroy();
    }
    for (const desk of this.desks.values()) {
      this.roomContainer.removeChild(desk);
      desk.destroy();
    }
    this.agents.clear();
    this.desks.clear();
    this.agentDeskPositions.clear();
    this.agentStatuses.clear();
    this.idleTimers.clear();
  }
}
