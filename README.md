# DOMRelocator

A small, dependency-free TypeScript library that moves existing DOM elements between containers when media queries match and restores them to their exact original position when they no longer match.

Created by **Dmytro Frolov**.

## Why DOMRelocator?

Responsive interfaces sometimes need the same interactive element in a different part of the document—not merely styled differently. Duplicating markup can introduce duplicate IDs, stale state, and accessibility problems. DOMRelocator moves the original node, preserving its state and event listeners.

## Features

- Uses `matchMedia`; no resize polling
- Restores the exact original DOM position
- Supports `first`, `last`, and zero-based numeric positions
- Optional dynamic DOM observation
- Manual `refresh()` and complete `destroy()` lifecycle
- Scoped roots and typed callbacks
- Zero runtime dependencies

## Installation

Using pnpm:

```bash
pnpm add dom-relocator
```

Using npm:

```bash
npm install dom-relocator
```

### CDN

Use DOMRelocator directly in the browser without installing a package:

```html
<script type="module">
  import DOMRelocator from "https://cdn.jsdelivr.net/npm/dom-relocator@0.1.0/dist/index.js";

  const relocator = new DOMRelocator();
</script>
```

The same version is also available from unpkg:

```text
https://unpkg.com/dom-relocator@0.1.0/dist/index.js
```

Pinning the version in the URL prevents unexpected changes when a new release is published.

## Quick start

```html
<div id="mobile-actions"></div>

<div data-relocate-to="#mobile-actions" data-relocate-query="(max-width: 48rem)" data-relocate-position="last">
  <button type="button">Save changes</button>
</div>
```

```ts
import DOMRelocator from "dom-relocator";

const relocator = new DOMRelocator();
```

Instances discover elements immediately when constructed.

## Data attributes

| Attribute                | Required | Default              | Description                                                 |
| ------------------------ | -------- | -------------------- | ----------------------------------------------------------- |
| `data-relocate-to`       | Yes      | —                    | CSS selector for the destination inside the configured root |
| `data-relocate-query`    | No       | `(max-width: 767px)` | Any valid media query                                       |
| `data-relocate-position` | No       | `last`               | `first`, `last`, or a zero-based integer                    |

### Position examples

```html
<!-- Insert before all existing destination children. -->
<div data-relocate-to="#target" data-relocate-position="first"></div>

<!-- Append after all existing destination children. -->
<div data-relocate-to="#target" data-relocate-position="last"></div>

<!-- Insert at zero-based index 1. -->
<div data-relocate-to="#target" data-relocate-position="1"></div>
```

Numeric positions greater than the number of destination children append the element.

## Options

```ts
const relocator = new DOMRelocator({
  root: document,
  observe: false,
  onChange: change => {
    console.log(change.action, change.element, change.target);
  },
  onError: error => {
    console.error(error.message, error.element);
  },
});
```

| Option     | Default        | Description                                          |
| ---------- | -------------- | ---------------------------------------------------- |
| `root`     | `document`     | Scope used to find managed elements and destinations |
| `observe`  | `false`        | Refresh automatically after relevant DOM mutations   |
| `onChange` | —              | Called after an element moves or restores            |
| `onError`  | `console.warn` | Receives configuration and runtime errors            |

## API

### `size`

The number of elements currently managed by the instance.

```ts
console.log(relocator.size);
```

### `refresh()`

Discovers added elements, removes stale records, and applies changed data attributes. Call it after dynamic DOM updates when `observe` is disabled.

```ts
relocator.refresh();
```

### `destroy()`

Restores all managed elements and removes media-query and mutation listeners. A destroyed instance cannot be restarted; create a new instance if needed.

```ts
relocator.destroy();
```

## Dynamic DOM

Observation is opt-in so the default runtime cost stays minimal:

```ts
const relocator = new DOMRelocator({ observe: true });
```

For controlled applications, keep observation disabled and call `refresh()` after rendering new markup.

## Development

```bash
pnpm install
pnpm dev        # Open the interactive demo
pnpm typecheck  # Check TypeScript
pnpm test       # Run the test suite
pnpm build      # Build ESM, CommonJS, and declarations
```

The interactive demo includes a draggable viewport resizer and examples for different media queries and insertion positions.

## Browser support

DOMRelocator targets modern browsers with `matchMedia`, `Map`, and standard DOM event APIs.
