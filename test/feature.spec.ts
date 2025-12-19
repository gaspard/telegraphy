import {describe, it, expect, vi} from "vitest";
import * as S from "sury";
import {feature, transform, makeRemote, makeRoute, makeRouter, type Feature} from "../src/telegraphy";

describe("feature", () => {
  it("maintains type safety from feature to remote to implementation", async () => {
    // Define missions feature
    const missionSchema = S.schema({id: S.number, title: S.string, completed: S.boolean});

    const missionsFeature = feature("missions", {
      create: transform(
        S.schema({title: S.string})
      ).to(
        missionSchema
      ),
      list: transform(S.schema({})).to(
        S.array(
          missionSchema
        )
      ),
      complete: transform(S.schema({id: S.number})).to(
        missionSchema
      ),
      get: transform(S.schema({id: S.number})).to(
        missionSchema
      ),
    });

    type Ctx = {
      missions: Array<{id: number; title: string; completed: boolean}>;
    };

    const missionsImpl = (ctx: Ctx): Feature<typeof missionsFeature> => ({
      create: async (input) => {
        const mission = {
          id: ctx.missions.length + 1,
          title: input.title,
          completed: false,
        };
        ctx.missions.push(mission);
        return mission;
      },
      list: async () => ctx.missions,
      complete: async (input) => {
        const mission = ctx.missions.find((m) => m.id === input.id);
        if (!mission) throw new Error("Mission not found");
        mission.completed = true;
        return mission;
      },
      get: async (input) => {
        const mission = ctx.missions.find((m) => m.id === input.id);
        if (!mission) throw new Error("Mission not found");
        return mission;
      },
    });

    // Create route and router
    const route = makeRoute(missionsFeature, missionsImpl);
    const router = makeRouter({missions: route});

    // Create context
    const ctx: Ctx = {missions: []};

    // Create cable that serializes and passes through router
    const cable = async (feature: string, method: string, input: unknown) => {
      const payload = {feature, method, input};
      const result = await router(ctx, payload);
      return JSON.parse(result as string);
    };

    // Could use `missions` directly here during development and then WARP it to remote.
    // const missions = missionsImpl(mockCtx);
    const missions = makeRemote(missionsFeature, cable);

    // Create missions - goes through full stack: missions → cable → router → route → missionsImpl 
    let mission1 = await missions.create({title: "Explore strange new worlds"});
    expect(mission1.id).toBe(1);
    expect(mission1.title).toBe("Explore strange new worlds");
    expect(mission1.completed).toBe(false);

    const mission2 = await missions.create({title: "Seek out new life"});
    expect(mission2.id).toBe(2);
    expect(mission2.title).toBe("Seek out new life");

    // List missions
    const allMissions = await missions.list({});
    expect(allMissions).toHaveLength(2);
    expect(allMissions[0].title).toBe("Explore strange new worlds");
    expect(allMissions[1].title).toBe("Seek out new life");

    // Complete mission
    const completedMission = await missions.complete({id: mission1.id});
    expect(completedMission.id).toBe(mission1.id);
    expect(completedMission.title).toBe("Explore strange new worlds");
    expect(completedMission.completed).toBe(true);

    // Get completed mission
    mission1 = await missions.get({id: mission1.id});
    expect(mission1.id).toBe(mission1.id);
    expect(mission1.title).toBe("Explore strange new worlds");
    expect(mission1.completed).toBe(true);
  });
});
