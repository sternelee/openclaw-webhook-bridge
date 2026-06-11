# AGENTS.md - OpenClaw App Guidelines

**Next.js 16 web application** deployed via OpenNext for Cloudflare Workers.

## Project Structure

```
openclaw-app/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/        # React components (chat/, layout/, ui/)
│   ├── lib/              # Utilities (gateway client, storage, utils)
│   ├── store/            # Zustand state management
│   └── types/            # TypeScript type definitions
├── package.json
├── tsconfig.json
├── next.config.ts
└── wrangler.jsonc
```

## Build & Test Commands

```bash
# Install dependencies (REQUIRED: use pnpm, NOT npm)
pnpm install

# Development server (localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typescript
# or
npx tsc --noEmit

# Linting
pnpm lint

# Deploy to Cloudflare Workers
pnpm deploy

# Preview locally on Cloudflare runtime
pnpm preview

# Generate Cloudflare types
pnpm cf-typegen
```

## Code Style

### General

- **Package Manager**: Use `pnpm` (required for Tailwind CSS patch scripts)
- **Language**: TypeScript 5.7 with strict mode
- **Framework**: Next.js 16 with React 19 (App Router)
- **Target**: ES2024

### Imports & Path Aliases

```typescript
// Use @/ alias for src imports
import { useAppStore } from "@/store/use-app-store";
import { GatewayClient } from "@/lib/utils-gateway";

// Relative imports for same-module files
import { formatTimestamp } from "./utils-format";
```

### Naming Conventions

- **Components**: PascalCase (`ChatInput.tsx`, `MessageBubble.tsx`)
- **Hooks**: camelCase starting with `use` (`useChat`, `useConnection`)
- **Utilities**: camelCase (`utils-gateway.ts`, `session-storage.ts`)
- **Types/Interfaces**: PascalCase (`ChatMessage`, GatewayState`)
- **Constants**: SCREAMING_SNAKE_CASE

### TypeScript Guidelines

- Enable strict mode; avoid `any`
- Define all gateway types in `src/types/gateway.ts`
- Use interfaces over types for public APIs
- Export types needed by other modules

### React Patterns

```typescript
// Component structure
export function ChatInput() {
  const { messages, addMessage } = useAppStore();
  
  return (
    <div className="flex flex-col">
      {/* component code */}
    </div>
  );
}
```

- Use functional components with hooks
- Destructure props for clarity
- Prefer Zustand for state over Context
- Keep components focused (single responsibility)

### State Management (Zustand)

```typescript
// Store pattern
interface AppState {
  gatewayUrl: string;
  setGatewayUrl: (url: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      gatewayUrl: "",
      setGatewayUrl: (url) => set({ gatewayUrl: url }),
    }),
    { name: "openclaw-app-storage" }
  )
);
```

- Use persist middleware for localStorage
- Never mutate state directly; use actions
- Keep related state together

### Styling (Tailwind CSS v4)

- Use utility classes in components
- Define custom styles in `app/globals.css`
- Use Radix UI primitives for complex components
- Use `cn()` utility for conditional classes

```typescript
import { cn } from "@/lib/utils";

<div className={cn(
  "flex items-center",
  isActive && "bg-accent"
)} />
```

### Error Handling

- Store errors in Zustand for user display
- Use try/catch for async operations
- Display user-friendly error messages

```typescript
try {
  await client.connect();
} catch (error) {
  set({ lastError: "Failed to connect to gateway" });
}
```

### Logging

- Use component prefixes: `[Store]`, `[Gateway]`, `[Chat]`
- Never log message content (privacy)
- Log connection events, not message content

## Key Conventions

1. **Path Alias**: Always use `@/` for imports from `src/`
2. **Session Keys**: Default is `"main"`, auto-generated for new sessions
3. **Connection Modes**: Gateway (direct) vs Bridge (webhook) auto-detected
4. **Message Timestamps**: Use `Date.now()` for local timestamps

## Testing

Currently no test framework configured. To add tests:

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

## Cloudflare-Specific

- Types defined in `cloudflare-env.d.ts`
- Use `wrangler.jsonc` for worker configuration
- Build produces `_worker.js` in `.open-next/`

## Related

- Parent AGENTS.md: `../AGENTS.md` (Rust bridge, Cloudflare Workers, WeChat Mini Program)
- CLAUDE.md: `CLAUDE.md` (detailed architecture docs)
