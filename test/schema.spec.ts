import {describe, it, expect} from "vitest";
import * as S from "sury";
import {feature, transform} from "../src/telegraphy";

describe("Feature: Schema-based feature definition", () => {
  describe("Scenario: Defining a feature with schema", () => {
    it("Given a feature name and schema, When feature is created, Then it should have correct structure", () => {
      const userFeature = feature("user", {
        getProfile: transform(S.schema({id: S.number})).to(
          S.schema({id: S.number, name: S.string})
        ),
      });

      expect(userFeature.name).toBe("user");
      expect(userFeature.schema).toBeDefined();
      expect(userFeature.schema.getProfile).toBeDefined();
      expect(userFeature.schema.getProfile.input).toBeDefined();
      expect(userFeature.schema.getProfile.output).toBeDefined();
    });
  });

  describe("Scenario: Defining input-output transformation", () => {
    it("Given input and output schemas, When transform is used, Then it should create a callable definition", () => {
      const inputSchema = S.schema({id: S.number});
      const outputSchema = S.schema({id: S.number, name: S.string});

      const callable = transform(inputSchema).to(outputSchema);

      expect(callable.input).toBe(inputSchema);
      expect(callable.output).toBe(outputSchema);
    });
  });

  describe("Scenario: Complex feature with multiple method schemas", () => {
    it("Given multiple methods with different schemas, When feature is created, Then all methods should be properly defined", () => {
      const taskFeature = feature("task", {
        create: transform(
          S.schema({
            title: S.string,
            description: S.string,
          })
        ).to(
          S.schema({
            id: S.number,
            title: S.string,
            description: S.string,
            createdAt: S.string,
          })
        ),
        update: transform(
          S.schema({
            id: S.number,
            title: S.optional(S.string),
            description: S.optional(S.string),
          })
        ).to(
          S.schema({
            id: S.number,
            title: S.string,
            description: S.string,
            updatedAt: S.string,
          })
        ),
        delete: transform(S.schema({id: S.number})).to(
          S.schema({success: S.boolean})
        ),
        list: transform(S.schema({})).to(
          S.array(
            S.schema({
              id: S.number,
              title: S.string,
            })
          )
        ),
      });

      expect(taskFeature.name).toBe("task");
      expect(Object.keys(taskFeature.schema)).toHaveLength(4);
      expect(taskFeature.schema.create).toBeDefined();
      expect(taskFeature.schema.update).toBeDefined();
      expect(taskFeature.schema.delete).toBeDefined();
      expect(taskFeature.schema.list).toBeDefined();
    });
  });

  describe("Scenario: Nested schema structures", () => {
    it("Given nested schemas, When feature is created, Then it should handle complex types", () => {
      const orderFeature = feature("order", {
        create: transform(
          S.schema({
            userId: S.number,
            items: S.array(
              S.schema({
                productId: S.number,
                quantity: S.number,
              })
            ),
            shipping: S.schema({
              address: S.string,
              city: S.string,
              zipCode: S.string,
            }),
          })
        ).to(
          S.schema({
            orderId: S.number,
            status: S.string,
            total: S.number,
          })
        ),
      });

      expect(orderFeature.name).toBe("order");
      expect(orderFeature.schema.create).toBeDefined();
      expect(orderFeature.schema.create.input).toBeDefined();
      expect(orderFeature.schema.create.output).toBeDefined();
    });
  });
});

