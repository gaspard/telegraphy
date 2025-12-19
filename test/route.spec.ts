import {describe, it, expect} from "vitest";
import * as S from "sury";
import {feature, makeRoute, makeRouter, transform, type Feature} from "../src/telegraphy";

describe("Routes: Server-side implementation", () => {
  it("creates routes and calls implementations", async () => {
    const crewFeature = feature("crew", {
      getOfficer: transform(S.schema({id: S.number})).to(
        S.schema({id: S.number, name: S.string, rank: S.string})
      ),
    });

    type Ctx = {officers: Map<number, {id: number; name: string; rank: string}>};

    const crewImpl = (ctx: Ctx): Feature<typeof crewFeature> => ({
      getOfficer: async (input) => ctx.officers.get(input.id)!,
    });

    const route = makeRoute(crewFeature, crewImpl);
    const ctx: Ctx = {
      officers: new Map([[1, {id: 1, name: "Picard", rank: "Captain"}]]),
    };

    const result = await route.call(ctx, "getOfficer", {id: 1});

    expect(JSON.parse(result as string)).toEqual({
      id: 1,
      name: "Picard",
      rank: "Captain",
    });
  });

  it("routes requests to multiple features", async () => {
    const crewFeature = feature("crew", {
      getOfficer: transform(S.schema({id: S.number})).to(S.schema({name: S.string})),
    });

    const missionsFeature = feature("missions", {
      list: transform(S.schema({})).to(S.array(S.schema({title: S.string}))),
    });

    type Ctx = {crew: {name: string}[]; missions: {title: string}[]};

    const router = makeRouter({
      crew: makeRoute(crewFeature, (ctx: Ctx) => ({
        getOfficer: async (input) => ({name: ctx.crew[input.id - 1].name}),
      })),
      missions: makeRoute(missionsFeature, (ctx: Ctx) => ({
        list: async () => ctx.missions,
      })),
    });

    const ctx: Ctx = {
      crew: [{name: "Picard"}],
      missions: [{title: "Explore Sector 001"}],
    };

    const crewResult = await router(ctx, {
      feature: "crew",
      method: "getOfficer",
      input: {id: 1},
    });
    expect(JSON.parse(crewResult as string)).toEqual({name: "Picard"});

    const missionsResult = await router(ctx, {
      feature: "missions",
      method: "list",
      input: {},
    });
    expect(JSON.parse(missionsResult as string)).toEqual([{title: "Explore Sector 001"}]);
  });
});
