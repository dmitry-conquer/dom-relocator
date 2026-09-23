import DOMRelocator from "../src";

const exampleName = new URLSearchParams(window.location.search).get("example");

const initEmbeddedExample = (name: string): void => {
  const hostPage = document.querySelector<HTMLElement>("[data-host-page]");
  const embeddedPage = document.querySelector<HTMLElement>("[data-embedded-page]");
  const example = document.querySelector<HTMLElement>(`[data-example="${name}"]`);

  if (!hostPage || !embeddedPage || !example) throw new Error(`Unknown demo example: ${name}`);

  hostPage.hidden = true;
  embeddedPage.hidden = false;
  example.hidden = false;

  const item = example.querySelector<HTMLElement>("[data-relocate-to]");
  const status = example.querySelector<HTMLElement>("[data-status]");
  if (!item || !status) throw new Error("Embedded demo markup is incomplete.");

  const updateStatus = (): void => {
    const target = item.getAttribute("data-relocate-to");
    const moved = Boolean(target && item.parentElement?.matches(target));
    status.textContent = moved ? "Moved" : "Original position";
    status.classList.toggle("is-moved", moved);
  };

  const relocator = new DOMRelocator({ root: example, onChange: updateStatus });

  example.querySelector<HTMLButtonElement>("[data-counter]")?.addEventListener("click", event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.textContent = String(Number(button.textContent) + 1);
  });

  example.querySelector<HTMLSelectElement>("[data-edge-select]")?.addEventListener("change", event => {
    item.setAttribute("data-relocate-position", (event.currentTarget as HTMLSelectElement).value);
    relocator.refresh();
    updateStatus();
  });

  example.querySelector<HTMLInputElement>("[data-index-input]")?.addEventListener("input", event => {
    const input = event.currentTarget as HTMLInputElement;
    const index = Math.max(0, Math.min(3, Number.parseInt(input.value, 10) || 0));
    input.value = String(index);
    item.setAttribute("data-relocate-position", String(index));
    relocator.refresh();
    updateStatus();
  });

  window.addEventListener("pagehide", () => relocator.destroy(), { once: true });
  updateStatus();
};

const initResizableFrames = (): void => {
  document.querySelectorAll<HTMLElement>("[data-frame-demo]").forEach(demo => {
    const stage = demo.querySelector<HTMLElement>("[data-frame-stage]");
    const preview = demo.querySelector<HTMLElement>("[data-frame-preview]");
    const output = demo.querySelector<HTMLOutputElement>("[data-frame-width]");
    const handle = demo.querySelector<HTMLButtonElement>(".resize-handle");
    const buttons = [...demo.querySelectorAll<HTMLButtonElement>("[data-frame-size]")];
    if (!stage || !preview || !output || !handle) return;

    const wide = Number(demo.dataset.wide ?? 820);
    const compact = Number(demo.dataset.compact ?? 560);
    let width = wide;
    let dragX = 0;
    let dragWidth = 0;

    const setWidth = (requested: number): void => {
      const maximum = Math.min(wide, stage.clientWidth - 48);
      const minimum = Math.min(480, maximum);
      width = Math.round(Math.max(minimum, Math.min(requested, maximum)));
      preview.style.width = `${width}px`;
      output.textContent = `${width}px`;
      handle.setAttribute("aria-valuemin", String(minimum));
      handle.setAttribute("aria-valuemax", String(maximum));
      handle.setAttribute("aria-valuenow", String(width));
      buttons.forEach(button => {
        const target = button.dataset.frameSize === "wide" ? wide : compact;
        button.classList.toggle("is-active", width === Math.min(target, maximum));
      });
    };

    buttons.forEach(button => {
      button.addEventListener("click", () => setWidth(button.dataset.frameSize === "wide" ? wide : compact));
    });

    handle.addEventListener("pointerdown", event => {
      dragX = event.clientX;
      dragWidth = width;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", event => {
      if (handle.hasPointerCapture(event.pointerId)) setWidth(dragWidth + event.clientX - dragX);
    });

    handle.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setWidth(width + (event.key === "ArrowRight" ? 20 : -20));
    });

    window.addEventListener("resize", () => setWidth(width), { passive: true });
    setWidth(width);
  });
};

if (exampleName) initEmbeddedExample(exampleName);
else initResizableFrames();
