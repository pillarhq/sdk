# @pillar-ai/sdk

Pillar Embedded Help SDK — Add contextual help and AI-powered assistance to your application.

[![npm version](https://img.shields.io/npm/v/@pillar-ai/sdk)](https://www.npmjs.com/package/@pillar-ai/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@pillar-ai/sdk)](https://www.npmjs.com/package/@pillar-ai/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

## Features

- **AI Chat** — Embedded AI assistant that understands your product
- **Edge Trigger** — Built-in sidebar tab to open the help panel (or use your own button)
- **Contextual Help** — Show relevant help based on user context
- **Text Selection** — Allow users to ask questions about selected text
- **Customizable UI** — Full control over positioning, theming, and behavior
- **Framework Bindings** — First-class support for React, Vue, and Svelte

## Documentation

**[View Full Documentation](https://trypillar.com/docs)** | [Getting Started](https://trypillar.com/docs/getting-started/quick-start) | [API Reference](https://trypillar.com/docs/reference/core)

## Installation

```bash
npm install @pillar-ai/sdk
# or
pnpm add @pillar-ai/sdk
# or
yarn add @pillar-ai/sdk
```

## Quick Start

```javascript
import { Pillar } from "@pillar-ai/sdk";

await Pillar.init({
  helpCenter: "your-help-center",
});
```

## Configuration

```javascript
Pillar.init({
  // Required
  helpCenter: "your-help-center",

  // Optional configuration
  panel: {
    position: "right", // 'left' | 'right'
    mode: "push", // 'overlay' | 'push'
  },

  // Edge trigger (sidebar tab that opens the panel)
  edgeTrigger: {
    enabled: true, // Set to false to use your own custom button
  },

  // Theme
  theme: {
    mode: "auto", // 'light' | 'dark' | 'auto'
    colors: {
      primary: "#6366f1",
    },
  },
});
```

## Custom Trigger Button

To use your own button instead of the built-in edge trigger:

```javascript
Pillar.init({
  helpCenter: "your-help-center",
  edgeTrigger: { enabled: false },
});

// Then control the panel programmatically
document.getElementById("my-help-button").addEventListener("click", () => {
  Pillar.toggle();
});
```

## API Reference

| Method | Description |
|--------|-------------|
| `Pillar.init(config)` | Initialize the SDK with your configuration |
| `Pillar.open()` | Open the help panel |
| `Pillar.close()` | Close the help panel |
| `Pillar.toggle()` | Toggle the help panel open/closed |
| `Pillar.setContext(context)` | Update the user/product context |
| `Pillar.on(event, callback)` | Subscribe to SDK events |

For complete API documentation, see the [API Reference](https://trypillar.com/docs/reference/core).

## Framework Integrations

For a more idiomatic integration with your framework of choice, use our framework-specific packages:

| Framework | Package | Installation |
|-----------|---------|--------------|
| React | [@pillar-ai/react](https://github.com/pillarhq/sdk-react) | `npm install @pillar-ai/react` |
| Vue | [@pillar-ai/vue](https://github.com/pillarhq/sdk-vue) | `npm install @pillar-ai/vue` |
| Svelte | [@pillar-ai/svelte](https://github.com/pillarhq/sdk-svelte) | `npm install @pillar-ai/svelte` |

## License

MIT
