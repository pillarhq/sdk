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

// Initialize and get the instance
const pillar = await Pillar.init({
  productKey: "your-product-key", // From Pillar app
});

// Now you can use instance methods
pillar.setContext({ currentPage: "/dashboard" });
pillar.open();
```

You can also get the instance later using `Pillar.getInstance()`:

```javascript
// Anywhere in your app after init
const pillar = Pillar.getInstance();
pillar?.setContext({ currentPage: "/settings" });
```

## Defining Actions

Define what your co-pilot can do. When users make requests, Pillar matches intent to actions and executes them.

### Register Task Handlers

Use `onTask` to handle actions when the AI executes them:

```javascript
const pillar = await Pillar.init({
  productKey: "your-product-key",
});

// Handle navigation
pillar.onTask("go_to_settings", (data) => {
  router.push("/settings");
});

// Handle triggers
pillar.onTask("export_to_csv", async (data) => {
  await downloadCSV();
});

// Handle actions with data
pillar.onTask("update_preferences", (data) => {
  updateUserPreferences(data.emailAlerts, data.frequency);
});
```

### Code-First Action Definitions

For production, define actions in code and sync them via the `pillar-sync` CLI during CI/CD. See [Setting Up Actions](https://trypillar.com/docs/guides/actions) for details.

## Configuration

```javascript
const pillar = await Pillar.init({
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
| `Pillar.init(config)` | Initialize the SDK, returns the instance |
| `Pillar.getInstance()` | Get the initialized SDK instance |
| `pillar.open()` | Open the co-pilot panel |
| `pillar.close()` | Close the co-pilot panel |
| `pillar.toggle()` | Toggle the co-pilot panel |
| `pillar.setContext(context)` | Update the user/product context |
| `pillar.on(event, callback)` | Subscribe to SDK events |

> **Note:** `Pillar.init()` and `Pillar.getInstance()` are static methods on the class. All other methods (lowercase `pillar`) are instance methods - call them on the instance returned from `init()` or `getInstance()`.

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
