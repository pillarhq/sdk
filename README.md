# @pillar-ai/sdk

Pillar Embedded Help SDK - Add contextual help, tooltips, and AI chat to your application.

## Installation

```bash
npm install @pillar-ai/sdk
```

## Quick Start

### Script Tag (CDN)

```html
<script src="https://cdn.trypillar.com/sdk/pillar.min.js"></script>
<script>
  Pillar.init({
    helpCenter: 'your-help-center',
    publicKey: 'pk_live_xxx',
  });
</script>
```

Or with auto-initialization via data attributes:

```html
<script
  src="https://cdn.trypillar.com/sdk/pillar.min.js"
  data-help-center="your-help-center"
  data-public-key="pk_live_xxx"
></script>
```

### ES Modules

```javascript
import { Pillar } from '@pillar-ai/sdk';

await Pillar.init({
  helpCenter: 'your-help-center',
  publicKey: 'pk_live_xxx',
});
```

## Configuration

```javascript
Pillar.init({
  // Required
  helpCenter: 'your-help-center',
  publicKey: 'pk_live_xxx',

  // Optional configuration
  config: {
    // Panel configuration
    panel: {
      position: 'right', // 'left' | 'right'
      mode: 'overlay', // 'overlay' | 'push'
    },

    // Floating button
    floatingButton: {
      enabled: true,
      position: 'bottom-right',
    },

    // Tooltips
    tooltips: {
      enabled: true,
      trigger: 'hover', // 'hover' | 'click'
    },

    // Theme
    theme: {
      mode: 'system', // 'light' | 'dark' | 'system'
      colors: {
        primary: '#6366f1',
      },
    },
  },
});
```

## Features

- **AI Chat**: Embedded AI assistant that understands your product
- **Contextual Help**: Show relevant help based on user context
- **Tooltips**: Attach interactive tooltips to any element
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
