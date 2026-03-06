import { Container, Graphics } from "pixi.js";
import type { AgentStatus } from "../../shared/types.js";
import type { AgentSprite } from "./AgentSprite.js";
import type { Particles } from "./Particles.js";

interface AnimationState {
  status: AgentStatus;
  elapsed: number;
  visuals: Container;
  extras: Record<string, unknown>;
}

type AgentLookup = (id: string) => AgentSprite | undefined;

const CODE_COLORS = [0x2ecc71, 0x3498db, 0xf39c12, 0xe74c3c];

export class AnimationManager {
  private animations: Map<string, AnimationState> = new Map();
  private particles: Particles;
  private getAgent: AgentLookup;

  constructor(particles: Particles, getAgent: AgentLookup) {
    this.particles = particles;
    this.getAgent = getAgent;
  }

  startAnimation(
    agentId: string,
    status: AgentStatus,
    params: {
      talkingTo?: string | null;
      targetX?: number;
      targetY?: number;
      nextStatus?: AgentStatus;
      returnX?: number;
      returnY?: number;
    } = {},
  ): void {
    this.stopAnimation(agentId);

    const sprite = this.getAgent(agentId);
    if (!sprite) return;

    const visuals = new Container();
    sprite.addChild(visuals);

    const state: AnimationState = {
      status,
      elapsed: 0,
      visuals,
      extras: { ...params },
    };

    if (status === "thinking") {
      this.buildThinkingBubble(visuals);
    } else if (status === "coding") {
      this.buildCodingHands(visuals);
    } else if (status === "reviewing") {
      this.buildMagnifyingGlass(visuals);
    } else if (status === "talking") {
      this.buildSpeechBubble(visuals);
      if (params.talkingTo) {
        state.extras.talkingTo = params.talkingTo;
        state.extras.dashedLine = this.buildDashedLineContainer(sprite.parent as Container);
      }
    } else if (status === "walking") {
      state.extras.originX = sprite.x;
      state.extras.originY = sprite.y;
      sprite.setWalking(true);
    }

    this.animations.set(agentId, state);
  }

  stopAnimation(agentId: string): void {
    const state = this.animations.get(agentId);
    if (!state) return;

    const sprite = this.getAgent(agentId);
    if (sprite) {
      sprite.removeChild(state.visuals);
      state.visuals.destroy({ children: true });
      sprite.scale.set(1);
      if (state.status === "walking") {
        sprite.setWalking(false);
      }
    }

    const dashedLine = state.extras.dashedLine as Container | undefined;
    if (dashedLine) {
      dashedLine.parent?.removeChild(dashedLine);
      dashedLine.destroy({ children: true });
    }

    this.animations.delete(agentId);
  }

  stopAll(): void {
    for (const id of [...this.animations.keys()]) {
      this.stopAnimation(id);
    }
  }

  isAnimating(agentId: string, status?: AgentStatus): boolean {
    const state = this.animations.get(agentId);
    if (!state) return false;
    if (status !== undefined) return state.status === status;
    return true;
  }

  update(delta: number): void {
    for (const [agentId, state] of this.animations) {
      state.elapsed += delta;
      const sprite = this.getAgent(agentId);
      if (!sprite) continue;

      switch (state.status) {
        case "idle":
          this.updateIdle(sprite, state);
          break;
        case "thinking":
          this.updateThinking(sprite, state);
          break;
        case "coding":
          this.updateCoding(sprite, state);
          break;
        case "reviewing":
          this.updateReviewing(state);
          break;
        case "talking":
          this.updateTalking(sprite, state);
          break;
        case "walking":
          this.updateWalking(agentId, sprite, state);
          break;
      }
    }
  }

  private updateIdle(sprite: AgentSprite, state: AnimationState): void {
    const breathCycle = (state.elapsed % 180) / 180;
    const scale = 1.0 + 0.02 * Math.sin(breathCycle * Math.PI * 2);
    sprite.scale.set(scale);
  }

  // --- Thinking ---

  private buildThinkingBubble(container: Container): void {
    const bubble = new Graphics();
    // Bubble body
    bubble.rect(-12, -34, 24, 12);
    bubble.fill({ color: 0xffffff, alpha: 0.85 });
    // Connecting circles
    bubble.rect(-3, -22, 3, 3);
    bubble.fill({ color: 0xffffff, alpha: 0.85 });
    bubble.rect(-1, -19, 2, 2);
    bubble.fill({ color: 0xffffff, alpha: 0.85 });
    container.addChild(bubble);

    const dots: Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const dot = new Graphics();
      dot.rect(-1, -1, 2, 2);
      dot.fill(0x555555);
      dot.x = -6 + i * 6;
      dot.y = -28;
      dot.alpha = 0;
      container.addChild(dot);
      dots.push(dot);
    }
    (container as Container & { _dots?: Graphics[] })._dots = dots;
  }

  private updateThinking(sprite: AgentSprite, state: AnimationState): void {
    const dots = (state.visuals as Container & { _dots?: Graphics[] })._dots;
    if (dots) {
      const cycle = (state.elapsed % 90) / 90;
      for (let i = 0; i < 3; i++) {
        const dotPhase = (cycle - i * 0.2 + 1) % 1;
        dots[i].alpha = dotPhase < 0.5 ? dotPhase * 2 : Math.max(0, 2 - dotPhase * 2);
      }
    }

    // Blink status indicator
    const blink = Math.floor(state.elapsed / 30) % 2;
    sprite.alpha = blink === 0 ? 1.0 : 0.92;
  }

  // --- Coding ---

  private buildCodingHands(container: Container): void {
    const leftHand = new Graphics();
    leftHand.rect(-5, 2, 3, 2);
    leftHand.fill(0xddccbb);
    container.addChild(leftHand);

    const rightHand = new Graphics();
    rightHand.rect(2, 2, 3, 2);
    rightHand.fill(0xddccbb);
    container.addChild(rightHand);

    (container as Container & { _hands?: Graphics[] })._hands = [leftHand, rightHand];
  }

  private updateCoding(sprite: AgentSprite, state: AnimationState): void {
    const hands = (state.visuals as Container & { _hands?: Graphics[] })._hands;
    if (hands) {
      const fast = Math.floor(state.elapsed / 9) % 2;
      hands[0].y = fast === 0 ? 0 : 2;
      hands[1].y = fast === 0 ? 2 : 0;
    }

    if (Math.floor(state.elapsed) % 8 === 0) {
      const color = CODE_COLORS[Math.floor(Math.random() * CODE_COLORS.length)];
      const worldPos = sprite.parent?.toLocal({ x: 0, y: -16 }, sprite);
      if (worldPos) {
        this.particles.spawn(worldPos.x, worldPos.y, color, 1);
      }
    }
  }

  // --- Reviewing ---

  private buildMagnifyingGlass(container: Container): void {
    const glass = new Graphics();
    glass.circle(0, 0, 4);
    glass.setStrokeStyle({ width: 1, color: 0xf39c12 });
    glass.stroke();
    glass.moveTo(3, 3);
    glass.lineTo(6, 6);
    glass.setStrokeStyle({ width: 1.5, color: 0xf39c12 });
    glass.stroke();
    glass.y = -26;
    container.addChild(glass);

    (container as Container & { _glass?: Graphics })._glass = glass;
  }

  private updateReviewing(state: AnimationState): void {
    const glass = (state.visuals as Container & { _glass?: Graphics })._glass;
    if (!glass) return;
    const cycle = (state.elapsed % 120) / 120;
    glass.x = Math.sin(cycle * Math.PI * 2) * 10;
  }

  // --- Talking ---

  private buildSpeechBubble(container: Container): void {
    const bubble = new Graphics();
    // Rectangular bubble
    bubble.rect(-12, -34, 24, 12);
    bubble.fill({ color: 0xffffff, alpha: 0.9 });
    // Pointed tail
    bubble.moveTo(-2, -22);
    bubble.lineTo(2, -22);
    bubble.lineTo(0, -19);
    bubble.closePath();
    bubble.fill({ color: 0xffffff, alpha: 0.9 });
    container.addChild(bubble);

    const dots: Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const dot = new Graphics();
      dot.rect(-1, -1, 2, 2);
      dot.fill(0x555555);
      dot.x = -6 + i * 6;
      dot.y = -28;
      dot.alpha = 0;
      container.addChild(dot);
      dots.push(dot);
    }
    (container as Container & { _dots?: Graphics[] })._dots = dots;
  }

  private updateTalking(sprite: AgentSprite, state: AnimationState): void {
    const dots = (state.visuals as Container & { _dots?: Graphics[] })._dots;
    if (dots) {
      const cycle = (state.elapsed % 60) / 60;
      for (let i = 0; i < 3; i++) {
        const dotPhase = (cycle - i * 0.2 + 1) % 1;
        dots[i].alpha = dotPhase < 0.5 ? dotPhase * 2 : Math.max(0, 2 - dotPhase * 2);
      }
    }

    const dashedLine = state.extras.dashedLine as Container | undefined;
    const talkingToId = state.extras.talkingTo as string | undefined;
    if (dashedLine && talkingToId) {
      const target = this.getAgent(talkingToId);
      if (target) {
        this.drawDashedLine(dashedLine, sprite.x, sprite.y, target.x, target.y);
      }
    }
  }

  private buildDashedLineContainer(parent: Container): Container {
    const c = new Container();
    parent.addChild(c);
    return c;
  }

  private drawDashedLine(container: Container, x1: number, y1: number, x2: number, y2: number): void {
    container.removeChildren();

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const dashLen = 4;
    const gapLen = 3;
    const step = dashLen + gapLen;
    const nx = dx / dist;
    const ny = dy / dist;

    for (let d = 0; d < dist; d += step) {
      const endD = Math.min(d + dashLen, dist);
      const dash = new Graphics();
      dash.moveTo(x1 + nx * d, y1 + ny * d);
      dash.lineTo(x1 + nx * endD, y1 + ny * endD);
      dash.setStrokeStyle({ width: 1, color: 0xe67e22, alpha: 0.6 });
      dash.stroke();
      container.addChild(dash);
    }
  }

  // --- Walking ---

  private updateWalking(agentId: string, sprite: AgentSprite, state: AnimationState): void {
    const targetX = state.extras.targetX as number;
    const targetY = state.extras.targetY as number;

    const dx = targetX - sprite.x;
    const dy = targetY - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      sprite.x = targetX;
      sprite.y = targetY;

      const nextStatus = state.extras.nextStatus as AgentStatus | undefined;
      const returnX = state.extras.returnX as number | undefined;
      const returnY = state.extras.returnY as number | undefined;
      const talkingTo = state.extras.talkingTo as string | undefined;
      this.stopAnimation(agentId);

      if (returnX !== undefined && returnY !== undefined) {
        // Walk back to desk after reaching POI
        this.startAnimation(agentId, "walking", {
          targetX: returnX,
          targetY: returnY,
          nextStatus: "idle",
        });
      } else if (nextStatus && nextStatus !== "walking") {
        this.startAnimation(agentId, nextStatus, {
          talkingTo: talkingTo ?? undefined,
        });
      }
      return;
    }

    const speed = 0.8;
    const nx = dx / dist;
    const ny = dy / dist;
    sprite.x += nx * speed;
    sprite.y += ny * speed + Math.sin(state.elapsed * 0.3) * 0.3;
  }
}
