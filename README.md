# Telegraphy 🖖

> "Make it so." — Captain Jean-Luc Picard

A type-safe RPC (Remote Procedure Call) system with schema validation, built for TypeScript applications. Telegraphy creates a clean boundary between client and server code while maintaining full type safety across the network — like warping your function calls across space at faster-than-light speeds.

## Features

- 🔒 **Type-safe**: Full TypeScript type inference from client to server
- ✅ **Schema validation**: Runtime validation using [Sury](https://github.com/DZakh/sury) - the fastest schema library in JavaScript
- 🎯 **Simple API**: Minimal boilerplate with intuitive function-based design
- 🔌 **Pluggable**: Works with any transport layer (HTTP, WebSockets, carrier pigeon)
- 🧪 **Testable**: Clear separation between definition and implementation
- ⚡ **Fast**: Leverages Sury's JIT compilation for ultra-fast validation (Warp 9.975)
- 🚫 **No codegen**: Zero build-time code generation required - just pure TypeScript types
- 🏗️ **DDD-friendly**: Clean separation between transport, features, and business logic

## Installation

```bash
npm install telegraphy sury
# or
pnpm add telegraphy sury
# or
yarn add telegraphy sury
```

> **Note**: Sury uses `new Function` for ultra-fast parsing. This approach is battle-tested and secure, also used by TypeBox, Zod v4, and ArkType.

## Core Concepts

### Feature

A feature is a namespace for related methods. Each method has a typed input and output schema. Features can be tested locally by calling implementations directly, then warped to a remote location using a cable while keeping the same callable interface.

```typescript
const myFeature = feature("featureName", {
  methodName: transform(inputSchema).to(outputSchema),
});

// example: Starship operations
const starship = feature("starship", {
  status: transform(S.schema({})).to(
    S.schema({ 
      shields: S.number, 
      warpCore: S.string,
      crewCount: S.number 
    })
  ),
  setWarpSpeed: transform(
    S.schema({ factor: S.number })
  ).to(
    S.schema({ engaged: S.boolean })
  ),
  raiseShields: transform(
    S.schema({ strength: S.number })
  ).to(
    S.schema({ active: S.boolean })
  ),
});
```

### Cable

A cable is the client-side communication channel — think of it as your warp drive. It handles:
- Authentication (Bearer token)
- Serialization
- Transport protocols
- Error handling

```typescript
const cable = httpCable(endpoint, { token });
```

**Cable errors (shields down):**
- Endpoint is not provided
- Auth token is missing
- Server returns non-OK response

### Remote

A remote is a type-safe proxy for calling server methods — your ship's console that connects to remote stations:

```typescript
const remote = makeRemote(feature, cable);
```

The remote proxy (bridge console):
- Validates input before sending (pre-flight checks)
- Validates output after receiving (sensor verification)
- Provides full TypeScript type inference
- Throws errors on validation failures (red alert!)

### Route

A route connects a feature definition to its server-side implementation:

```typescript
const route = makeRoute(feature, implFn);
```

Routes automatically:
- Parse and validate input
- Execute the implementation
- Validate output
- Serialize response

### Router

A router dispatches incoming RPC calls to the correct feature route — like the ship's computer routing commands to different stations:

```typescript
const router = makeRouter({
  engineering: engineeringRoute,
  tactical: tacticalRoute,
  navigation: navigationRoute,
});
```
## Quick Start

### 1. Define a Feature — The Prime Directive

The code from this part is shared between the client and server — your Federation treaty that both sides agree on.

```typescript
import * as S from "sury";
import { feature, transform } from "telegraphy";

// Define crew operations
export const crewFeature = feature("crew", {
  getOfficer: transform(
    S.schema({ id: S.number })
  ).to(
    S.schema({ 
      id: S.number, 
      name: S.string,
      rank: S.string,
      station: S.string
    })
  ),
  
  assignMission: transform(
    S.schema({ 
      officerId: S.number, 
      mission: S.string 
    })
  ).to(
    S.schema({ success: S.boolean })
  ),
});
```

### 2. Client-Side Usage — Bridge Controls

Create a remote proxy that warps your calls to the backend:

```typescript
import { httpCable, makeRemote } from "telegraphy";
import { crewFeature } from "./features/crew";

// Create a cable (your warp drive)
const cable = httpCable("https://starfleet.federation/rpc", {
  token: "your-starfleet-authorization-code"
});

// Create a type-safe remote proxy (bridge console)
const crew = makeRemote(crewFeature, cable);

// Make it so! ✨ Call methods with full type safety
const officer = await crew.getOfficer({ id: 1 });
console.log(officer.name); // ✅ "Jean-Luc Picard"
console.log(officer.rank); // ✅ "Captain"

// Assign a mission
await crew.assignMission({ 
  officerId: 1, 
  mission: "Explore strange new worlds" 
});
```

### 3. Server-Side Implementation — Starfleet Command

Implement the feature methods on your server (where the actual work happens):

```typescript
import { makeRoute, makeRouter, type Feature } from "telegraphy";
import { crewFeature } from "./features/crew";

// Define your context (ship's systems)
type Context = {
  db: Database;
  currentUser: Officer;
};

// Implement the feature (actual station operations)
const crewImpl = (ctx: Context): Feature<typeof crewFeature> => ({
  getOfficer: async (input) => {
    const officer = await ctx.db.officers.findById(input.id);
    return {
      id: officer.id,
      name: officer.name,
      rank: officer.rank,
      station: officer.station,
    };
  },
  
  assignMission: async (input) => {
    await ctx.db.missions.assign(input.officerId, input.mission);
    return { success: true };
  },
});

// Create routes (station hookups)
const crewRoute = makeRoute(crewFeature, crewImpl);

// Create a router (main computer)
const router = makeRouter({
  crew: crewRoute,
  engineering: engineeringRoute,
  tactical: tacticalRoute,
  // More stations...
});

// Use in your HTTP handler (communications array)
app.post("/rpc", async (req, res) => {
  const ctx: Context = {
    db: database,
    currentUser: req.user,
  };
  
  try {
    const result = await router(ctx, req.body);
    res.json(JSON.parse(result));
  } catch (error) {
    // Red alert!
    res.status(400).json({ error: error.message });
  }
});
```

## Advanced Usage

### Context Pattern

Use context to inject dependencies like database connections, authentication, logging, etc.:

```typescript
type Context = {
  db: Database;
  logger: Logger;
  currentUser: User;
};

const implementation = (ctx: Context): Feature<typeof myFeature> => ({
  myMethod: async (input) => {
    ctx.logger.info("Method called", { input });
    const result = await ctx.db.query(...);
    return result;
  },
});
```

### Complex Schemas — Detailed Sensor Readings

Leverage sury's schema system for complex validations (like sophisticated sensor arrays):

```typescript
const scanFeature = feature("scan", {
  analyzePlanet: transform(
    S.schema({
      coordinates: S.string,
      depth: S.string, // "surface" | "deep"
      sensors: S.array(S.string),
      priority: S.optional(S.number),
      awayTeam: S.optional(S.array(S.number)),
    })
  ).to(
    S.schema({
      id: S.number,
      planetName: S.string,
      classification: S.string,
      lifeforms: S.array(S.string),
      atmosphere: S.string,
      recommendation: S.string,
      scannedAt: S.string,
    })
  ),
});
```

### Error Handling

Telegraphy validates at multiple layers:

```typescript
try {
  const result = await remote.getProfile({ id: "invalid" });
} catch (error) {
  // Could be:
  // - Input validation error (client-side)
  // - Network error
  // - Server validation error
  // - Business logic error
  console.error(error.message);
}
```

### Domain-Driven Design — Separation of Concerns

Telegraphy makes it trivial to separate your business logic from transport concerns. Your implementations are pure functions with zero HTTP/network dependencies:

```typescript
// Pure business logic - no HTTP, no GraphQL, no transport
const crewImpl = (ctx: Context): Feature<typeof crewFeature> => ({
  getOfficer: async (input) => {
    // Pure domain logic
    const officer = await ctx.db.officers.findById(input.id);
    if (!officer) {
      throw new Error("Officer not found");
    }
    return officer;
  },
});

// Test your business logic directly - no mocking HTTP or GraphQL execution
describe("Crew business logic", () => {
  it("retrieves officer from database", async () => {
    const mockDb = {
      officers: {
        findById: vi.fn(async () => ({ 
          id: 1, 
          name: "Picard", 
          rank: "Captain",
          station: "Bridge" 
        }))
      }
    };
    
    const impl = crewImpl({ db: mockDb, currentUser: mockUser });
    const result = await impl.getOfficer({ id: 1 });
    
    expect(result.name).toBe("Picard");
    expect(mockDb.officers.findById).toHaveBeenCalledWith(1);
  });
});

// Transport layer is completely separate
// Can use HTTP, WebSockets, message queues, or call directly
const route = makeRoute(crewFeature, crewImpl);
const router = makeRouter({ crew: route });

// Use with Express
app.post("/rpc", async (req, res) => {
  const result = await router(ctx, req.body);
  res.json(JSON.parse(result));
});

// Or use with WebSockets
ws.on("message", async (data) => {
  const result = await router(ctx, JSON.parse(data));
  ws.send(result);
});

// Or call directly in-process (same app, no network)
const directResult = await router(ctx, {
  feature: "crew",
  method: "getOfficer",
  input: { id: 1 }
});
```

Compare this to GraphQL where resolvers are aware of GraphQL-specific objects (parent, args, context, info) and tRPC where procedures know about the router context.

### Testing — Holodeck Simulations

Test features independently from transport (like running holodeck scenarios):

```typescript
import { describe, it, expect, vi } from "vitest";
import { makeRemote } from "telegraphy";

describe("Crew operations", () => {
  it("warps commands correctly", async () => {
    // Mock cable (simulated warp drive)
    const mockCable = vi.fn(async () => ({ 
      id: 1, 
      name: "Jean-Luc Picard",
      rank: "Captain",
      station: "Bridge"
    }));
    
    const remote = makeRemote(crewFeature, mockCable);
    await remote.getOfficer({ id: 1 });
    
    // Verify the warp transmission
    expect(mockCable).toHaveBeenCalledWith(
      "crew",
      "getOfficer",
      { id: 1 }
    );
  });
});
```

## API Reference

### `feature(name, schema)`

Creates a feature definition.

**Parameters:**
- `name` (string): Feature identifier
- `schema` (object): Map of method names to callable definitions

**Returns:** Feature definition object

---

### `transform(input).to(output)`

Creates a callable definition with input/output schemas.

**Parameters:**
- `input` (Schema): Input validation schema
- `output` (Schema): Output validation schema

**Returns:** Callable object with input and output schemas

---

### `httpCable(endpoint, auth)`

Creates a client-side communication channel.

**Parameters:**
- `endpoint` (string): Backend RPC endpoint URL
- `auth` (object): Authentication object with `token` property

**Returns:** Cable function

**Throws:**
- Error if endpoint is undefined
- Error if token is null when calling methods

---

### `makeRemote(feature, cable)`

Creates a type-safe remote proxy.

**Parameters:**
- `feature` (Feature): Feature definition
- `cable` (Cable): Communication channel

**Returns:** Remote proxy with typed methods

---

### `makeRoute(feature, implFn)`

Creates a server-side route handler.

**Parameters:**
- `feature` (Feature): Feature definition
- `implFn` (function): Implementation factory `(ctx) => Feature<T>`

**Returns:** Route object with `call` method

---

### `makeRouter(routes)`

Creates a request router for multiple features.

**Parameters:**
- `routes` (object): Map of feature names to routes

**Returns:** Router function `(ctx, payload) => Promise<string>`

## Type System — No Codegen Required

Telegraphy provides complete type inference without any code generation. Feature types are proper TypeScript types that you can import, export, and use directly:

```typescript
type CrewFeature = typeof crewFeature;
type Remote = Feature<CrewFeature>;

// Remote has type (your bridge console interface):
// {
//   getOfficer: (input: { id: number }) => Promise<{ 
//     id: number; 
//     name: string; 
//     rank: string;
//     station: string;
//   }>;
//   assignMission: (input: { officerId: number; mission: string }) => Promise<{ 
//     success: boolean 
//   }>;
// }

// These are real TypeScript types, not inferred signatures
// You can use them anywhere in your codebase
import type { Feature } from "telegraphy";
import type { crewFeature } from "./features/crew";

type CrewOperations = Feature<typeof crewFeature>;
// Use CrewOperations as a type constraint, in generics, etc.
```

## Design Philosophy — The Prime Directives

Telegraphy follows these principles:

1. **Type Safety First**: Types flow seamlessly from client to server (like a well-coordinated bridge crew)
2. **Simple & Direct**: Minimal abstractions, maximum clarity ("Make it so")
3. **Validation at Boundaries**: Trust nothing across the network (shields up!)
4. **Separation of Concerns**: Definition, implementation, and transport are separate (different stations, one ship)
5. **Domain-Driven Design**: Business logic lives in pure functions, completely decoupled from HTTP/network concerns
6. **Framework Agnostic**: Works with any HTTP server or client (compatible with all Federation vessels)
7. **Performance**: Built on [Sury](https://github.com/DZakh/sury), the fastest validation library (94,828+ ops/ms at Warp 9.975)

## Testing

Run the test suite:

```bash
npm test
# or
pnpm test
```

Watch mode:

```bash
npm run test:watch
# or
pnpm test:watch
```

## Use Cases — Mission Parameters

Telegraphy is ideal for:

- 🌐 Full-stack TypeScript applications (Starfleet operations)
- 📱 Mobile apps with TypeScript backends (tricorders)
- 🔧 Microservices communication (ship-to-ship hails)
- 🚀 API-first development (Federation protocols)
- 🧩 Type-safe third-party integrations (alien technology interface)

## Comparison with Other Solutions

### vs tRPC

- **Telegraphy**: 
  - Explicit schema validation with runtime guarantees
  - Proper TypeScript types that can be imported and used directly
  - Clear client/server boundary with shared feature definitions
  - Feature types are actual TS types, not inferred function signatures
  - Transport-agnostic core - business logic has zero HTTP dependencies
- **tRPC**: 
  - Inference-based without explicit schemas
  - Types are inferred from implementation, not defined separately
  - Tighter coupling between client and server
  - Cannot easily extract or reuse type definitions
  - Procedures are tightly coupled to the router/HTTP layer

### vs GraphQL

- **Telegraphy**: 
  - Zero codegen - just write TypeScript
  - Simpler, RPC-style, method-based
  - No build step required for types
  - Direct function calls with schemas
  - **Clean separation**: Features define contracts, implementations are pure business logic, cables handle transport
  - Test business logic without any GraphQL/HTTP infrastructure
- **GraphQL**: 
  - Requires code generation tooling (graphql-codegen, etc.)
  - Query language with separate schema definition language
  - Graph-based, more complex
  - Build-time tooling dependency
  - **Tight coupling**: Resolvers are aware of GraphQL context, info objects, and field resolvers
  - Business logic often mixed with GraphQL-specific concepts
  - Testing requires GraphQL execution environment

### vs REST

- **Telegraphy**: 
  - Type-safe, schema-validated, single endpoint
  - Features are transport-independent - can be called directly or remotely
- **REST**: 
  - Resource-based, multiple endpoints, typically less type-safe
  - Business logic often tightly coupled to HTTP controllers

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

> "Highly illogical... but remarkably efficient." — Spock (probably)

Built with [Sury](https://github.com/DZakh/sury) (aka ReScript Schema) for schema validation. Sury is the fastest schema library in the JavaScript ecosystem, featuring:

- Ultra-fast parsing via JIT compilation (dilithium-powered)
- Small bundle size (14.1 kB min + gzip)
- Tree-shakable API
- Standard Schema spec implementation
- Built-in JSON Schema support

Learn more at the [Sury documentation](https://github.com/DZakh/sury).

---

**Live long and prosper.** 🖖

