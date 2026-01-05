# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coinroll Web v2 - A modern Web3 DApp template built with Next.js 15, TypeScript, and blockchain integration for BSC (Binance Smart Chain).

## Essential Commands

```bash
# Development
pnpm dev          # Start dev server with Turbopack at http://localhost:3000
pnpm build        # Production build
pnpm start        # Start production server

# Code Quality
pnpm lint         # Run ESLint
pnpm format       # Format all files with Prettier
pnpm format:check # Check formatting without changes

# Dependencies
pnpm install      # Install dependencies (use pnpm, not npm/yarn)
pnpm add [pkg]    # Add new dependency
```

## Critical Requirements

1. **Internationalization (i18n)**: ALL user-facing text MUST use translation keys
   - Never hardcode strings in components
   - Use `useTranslations` hook from next-intl
   - Translation files in `messages/` directory

2. **Package Manager**: Always use `pnpm` (not npm or yarn)

3. **UI Components**: Use Shadcn/ui components from `@/components/ui/`
   - Add new components: `pnpm dlx shadcn@latest add [component]`
   - Components use Radix UI primitives + Tailwind CSS

4. **Web3 Configuration**: WalletConnect Project ID required
   - Update in `src/config/wagmi.ts`
   - Get from https://cloud.walletconnect.com

## High-Level Architecture

### Provider Hierarchy

The app uses a specific provider wrapping order in `app/[locale]/layout.tsx`:

```
RootLayout
└── Web3Provider (src/providers/Web3Provider.tsx)
    ├── WagmiProvider (blockchain state)
    ├── QueryClientProvider (async state)
    └── RainbowKitProvider (wallet UI)
```

### Routing Architecture

- **App Router** with internationalized routes under `app/[locale]/`
- **Middleware** (`src/middleware.ts`) handles locale detection and routing
- **Path-based i18n**: `/en/...` and `/zh/...` routes

### Web3 Integration Pattern

1. **Config**: Centralized in `src/config/wagmi.ts` (chains, RPC providers)
2. **Hooks**: Use wagmi hooks (`useAccount`, `useConnect`, etc.) for blockchain interaction
3. **Components**: Web3-specific components like `WalletCard` handle wallet connections

### State Management

- **Blockchain State**: wagmi + viem
- **Server State**: TanStack Query v5 (intelligent caching, optimistic updates)
- **Client State**: Zustand stores (auth, UI, preferences)
- **Form State**: React Hook Form + Zod validation

### API Architecture

The project uses a modern, type-safe API layer with the following stack:

1. **HTTP Client**: Ky (4KB, modern Fetch API wrapper)
   - Configured in `src/api/client/ky-client.ts`
   - Automatic retry, auth token injection, error handling

2. **Data Validation**: Zod schemas for runtime type safety
   - Located in `src/api/schemas/`
   - Provides TypeScript type inference
   - Validates all API responses

3. **Query Management**: TanStack Query for server state
   - Query hooks in `src/api/endpoints/*/queries.ts`
   - Mutation hooks in `src/api/endpoints/*/mutations.ts`
   - Smart caching, optimistic updates, request deduplication

4. **State Stores**: Zustand for client state
   - `useAuthStore`: Authentication and user state
   - `useUIStore`: UI state (theme, notifications, modals)
   - `usePreferencesStore`: User preferences and settings
   - All stores support persistence via localStorage

**Key API Patterns**:

```typescript
// Query example
const { data, isLoading, error } = useTokens({ page: 1, limit: 20 })

// Mutation example
const createToken = useCreateToken()
await createToken.mutateAsync(tokenData)

// Store example
const user = useAuthStore((state) => state.user)
const { theme, setTheme } = useUIStore()
```

**Documentation**: See `docs/api/` for complete API architecture and usage guide.

## Key Technical Decisions

1. **BSC-First**: Pre-configured for Binance Smart Chain, easily extendable to other chains
2. **TypeScript Strict Mode**: All code must be type-safe
3. **Path Aliases**: Use `@/` for imports from `src/`
4. **CSS Architecture**: Tailwind CSS v4 + CSS variables for theming
5. **Component Pattern**: Composition with Shadcn/ui + Radix UI primitives

## Development Workflow

1. **Git Hooks**: Husky runs Prettier on commit via lint-staged
2. **Code Style**: Enforced by ESLint + Prettier (automatic on save/commit)
3. **Type Checking**: TypeScript strict mode catches errors at build time
4. **Fast Refresh**: Turbopack enabled for instant HMR in development

## Testing Requirements

1. **Write tests for all new features** unless explicity told not to
2. **Run tests before committing** to ensure code quality and functionality
3. Use `npm run test` to verify all tests pass before making commits
4. Tests should cover both happy path and edge class for new functionality
5. Test framework: Jest + React Testing Library (unit/component tests only)

## API Implementation Memory

### Implemented Features (2024-01)

1. **API Layer Architecture**
   - TanStack Query v5 + Ky + Zod implemented
   - Complete type-safe API client in `src/api/`
   - Query hooks for data fetching
   - Mutation hooks for data modification
   - Comprehensive error handling with `ApiError` class

2. **State Management**
   - Zustand stores implemented:
     - `useAuthStore`: Auth tokens, user state, login/logout
     - `useUIStore`: Theme, notifications, modals, sidebar state
     - `usePreferencesStore`: Trading settings, display preferences, favorites
   - Stores use persistence middleware (localStorage)
   - Only select properties are persisted (e.g., theme, not notifications)

3. **Token Management Patterns**
   - Auth tokens stored in Zustand with persistence
   - Ky client reads directly from store for fresh tokens
   - Automatic 401 handling and token cleanup
   - Token refresh flow ready for implementation

4. **Documentation Structure**
   - `docs/README.md`: Main documentation index
   - `docs/api/architecture.md`: Complete API architecture design
   - `docs/api/usage-guide.md`: Comprehensive usage examples

### Key Implementation Details

- **Zustand Persistence**: Only essential data persisted (theme, auth tokens)
- **Error Handling**: Direct error handling in components with error messages
- **Query Keys**: Factory pattern for consistent cache management
- **Token Storage**: Zustand store with getState() for non-reactive access in Ky client
- **Type Safety**: End-to-end with Zod runtime validation + TypeScript inference

### API Usage Quick Reference

```typescript
// Authentication
import { useGetSignMessage, useWalletLogin } from '@/api/endpoints/auth'
const { data: signMessage } = useGetSignMessage(address)
const loginMutation = useWalletLogin()

// Custom Hooks
import { useWalletAuth } from '@/hooks/useWalletAuth'
const { isAuthenticated, user, authenticate, logout } = useWalletAuth()

// Stores
import { useAuthStore } from '@/stores/useAuthStore'
const user = useAuthStore((state) => state.user)

// Notifications
import { notify } from '@/stores/useUIStore'
notify.success('Success!', 'Operation completed')
```

### Future Considerations

- WebSocket integration for real-time updates
- Offline support with service workers
- GraphQL support alongside REST
- Request batching for performance
- ~~Implement token refresh mechanism~~ ✅ Implemented

## Wallet Authentication Implementation (2025-08)

### Overview

Implemented RainbowKit authentication with automatic signature request when wallet connects without valid auth token.

### Key Components

1. **Authentication Adapter** (`src/lib/rainbowkit-auth.ts`)
   - RainbowKit authentication adapter with SIWE support
   - Automatic challenge message retrieval and signature verification
   - Integration with auth API endpoints

2. **Enhanced Web3Provider** (`src/providers/Web3Provider.tsx`)
   - Authentication wrapper component
   - Monitors wallet connection and auth status
   - Triggers authentication flow automatically

3. **Custom Hooks** (`src/hooks/useWalletAuth.ts`)
   - `useWalletAuth`: Main authentication hook
   - `useAutoAuth`: Automatic authentication on mount
   - `useAuthGuard`: Protected route management

4. **Auth API Endpoints** (`src/api/endpoints/auth/`)
   - `useGetSignMessage`: Fetch signature challenge
   - `useWalletLogin`: Submit signature for authentication
   - `useRefreshToken`: Token refresh functionality
   - `useLogout`: Clear authentication state

### Authentication Flow

```
1. User connects wallet → 2. Check auth status → 3. Request challenge message
           ↓                                              ↓
4. User signs message ← 5. Display signature request in wallet
           ↓
6. Verify signature → 7. Receive JWT token → 8. Store in Zustand
           ↓
9. All API requests include auth token automatically
```

### Usage Example

```tsx
import { useWalletAuth } from '@/hooks/useWalletAuth'

function MyComponent() {
  const { isAuthenticated, user, authenticate, logout } = useWalletAuth()

  if (!isAuthenticated) {
    return <button onClick={authenticate}>Sign In</button>
  }

  return <div>Welcome {user?.address}</div>
}
```

### Configuration

```env
# Enable/disable authentication
NEXT_PUBLIC_ENABLE_AUTH=true

# API endpoint
NEXT_PUBLIC_API_URL=https://api-dev.coinroll.io/api/v1
```

### Security Features

- SIWE (EIP-4361) standard compliance
- JWT token management with Zustand persistence
- Automatic token refresh on 401 responses
- Address normalization and validation
- Secure message signing flow
