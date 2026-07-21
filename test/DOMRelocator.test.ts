import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DOMRelocator from "../src";

class MockMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media: string;
  matches = false;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  setMatches(matches: boolean): void {
    if (this.matches === matches) return;
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }

  addListener(listener: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null): void {
    if (listener) this.addEventListener("change", listener as EventListener);
  }

  removeListener(listener: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null): void {
    if (listener) this.removeEventListener("change", listener as EventListener);
  }

  dispatchEvent(event: Event): boolean {
    return super.dispatchEvent(event);
  }
}

const mediaQueries = new Map<string, MockMediaQueryList>();
const instances: DOMRelocator[] = [];

const query = (value: string): MockMediaQueryList => {
  const mediaQuery = mediaQueries.get(value) ?? new MockMediaQueryList(value);
  mediaQueries.set(value, mediaQuery);
  return mediaQuery;
};

beforeEach(() => {
  document.body.innerHTML = "";
  mediaQueries.clear();

  vi.stubGlobal("matchMedia", query);
});

afterEach(() => {
  for (const instance of instances.splice(0)) instance.destroy();
  vi.unstubAllGlobals();
});

describe("DOMRelocator", () => {
  it("moves and restores an element when its query changes", () => {
    document.body.innerHTML = `
      <div id="source"><button id="item" data-relocate-to="#target" data-relocate-query="mobile">Save</button></div>
      <div id="target"></div>
    `;

    const instance = new DOMRelocator();
    instances.push(instance);

    query("mobile").setMatches(true);
    expect(document.querySelector("#target > #item")).not.toBeNull();

    query("mobile").setMatches(false);
    expect(document.querySelector("#source > #item")).not.toBeNull();
  });

  it("supports first, last, and numeric positions", () => {
    document.body.innerHTML = `
      <div id="source">
        <span id="first" data-relocate-to="#target" data-relocate-query="active" data-relocate-position="first"></span>
        <span id="last" data-relocate-to="#target" data-relocate-query="active" data-relocate-position="last"></span>
        <span id="middle" data-relocate-to="#target" data-relocate-query="active" data-relocate-position="1"></span>
      </div>
      <div id="target"></div>
    `;
    query("active").setMatches(true);

    const instance = new DOMRelocator();
    instances.push(instance);

    const order = [...document.querySelectorAll("#target > *")].map(element => element.id);
    expect(order).toEqual(["first", "middle", "last"]);
  });

  it("discovers dynamically added elements after refresh", () => {
    document.body.innerHTML = `<div id="source"></div><div id="target"></div>`;
    query("active").setMatches(true);

    const instance = new DOMRelocator();
    instances.push(instance);

    document.querySelector("#source")!.innerHTML = '<span id="dynamic" data-relocate-to="#target" data-relocate-query="active"></span>';
    instance.refresh();

    expect(document.querySelector("#target > #dynamic")).not.toBeNull();
  });

  it("restores the DOM and removes listeners on destroy", () => {
    document.body.innerHTML = `
      <div id="source"><span id="item" data-relocate-to="#target" data-relocate-query="active"></span></div>
      <div id="target"></div>
    `;
    query("active").setMatches(true);

    const instance = new DOMRelocator();
    expect(document.querySelector("#target > #item")).not.toBeNull();

    instance.destroy();
    expect(document.querySelector("#source > #item")).not.toBeNull();

    query("active").setMatches(false);
    query("active").setMatches(true);
    expect(document.querySelector("#source > #item")).not.toBeNull();
  });
});
