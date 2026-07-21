/**
 * Moves elements to responsive destinations and restores their exact original
 * position when the media query stops matching.
 *
 * @example
 * <div
 *   data-relocate-to="#mobile-actions"
 *   data-relocate-query="(max-width: 48rem)"
 *   data-relocate-position="last"
 * >...</div>
 *
 * const relocator = new DOMRelocator();
 * relocator.destroy();
 */

export type DOMRelocatorPosition = "first" | "last" | number;

export interface DOMRelocatorChange {
  action: "move" | "restore";
  element: HTMLElement;
  target: Element | null;
}

export interface DOMRelocatorOptions {
  /** Scope used to find managed elements and destinations. */
  root?: ParentNode;
  /** Automatically refresh after DOM changes. Disabled by default. */
  observe?: boolean;
  onChange?: (change: DOMRelocatorChange) => void;
  onError?: (error: DOMRelocatorError) => void;
}

export class DOMRelocatorError extends Error {
  readonly element: HTMLElement;

  constructor(message: string, element: HTMLElement) {
    super(message);
    this.name = "DOMRelocatorError";
    this.element = element;
  }
}

interface Config {
  target: string;
  query: string;
  position: DOMRelocatorPosition;
  signature: string;
}

interface ManagedElement extends Config {
  element: HTMLElement;
  marker: Comment;
  originalParent: Node;
  originalNextSibling: Node | null;
  mediaQuery: MediaQueryList;
  listener: () => void;
  moved: boolean;
  lastError: string | null;
}

const ATTR = {
  target: "data-relocate-to",
  query: "data-relocate-query",
  position: "data-relocate-position",
} as const;

const SELECTOR = `[${ATTR.target}]`;
const DEFAULT_QUERY = "(max-width: 767px)";
const DEFAULT_POSITION = "last" satisfies DOMRelocatorPosition;

export default class DOMRelocator {
  readonly root: ParentNode;

  private readonly observe: boolean;
  private readonly onChange?: DOMRelocatorOptions["onChange"];
  private readonly onError?: DOMRelocatorOptions["onError"];
  private readonly records = new Map<HTMLElement, ManagedElement>();
  private observer: MutationObserver | null = null;
  private refreshPending = false;
  private destroyed = false;

  constructor(options: DOMRelocatorOptions = {}) {
    if (!options.root && typeof document === "undefined") {
      throw new Error("DOMRelocator requires a browser DOM or an explicit root.");
    }

    this.root = options.root ?? document;
    this.observe = options.observe ?? false;
    this.onChange = options.onChange;
    this.onError = options.onError;

    this.refresh();

    if (this.observe && typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver(() => this.queueRefresh());
      this.observer.observe(this.root, {
        attributes: true,
        attributeFilter: Object.values(ATTR),
        childList: true,
        subtree: true,
      });
    }
  }

  /** Number of elements currently managed by this instance. */
  get size(): number {
    return this.records.size;
  }

  /** Finds new elements and applies changed configurations. */
  refresh(): void {
    if (this.destroyed) return;

    const elements = new Set(this.findElements());

    for (const [element, record] of this.records) {
      if (!elements.has(element)) this.unregister(record, element.isConnected);
    }

    for (const element of elements) {
      const config = this.readConfig(element);
      const current = this.records.get(element);

      if (!config) {
        if (current) this.unregister(current, true);
        continue;
      }

      if (current?.signature === config.signature) {
        this.apply(current);
        continue;
      }

      if (current) this.unregister(current, true);
      this.register(element, config);
    }
  }

  /** Restores all elements and removes every listener. */
  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.observer?.disconnect();
    this.observer = null;

    for (const record of [...this.records.values()]) {
      this.unregister(record, true);
    }
  }

  private findElements(): HTMLElement[] {
    const elements = Array.from(this.root.querySelectorAll<HTMLElement>(SELECTOR));

    if ("matches" in this.root && typeof this.root.matches === "function" && this.root.matches(SELECTOR)) {
      elements.unshift(this.root as HTMLElement);
    }

    return elements;
  }

  private readConfig(element: HTMLElement): Config | null {
    const target = element.getAttribute(ATTR.target)?.trim();
    if (!target) return this.fail(`${ATTR.target} must contain a CSS selector.`, element);

    const query = element.getAttribute(ATTR.query)?.trim() || DEFAULT_QUERY;
    const rawPosition = element.getAttribute(ATTR.position)?.trim() || DEFAULT_POSITION;
    const position = this.parsePosition(rawPosition);

    if (position === null) {
      return this.fail(`${ATTR.position} must be "first", "last", or a non-negative integer.`, element);
    }

    try {
      window.matchMedia(query);
    } catch {
      return this.fail(`Invalid media query: "${query}".`, element);
    }

    return {
      target,
      query,
      position,
      signature: `${target}\u0000${query}\u0000${position}`,
    };
  }

  private parsePosition(value: string): DOMRelocatorPosition | null {
    if (value === "first" || value === "last") return value;
    return /^\d+$/.test(value) ? Number(value) : null;
  }

  private register(element: HTMLElement, config: Config): void {
    const parent = element.parentNode;
    if (!parent) {
      this.fail("A managed element must have a parent node.", element);
      return;
    }

    const marker = element.ownerDocument.createComment("dom-relocator");
    parent.insertBefore(marker, element);

    const mediaQuery = window.matchMedia(config.query);
    const record: ManagedElement = {
      ...config,
      element,
      marker,
      originalParent: parent,
      originalNextSibling: element.nextSibling,
      mediaQuery,
      listener: () => this.apply(record),
      moved: false,
      lastError: null,
    };

    this.records.set(element, record);
    mediaQuery.addEventListener("change", record.listener);
    this.apply(record);
  }

  private unregister(record: ManagedElement, restore: boolean): void {
    record.mediaQuery.removeEventListener("change", record.listener);
    this.records.delete(record.element);
    if (restore) this.restore(record);
    record.marker.remove();
  }

  private apply(record: ManagedElement): void {
    if (!record.mediaQuery.matches) {
      if (record.moved) this.restore(record);
      return;
    }

    let target: Element | null;
    try {
      target = this.root.querySelector(record.target);
    } catch {
      this.reportOnce(record, `Invalid target selector: "${record.target}".`);
      return;
    }

    if (!target) {
      this.reportOnce(record, `Target not found: "${record.target}".`);
      return;
    }

    if (target === record.element || record.element.contains(target)) {
      this.reportOnce(record, "The destination cannot be the element or one of its descendants.");
      return;
    }

    record.lastError = null;

    if (!record.moved || record.element.parentElement !== target) {
      this.insert(record.element, target, record.position);
    }

    if (!record.moved) {
      record.moved = true;
      this.onChange?.({ action: "move", element: record.element, target });
    }
  }

  private insert(element: HTMLElement, target: Element, position: DOMRelocatorPosition): void {
    if (position === "first") return target.prepend(element);
    if (position === "last") return target.append(element);

    const children = Array.from(target.children).filter(child => child !== element);
    target.insertBefore(element, children[position] ?? null);
  }

  private restore(record: ManagedElement): void {
    const { element, marker, originalParent, originalNextSibling } = record;

    if (marker.parentNode) {
      marker.parentNode.insertBefore(element, marker.nextSibling);
    } else if (originalParent.isConnected) {
      const reference = originalNextSibling?.parentNode === originalParent ? originalNextSibling : null;
      originalParent.insertBefore(element, reference);
    } else {
      return;
    }

    if (record.moved) {
      record.moved = false;
      this.onChange?.({ action: "restore", element, target: null });
    }
  }

  private reportOnce(record: ManagedElement, message: string): void {
    if (record.lastError === message) return;
    record.lastError = message;
    this.fail(message, record.element);
  }

  private fail(message: string, element: HTMLElement): null {
    const error = new DOMRelocatorError(message, element);
    if (this.onError) this.onError(error);
    else console.warn(error);
    return null;
  }

  private queueRefresh(): void {
    if (this.refreshPending || this.destroyed) return;
    this.refreshPending = true;

    queueMicrotask(() => {
      this.refreshPending = false;
      this.refresh();
    });
  }
}
