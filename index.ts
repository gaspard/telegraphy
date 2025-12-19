/** biome-ignore-all lint/suspicious/noExplicitAny: We have parser to type the input and output.
 */
import * as S from "sury";

export type Cable = (feature: string, method: string, input: unknown) => Promise<unknown> | unknown;

export const feature = <T>(name: string, schema: T) => {
  return {
    name,
    schema,
  };
};

export function makeCable(endpoint: string | undefined, auth: { token: string | null }): Cable {
  if (!endpoint) {
    throw new Error("Backend endpoint is not set");
  }
  return async (feature: string, method: string, input: unknown) => {
    if (!auth.token) {
      throw new Error("User not authenticated, cannot call cable without a token");
    }
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${auth.token}`);
    const payload: CableInput = { feature, method, input };
    const response = await fetch(endpoint, {
      headers,
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to call ${feature}.${method}: ${response.statusText}`);
    }
    return await response.json();
  };
}

export const transform = <I>(input: I) => {
  return {
    to: <O>(output: O) => {
      return {
        input,
        output,
      };
    },
  };
};

export type Callable<I, O> = {
  input: I;
  output: O;
};

export type Method = (input: any) => Promise<any>;

export type Infer<T> = T extends {
  input: S.Schema<infer I>;
  output: S.Schema<infer O>;
}
  ? (input: I) => Promise<O>
  : never;

export type Feature<T extends AnyFeature> = {
  [K in keyof T["schema"]]: Infer<T["schema"][K]>;
};

export type AnyFeature = {
  name: string;
  schema: Record<string, Callable<S.Schema<any>, S.Schema<any>>>;
};

export const cableSchema = S.schema({
  feature: S.string,
  method: S.string,
  input: S.unknown,
});

export type CableInput = S.Infer<typeof cableSchema>;

export function makeRemote<A extends AnyFeature>(feature: A, cable: Cable) {
  const featureName = feature.name;
  const schema = feature.schema;
  return new Proxy(
    {},
    {
      get: (_, method) => {
        const callable = schema[method as keyof typeof schema] as unknown;
        return async (arg: unknown) => {
          const { input, output } = callable as Callable<S.Schema<unknown>, S.Schema<unknown>>;
          const parsedInput = S.parseOrThrow(arg, input);
          const result = await cable(featureName, String(method), parsedInput);
          return S.parseOrThrow(result, output);
        };
      },
    },
  ) as Feature<A>;
}

/// Server
export type Route<Ctx> = {
  call: (ctx: Ctx, method: string, arg: unknown) => Promise<unknown>;
};

export function makeRoute<Ctx, A extends AnyFeature>(feature: A, implFn: (ctx: Ctx) => Feature<A>): Route<Ctx> {
  // const featureName = feature.name;
  const schema = feature.schema;
  return {
    call: async (ctx: Ctx, method: keyof typeof schema, arg: unknown) => {
      const callable = schema[method];
      if (!callable) {
        throw new Error(`Method ${String(method)} not found`);
      }
      const { input, output } = callable;
      const parsedInput = S.parseOrThrow(arg, input);
      const impl = implFn(ctx);
      const fn = impl[method as keyof typeof impl];
      if (!fn) {
        throw new Error(`Method implementation for ${feature.name}.${String(method)} not found`);
      }
      const result = await fn(parsedInput);
      return JSON.stringify(S.parseOrThrow(result, output));
    },
  };
}

export function makeRouter<Ctx>(routes: Record<string, Route<Ctx>>) {
  return async (ctx: Ctx, payload: unknown) => {
    const { feature, method, input } = S.parseOrThrow(payload, cableSchema);
    const route = routes[feature];
    if (!route) {
      throw new Error(`Feature ${feature} not found`);
    }
    return await route.call(ctx, method, input);
  };
}

