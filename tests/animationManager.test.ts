import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", () => {
  class MockContainer {
    children: unknown[] = [];
    parent: MockContainer | null = null;
    x = 0;
    y = 0;
    scale = {
      x: 1,
      y: 1,
      set(v: number) {
        this.x = v;
        this.y = v;
      },
    };
    addChild(child: unknown) {
      this.children.push(child);
      (child as MockContainer).parent = this;
    }
    removeChild(child: unknown) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
    }
    removeChildren() {
      this.children = [];
    }
    destroy(_opts?: unknown) {
      this.children = [];
    }
    toLocal(pos: { x: number; y: number }) {
      return pos;
    }
  }

  class MockGraphics extends MockContainer {
    clear() {
      return this;
    }
    rect() {
      return this;
    }
    fill() {
      return this;
    }
    circle() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    closePath() {
      return this;
    }
    setStrokeStyle() {
      return this;
    }
    stroke() {
      return this;
    }
  }

  return { Container: MockContainer, Graphics: MockGraphics };
});

import { Container } from "pixi.js";
import type { AgentSprite } from "../src/client/office/AgentSprite.js";
import { AnimationManager } from "../src/client/office/AnimationManager.js";
import type { AgentStatus } from "../src/shared/types.js";

function createMockSprite(x = 0, y = 0): AgentSprite {
  const sprite = new Container() as unknown as AgentSprite & { setWalking: (w: boolean) => void };
  sprite.x = x;
  sprite.y = y;
  sprite.setWalking = vi.fn();
  return sprite;
}

function createMockParticles() {
  return { spawn: vi.fn(), update: vi.fn() } as never;
}

describe("AnimationManager.isAnimating", () => {
  let manager: AnimationManager;
  let sprite: AgentSprite;

  beforeEach(() => {
    sprite = createMockSprite(100, 100);
    manager = new AnimationManager(createMockParticles(), () => sprite);
  });

  it("should return false for unknown agent", () => {
    expect(manager.isAnimating("nonexistent")).toBe(false);
  });

  it("should return true for an animating agent", () => {
    manager.startAnimation("agent-1", "idle");
    expect(manager.isAnimating("agent-1")).toBe(true);
  });

  it("should return false after stopping animation", () => {
    manager.startAnimation("agent-1", "idle");
    manager.stopAnimation("agent-1");
    expect(manager.isAnimating("agent-1")).toBe(false);
  });

  it("should filter by status when provided", () => {
    manager.startAnimation("agent-1", "thinking");
    expect(manager.isAnimating("agent-1", "thinking")).toBe(true);
    expect(manager.isAnimating("agent-1", "coding")).toBe(false);
  });

  it("should return false after stopAll", () => {
    manager.startAnimation("agent-1", "idle");
    manager.startAnimation("agent-2", "thinking");
    manager.stopAll();
    expect(manager.isAnimating("agent-1")).toBe(false);
    expect(manager.isAnimating("agent-2")).toBe(false);
  });
});

describe("AnimationManager walking transitions", () => {
  it("should trigger return walk when returnX/returnY are set", () => {
    const sprite = createMockSprite(100, 100);
    const manager = new AnimationManager(createMockParticles(), () => sprite);

    manager.startAnimation("agent-1", "walking", {
      targetX: 200,
      targetY: 200,
      nextStatus: "walking" as AgentStatus,
      returnX: 100,
      returnY: 100,
    });

    // Move sprite to target to trigger arrival
    sprite.x = 200;
    sprite.y = 200;
    manager.update(1);

    // After arriving at POI, agent should be walking back
    expect(manager.isAnimating("agent-1", "walking")).toBe(true);
  });

  it("should reach idle after completing return walk", () => {
    const sprite = createMockSprite(100, 100);
    const manager = new AnimationManager(createMockParticles(), () => sprite);

    // First walk: to POI with return
    manager.startAnimation("agent-1", "walking", {
      targetX: 200,
      targetY: 200,
      nextStatus: "walking" as AgentStatus,
      returnX: 100,
      returnY: 100,
    });

    // Arrive at POI
    sprite.x = 200;
    sprite.y = 200;
    manager.update(1);

    // Now walking back - arrive at desk
    sprite.x = 100;
    sprite.y = 100;
    manager.update(1);

    // Should now be in idle animation (the return trip sets nextStatus: "idle")
    expect(manager.isAnimating("agent-1", "idle")).toBe(true);
  });

  it("should pass talkingTo through walking to next status", () => {
    const roomContainer = new Container();
    const sprites = new Map<string, AgentSprite>();
    const spriteA = createMockSprite(100, 100);
    const spriteB = createMockSprite(300, 100);
    // Sprites need a parent for buildDashedLineContainer
    roomContainer.addChild(spriteA as unknown as Container);
    roomContainer.addChild(spriteB as unknown as Container);
    sprites.set("agent-a", spriteA);
    sprites.set("agent-b", spriteB);

    const manager = new AnimationManager(createMockParticles(), (id) => sprites.get(id) as AgentSprite | undefined);

    // Walk to position, then transition to talking with talkingTo
    manager.startAnimation("agent-a", "walking", {
      targetX: 200,
      targetY: 100,
      nextStatus: "talking" as AgentStatus,
      talkingTo: "agent-b",
    });

    // Arrive at target
    spriteA.x = 200;
    spriteA.y = 100;
    manager.update(1);

    // Should now be in talking state
    expect(manager.isAnimating("agent-a", "talking")).toBe(true);
  });

  it("should transition to nextStatus without return when no returnX/returnY", () => {
    const sprite = createMockSprite(100, 100);
    const manager = new AnimationManager(createMockParticles(), () => sprite);

    manager.startAnimation("agent-1", "walking", {
      targetX: 200,
      targetY: 200,
      nextStatus: "thinking" as AgentStatus,
    });

    sprite.x = 200;
    sprite.y = 200;
    manager.update(1);

    expect(manager.isAnimating("agent-1", "thinking")).toBe(true);
  });
});
