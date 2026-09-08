# Grok bot · React / TypeScript demo

This ready-to-run Vite project uses the exported grok-bot.avatar.json definition with
@bible-strong/avatar-react.

## Run the demo

```sh
npm install
npm run dev
```

Then open the local URL displayed by Vite. The demo includes controls for every exported animation
and expression.

## Production build

```sh
npm run build
```

The component is created once from the JSON definition with `createAvatar(definition)`. TypeScript
derives the accepted animation and expression prop keys from that imported JSON file.
