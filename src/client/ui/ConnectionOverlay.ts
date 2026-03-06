export class ConnectionOverlay {
  private overlay: HTMLDivElement;
  private visible = false;
  private retryCallback: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
      cursor: pointer;
      font-family: "Courier New", monospace;
    `;

    const content = document.createElement("div");
    content.style.cssText = `
      text-align: center;
      color: #ef4444;
      font-size: 16px;
    `;
    content.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">Disconnected</div>
      <div style="color: #888; font-size: 12px;">Click to retry</div>
    `;
    this.overlay.appendChild(content);

    this.overlay.addEventListener("click", () => {
      this.retryCallback?.();
    });

    document.body.appendChild(this.overlay);
  }

  show(onRetry: () => void): void {
    if (this.visible) return;
    this.visible = true;
    this.retryCallback = onRetry;
    this.overlay.style.display = "flex";
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.retryCallback = null;
    this.overlay.style.display = "none";
  }

  isVisible(): boolean {
    return this.visible;
  }

  triggerRetry(): void {
    this.retryCallback?.();
  }
}
