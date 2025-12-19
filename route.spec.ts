import {describe, it, expect} from "vitest";
import * as S from "sury";
import {
  feature,
  makeRoute,
  makeRouter,
  transform,
  type Feature,
} from "./index";

describe("Feature: Server-side route handling", () => {
  describe("Scenario: Creating a route from feature implementation", () => {
    it("Given a feature and implementation, When a route is created, Then it should handle method calls", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      type Ctx = {db: {users: Map<number, {id: number; name: string}>}};

      const userImpl = (ctx: Ctx): Feature<typeof userFeature> => ({
        getProfile: async (input) => {
          const user = ctx.db.users.get(input.id);
          if (!user) throw new Error("User not found");
          return user;
        },
      });

      const route = makeRoute(userFeature, userImpl);

      const ctx: Ctx = {
        db: {
          users: new Map([[1, {id: 1, name: "Alice"}]]),
        },
      };

      const result = await route.call(ctx, "getProfile", {id: 1});

      expect(JSON.parse(result as string)).toEqual({id: 1, name: "Alice"});
    });
  });

  describe("Scenario: Handling invalid method calls", () => {
    it("Given a route, When a non-existent method is called, Then it should throw an error", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      type Ctx = {db: any};

      const userImpl = (ctx: Ctx): Feature<typeof userFeature> => ({
        getProfile: async (input) => ({id: input.id, name: "Test"}),
      });

      const route = makeRoute(userFeature, userImpl);
      const ctx: Ctx = {db: {}};

      await expect(route.call(ctx, "nonExistent", {})).rejects.toThrow(
        "Method nonExistent not found"
      );
    });
  });

  describe("Scenario: Input validation on server side", () => {
    it("Given a route, When invalid input is provided, Then it should throw validation error", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      type Ctx = {};

      const userImpl = (ctx: Ctx): Feature<typeof userFeature> => ({
        getProfile: async (input) => ({id: input.id, name: "Test"}),
      });

      const route = makeRoute(userFeature, userImpl);
      const ctx: Ctx = {};

      await expect(
        route.call(ctx, "getProfile", {id: "not-a-number"})
      ).rejects.toThrow();
    });
  });

  describe("Scenario: Output validation on server side", () => {
    it("Given a route, When implementation returns invalid output, Then it should throw validation error", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      type Ctx = {};

      const userImpl = (ctx: Ctx): Feature<typeof userFeature> => ({
        getProfile: async (input) => ({id: input.id} as any),
      });

      const route = makeRoute(userFeature, userImpl);
      const ctx: Ctx = {};

      await expect(route.call(ctx, "getProfile", {id: 1})).rejects.toThrow();
    });
  });
});

describe("Feature: Router for multiple features", () => {
  describe("Scenario: Routing requests to different features", () => {
    it("Given a router with multiple features, When requests are made, Then they should be routed correctly", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      const postFeature = feature("post", {
        getPost: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, title: S.string})
        ),
      });

      type Ctx = {
        users: Map<number, {id: number; name: string}>;
        posts: Map<number, {id: number; title: string}>;
      };

      const userImpl = (ctx: Ctx): Feature<typeof userFeature> => ({
        getProfile: async (input) => {
          const user = ctx.users.get(input.id);
          if (!user) throw new Error("User not found");
          return user;
        },
      });

      const postImpl = (ctx: Ctx): Feature<typeof postFeature> => ({
        getPost: async (input) => {
          const post = ctx.posts.get(input.id);
          if (!post) throw new Error("Post not found");
          return post;
        },
      });

      const router = makeRouter({
        user: makeRoute(userFeature, userImpl),
        post: makeRoute(postFeature, postImpl),
      });

      const ctx: Ctx = {
        users: new Map([[1, {id: 1, name: "Alice"}]]),
        posts: new Map([[1, {id: 1, title: "Hello World"}]]),
      };

      const userResult = await router(ctx, {
        feature: "user",
        method: "getProfile",
        input: {id: 1},
      });
      expect(JSON.parse(userResult as string)).toEqual({
        id: 1,
        name: "Alice",
      });

      const postResult = await router(ctx, {
        feature: "post",
        method: "getPost",
        input: {id: 1},
      });
      expect(JSON.parse(postResult as string)).toEqual({
        id: 1,
        title: "Hello World",
      });
    });
  });

  describe("Scenario: Handling requests to non-existent features", () => {
    it("Given a router, When a request for non-existent feature is made, Then it should throw an error", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      type Ctx = {};

      const userImpl = (ctx: Ctx): Feature<typeof userFeature> => ({
        getProfile: async (input) => ({id: input.id, name: "Test"}),
      });

      const router = makeRouter({
        user: makeRoute(userFeature, userImpl),
      });

      const ctx: Ctx = {};

      await expect(
        router(ctx, {
          feature: "nonExistent",
          method: "someMethod",
          input: {},
        })
      ).rejects.toThrow("Feature nonExistent not found");
    });
  });

  describe("Scenario: Router validates incoming payloads", () => {
    it("Given a router, When invalid payload is provided, Then it should throw validation error", async () => {
      const router = makeRouter({});
      const ctx = {};

      await expect(
        router(ctx, {invalid: "payload"})
      ).rejects.toThrow();
    });
  });
});
