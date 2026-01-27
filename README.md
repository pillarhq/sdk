# @pillar-ai/sdk

Cursor for your product — Embed an AI co-pilot that executes tasks, not just answers questions.

[![npm version](https://img.shields.io/npm/v/@pillar-ai/sdk)](https://www.npmjs.com/package/@pillar-ai/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@pillar-ai/sdk)](https://www.npmjs.com/package/@pillar-ai/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

## What is Pillar?

Pillar is an embedded AI co-pilot that helps users complete tasks, not just answer questions. Users say what they want, and Pillar uses your UI to make it happen — navigating pages, pre-filling forms, and calling your APIs.

**How it works:**

1. User asks: *"Export this to CSV"* or *"Turn off email notifications"*
2. Pillar understands intent and chains actions
3. Your code executes with the user's session

## Features

- **Task Execution** — Navigate pages, pre-fill forms, call APIs on behalf of users
- **Multi-Step Plans** — Chain actions into workflows for complex tasks
- **Context-Aware** — Knows current page, user state, and selected text
- **Knowledge Sync** — Trained on your docs, Zendesk, Intercom, and more
- **Custom Action Cards** — Render interactive UI for confirmations and data input
- **Framework Bindings** — First-class support for React, Vue, and Svelte

## Why Pillar?

- **Runs client-side** with the user's session — no proxy servers, no token forwarding
- **One npm install**, define your actions, and you're live
- **Syncs with your docs** for grounded, accurate answers

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

### 1. Get Your Product Key

First, register your product in the [Pillar app](https://app.trypillar.com):

1. Sign up or log in at [app.trypillar.com](https://app.trypillar.com)
2. Create a new product
3. Copy your **Product Key** from the settings page

### 2. Initialize the SDK

```javascript
import { Pillar } from "@pillar-ai/sdk";

await Pillar.init({
  productKey: "your-product-key", // From Pillar app
});
```

## Defining Actions

Define what your co-pilot can do. When users make requests, Pillar matches intent to actions and executes them:

```javascript
Pillar.init({
  productKey: "your-product-key",
  actions: {
    // Navigation actions
    go_to_settings: {
      type: "navigate",
      label: "Open Settings",
      description: "Navigate to the settings page",
      path: "/settings",
    },

    // Trigger actions that execute code
    export_to_csv: {
      type: "trigger",
      label: "Export to CSV",
      description: "Export current data to a CSV file",
    },

    // Actions with data schemas
    update_preferences: {
      type: "trigger",
      label: "Update Preferences",
      description: "Update notification preferences",
      dataSchema: {
        emailAlerts: { type: "boolean" },
        frequency: { type: "string", enum: ["daily", "weekly", "monthly"] },
      },
    },
  },

  onTask: (actionName, data) => {
    // Your code executes here
    if (actionName === "export_to_csv") {
      downloadCSV();
    }
    if (actionName === "update_preferences") {
      updateUserPreferences(data.emailAlerts, data.frequency);
    }
  },
});
```

## Configuration

```javascript
Pillar.init({
  productKey: "your-product-key",

  panel: {
    position: "right", // 'left' | 'right'
    mode: "push", // 'overlay' | 'push'
  },

  edgeTrigger: {
    enabled: true, // Set to false to use your own button
  },

  theme: {
    mode: "auto", // 'light' | 'dark' | 'auto'
    colors: {
      primary: "#6366f1",
    },
  },
});
```

## API Reference

| Method | Description |
|--------|-------------|
| `Pillar.init(config)` | Initialize the SDK with your configuration |
| `Pillar.open()` | Open the co-pilot panel |
| `Pillar.close()` | Close the co-pilot panel |
| `Pillar.toggle()` | Toggle the co-pilot panel |
| `Pillar.setContext(context)` | Update the user/product context |
| `Pillar.on(event, callback)` | Subscribe to SDK events |

For complete API documentation, see the [API Reference](https://trypillar.com/docs/reference/core).

## Framework Integrations

For idiomatic integration with your framework, use our framework-specific packages:

| Framework | Package | Installation |
|-----------|---------|--------------|
| React | [@pillar-ai/react](https://github.com/pillarhq/sdk-react) | `npm install @pillar-ai/react` |
| Vue | [@pillar-ai/vue](https://github.com/pillarhq/sdk-vue) | `npm install @pillar-ai/vue` |
| Svelte | [@pillar-ai/svelte](https://github.com/pillarhq/sdk-svelte) | `npm install @pillar-ai/svelte` |

## License

MIT
