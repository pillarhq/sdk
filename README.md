# @pillar-ai/sdk

Pillar Embedded Help SDK - Add contextual help and AI chat to your application.

## Installation

```bash
npm install @pillar-ai/sdk
```

## Quick Start

```javascript
import { Pillar } from "@pillar-ai/sdk";

await Pillar.init({
  helpCenter: "your-help-center",
  publicKey: "pk_live_xxx",
});
```

## Configuration

```javascript
Pillar.init({
  // Required
  helpCenter: "your-help-center",
  publicKey: "pk_live_xxx",

  // Optional configuration
  config: {
    // Panel configuration
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
  },
});
```

## Custom Trigger Button

To use your own button instead of the built-in edge trigger:

```javascript
Pillar.init({
  helpCenter: "your-help-center",
  publicKey: "pk_live_xxx",
  edgeTrigger: { enabled: false },
});

// Then control the panel programmatically
document.getElementById("my-help-button").addEventListener("click", () => {
  Pillar.toggle();
});
```

## Features

- **AI Chat**: Embedded AI assistant that understands your product
- **Edge Trigger**: Built-in sidebar tab to open the help panel (or use your own button)
- **Contextual Help**: Show relevant help based on user context
- **Text Selection**: Allow users to ask questions about selected text
- **Customizable UI**: Full control over positioning, theming, and behavior

## API Reference

### Pillar.init(config)

Initialize the SDK with your configuration.

### Pillar.open()

Open the help panel.

### Pillar.close()

Close the help panel.

### Pillar.toggle()

Toggle the help panel open/closed.

### Pillar.setContext(context)

Update the user/product context.

### Pillar.on(event, callback)

Subscribe to SDK events.

## React Integration

For React applications, use the `@pillar-ai/react` package for a more idiomatic integration with hooks and components.

```bash
npm install @pillar-ai/react
```

## License

MIT
