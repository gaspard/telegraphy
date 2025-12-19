import {describe, it, expect, beforeEach, vi} from "vitest";
import * as S from "sury";
import {
  feature,
  makeRemote,
  transform,
  type Cable,
  type Feature,
} from "../src/telegraphy";
import {httpCable} from "../src/http";

describe("Feature: Client-side cable communication", () => {
  describe("Scenario: Creating a cable with valid configuration", () => {
    it("Given an endpoint and auth token, When cable is created, Then it should be ready for communication", () => {
      const endpoint = "https://api.example.com/rpc";
      const auth = {token: "test-token"};

      const cable = httpCable(endpoint, auth);

      expect(cable).toBeDefined();
      expect(typeof cable).toBe("function");
    });
  });

  describe("Scenario: Creating a cable without endpoint", () => {
    it("Given no endpoint, When cable creation is attempted, Then it should throw an error", () => {
      const auth = {token: "test-token"};

      expect(() => httpCable(undefined, auth)).toThrow(
        "Backend endpoint is not set"
      );
    });
  });

  describe("Scenario: Making a remote call with authentication", () => {
    let cable: Cable;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    it("Given an authenticated cable, When a remote method is called, Then it should send the correct request", async () => {
      const endpoint = "https://api.example.com/rpc";
      const auth = {token: "test-token-123"};
      cable = httpCable(endpoint, auth);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({success: true}),
      });

      await cable("user", "getProfile", {id: 42});

      expect(mockFetch).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            feature: "user",
            method: "getProfile",
            input: {id: 42},
          }),
          headers: expect.any(Headers),
        })
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.get("Authorization")).toBe("Bearer test-token-123");
      expect(headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("Scenario: Making a call without authentication", () => {
    it("Given a cable without auth token, When a remote method is called, Then it should throw an error", async () => {
      const endpoint = "https://api.example.com/rpc";
      const auth = {token: null};
      const cable = httpCable(endpoint, auth);

      await expect(cable("user", "getProfile", {id: 42})).rejects.toThrow(
        "User not authenticated, cannot call cable without a token"
      );
    });
  });

  describe("Scenario: Handling failed remote calls", () => {
    let cable: Cable;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    it("Given a cable, When the remote call fails, Then it should throw an error with details", async () => {
      const endpoint = "https://api.example.com/rpc";
      const auth = {token: "test-token"};
      cable = httpCable(endpoint, auth);

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(cable("user", "getProfile", {id: 42})).rejects.toThrow(
        "Failed to call user.getProfile: Internal Server Error"
      );
    });
  });
});

describe("Feature: Type-safe remote feature creation", () => {
  describe("Scenario: Creating a remote feature proxy", () => {
    let mockCable: Cable;

    beforeEach(() => {
      mockCable = vi.fn(async (feature, method, input) => {
        if (feature === "user" && method === "getProfile") {
          return {id: (input as any).id, name: "John Doe"};
        }
        return null;
      });
    });

    it("Given a feature schema, When creating a remote proxy, Then it should validate input and output", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      const remote = makeRemote(userFeature, mockCable);

      const result = await remote.getProfile({id: 42});

      expect(result).toEqual({id: 42, name: "John Doe"});
      expect(mockCable).toHaveBeenCalledWith("user", "getProfile", {id: 42});
    });

    it("Given invalid input, When calling a remote method, Then it should throw validation error", async () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      const remote = makeRemote(userFeature, mockCable);

      await expect(
        remote.getProfile({id: "not-a-number"} as any)
      ).rejects.toThrow();
    });
  });

  describe("Scenario: Feature definition with multiple methods", () => {
    it("Given a feature with multiple methods, When creating remote proxy, Then all methods should be accessible", async () => {
      const mockCable = vi.fn(async (feature, method, input) => {
        if (method === "create") return {id: 1, email: (input as any).email};
        if (method === "delete") return {success: true};
        return null;
      });

      const userFeature = feature("user", {
        create: transform(S.schema({email: S.string})).to(
          S.schema({id: S.number, email: S.string})
        ),
        delete: transform(S.schema({id: S.number})).to(
          S.schema({success: S.boolean})
        ),
      });

      const remote = makeRemote(userFeature, mockCable);

      const createResult = await remote.create({email: "test@example.com"});
      expect(createResult).toEqual({id: 1, email: "test@example.com"});

      const deleteResult = await remote.delete({id: 1});
      expect(deleteResult).toEqual({success: true});
    });
  });
});

