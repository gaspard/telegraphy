# Telegraphy

A type-safe RPC (Remote Procedure Call) system with schema validation, built for TypeScript applications. Telegraphy creates a clean boundary between client and server code while maintaining full type safety across the network.

## Features

- 🔒 **Type-safe**: Full TypeScript type inference from client to server
- ✅ **Schema validation**: Runtime validation using [Sury](https://github.com/DZakh/sury) - the fastest schema library in JavaScript
- 🎯 **Simple API**: Minimal boilerplate with intuitive function-based design
- 🔌 **Pluggable**: Works with any HTTP transport layer
- 🧪 **Testable**: Clear separation between definition and implementation
- ⚡ **Fast**: Leverages Sury's JIT compilation for ultra-fast validation

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

A feature is a namespace for related RPC methods. Each method has a defined input and output schema:

```typescript
const myFeature = feature("featureName", {
  methodName: transform(inputSchema).to(outputSchema),
});
```

### Cable

A cable is the client-side communication channel. It handles:
- Authentication (Bearer token)
- Serialization
- HTTP transport
- Error handling

```typescript
const cable = httpCable(endpoint, { token });
```

**Cable throws errors when:**
- Endpoint is not provided
- Auth token is missing
- Server returns non-OK response

### Remote

A remote is a type-safe proxy for calling server methods:

```typescript
const remote = makeRemote(feature, cable);
```

The remote proxy:
- Validates input before sending
- Validates output after receiving
- Provides full TypeScript type inference
- Throws errors on validation failures

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

A router dispatches incoming RPC calls to the correct feature route:

```typescript
const router = makeRouter({
  user: userRoute,
  post: postRoute,
  comment: commentRoute,
});
```
## Quick Start

### 1. Define a Feature

The code from this part is shared between the client and server.

A feature is a collection of related methods with typed input/output.

```typescript
import * as S from "sury";
import { feature, transform } from "telegraphy";

export const usersFeature = feature("user", {
  getProfile: transform(
    S.schema({ id: S.number })
  ).to(
    S.schema({ 
      id: S.number, 
      name: S.string,
      email: S.string 
    })
  ),
  
  updateProfile: transform(
    S.schema({ 
      id: S.number, 
      name: S.string 
    })
  ).to(
    S.schema({ success: S.boolean })
  ),
});
```

### 2. Client-Side Usage

Create a remote proxy that calls your backend:

```typescript
import { httpCable, makeRemote } from "telegraphy";
import { usersFeature } from "./feature/users.ts";

// Create a cable (communication channel)
const cable = httpCable("https://api.example.com/rpc", {
  token: "your-auth-token"
});

// Create a type-safe remote proxy
const users = makeRemote(usersFeature, cable);

// Call methods with full type safety
const profile = await users.getProfile({ id: 42 });
console.log(profile.name); // ✅ TypeScript knows this is a string

await users.updateProfile({ id: 42, name: "Alice" });
```

### 3. Server-Side Implementation

Implement the feature methods on your server:

```typescript
import { makeRoute, makeRouter, type Feature } from "telegraphy";
import { usersFeature } from "./features";

// Define your context type
type Context = {
  db: Database;
  userId: number;
};

// Implement the feature
const userImpl = (ctx: Context): Feature<typeof usersFeature> => ({
  getProfile: async (input) => {
    const user = await ctx.db.users.findById(input.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  },
  
  updateProfile: async (input) => {
    await ctx.db.users.update(input.id, { name: input.name });
    return { success: true };
  },
});

// Create routes
const userRoute = makeRoute(usersFeature, userImpl);

// Create a router for multiple features
const router = makeRouter({
  user: userRoute,
  // Add more features here...
});

// Use in your HTTP handler (e.g., Express)
app.post("/rpc", async (req, res) => {
  const ctx: Context = {
    db: database,
    userId: req.user.id,
  };
  
  try {
    const result = await router(ctx, req.body);
    res.json(JSON.parse(result));
  } catch (error) {
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

### Complex Schemas

Leverage sury's schema system for complex validations:

```typescript
const taskFeature = feature("task", {
  create: transform(
    S.schema({
      title: S.string,
      description: S.string,
      tags: S.array(S.string),
      priority: S.optional(S.number),
      dueDate: S.optional(S.string),
    })
  ).to(
    S.schema({
      id: S.number,
      title: S.string,
      description: S.string,
      tags: S.array(S.string),
      priority: S.number,
      dueDate: S.nullable(S.string),
      createdAt: S.string,
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

### Testing

Test features independently from transport:

```typescript
import { describe, it, expect, vi } from "vitest";
import { makeRemote } from "telegraphy";

describe("User feature", () => {
  it("calls cable with correct parameters", async () => {
    const mockCable = vi.fn(async () => ({ 
      id: 1, 
      name: "Test User",
      email: "test@example.com"
    }));
    
    const remote = makeRemote(usersFeature, mockCable);
    await remote.getProfile({ id: 1 });
    
    expect(mockCable).toHaveBeenCalledWith(
      "user",
      "getProfile",
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

## Type System

Telegraphy provides complete type inference:

```typescript
type UsersFeature = typeof usersFeature;
type Remote = Feature<UsersFeature>;

// Remote has type:
// {
//   getProfile: (input: { id: number }) => Promise<{ 
//     id: number; 
//     name: string; 
//     email: string 
//   }>;
//   updateProfile: (input: { id: number; name: string }) => Promise<{ 
//     success: boolean 
//   }>;
// }
```

## Design Philosophy

Telegraphy follows these principles:

1. **Type Safety First**: Types flow seamlessly from client to server
2. **Simple & Direct**: Minimal abstractions, maximum clarity
3. **Validation at Boundaries**: Trust nothing across the network
4. **Separation of Concerns**: Definition, implementation, and transport are separate
5. **Framework Agnostic**: Works with any HTTP server or client
6. **Performance**: Built on [Sury](https://github.com/DZakh/sury), the fastest validation library (94,828+ ops/ms)

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

## Use Cases

Telegraphy is ideal for:

- 🌐 Full-stack TypeScript applications
- 📱 Mobile apps with TypeScript backends
- 🔧 Microservices communication
- 🚀 API-first development
- 🧩 Type-safe third-party integrations

## Comparison with Other Solutions

### vs tRPC

- **Telegraphy**: Explicit schema validation, clear client/server boundary
- **tRPC**: Inference-based, tighter coupling

### vs GraphQL

- **Telegraphy**: Simpler, RPC-style, method-based
- **GraphQL**: Query language, graph-based, more complex

### vs REST

- **Telegraphy**: Type-safe, schema-validated, single endpoint
- **REST**: Resource-based, multiple endpoints, typically less type-safe

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

Built with [Sury](https://github.com/DZakh/sury) (aka ReScript Schema) for schema validation. Sury is the fastest schema library in the JavaScript ecosystem, featuring:

- Ultra-fast parsing via JIT compilation
- Small bundle size (14.1 kB min + gzip)
- Tree-shakable API
- Standard Schema spec implementation
- Built-in JSON Schema support

Learn more at the [Sury documentation](https://github.com/DZakh/sury).

