const request = require("supertest");

const { createApp } = require("../src/app");
const { CHECKS } = require("../src/releases");

const validRelease = { service: "testrepo1", version: "1.2.3", stage: "gamma" };

let app;

beforeEach(() => {
  app = createApp();
});

describe("health", () => {
  it("reports ok", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok", service: "testrepo1" });
  });
});

describe("releases", () => {
  it("creates a release with all checks outstanding", async () => {
    const response = await request(app).post("/api/releases").send(validRelease).expect(201);
    expect(response.body.id).toBe("rel-1");
    expect(response.body.checks).toHaveLength(CHECKS.length);
    expect(response.body.checks.every((check) => check.passed === false)).toBe(true);
  });

  it("rejects a non-semver version", async () => {
    const response = await request(app)
      .post("/api/releases")
      .send({ ...validRelease, version: "v1" })
      .expect(400);
    expect(response.body.message).toBe("invalid release");
  });

  it("rejects an unknown stage", async () => {
    await request(app)
      .post("/api/releases")
      .send({ ...validRelease, stage: "staging" })
      .expect(400);
  });

  it("lists created releases", async () => {
    await request(app).post("/api/releases").send(validRelease).expect(201);
    const response = await request(app).get("/api/releases").expect(200);
    expect(response.body.releases).toHaveLength(1);
  });

  it("404s an unknown release", async () => {
    await request(app).get("/api/releases/rel-999").expect(404);
  });
});

describe("readiness", () => {
  it("is not ready until every check passes", async () => {
    const created = await request(app).post("/api/releases").send(validRelease).expect(201);
    const { id } = created.body;

    let readiness = await request(app).get(`/api/releases/${id}/readiness`).expect(200);
    expect(readiness.body).toMatchObject({ ready: false, passed: 0, total: CHECKS.length });

    for (const check of CHECKS.slice(0, -1)) {
      await request(app).post(`/api/releases/${id}/checks/${check}`).expect(200);
    }

    readiness = await request(app).get(`/api/releases/${id}/readiness`).expect(200);
    expect(readiness.body.ready).toBe(false);
    expect(readiness.body.outstanding).toEqual([CHECKS[CHECKS.length - 1]]);

    await request(app)
      .post(`/api/releases/${id}/checks/${CHECKS[CHECKS.length - 1]}`)
      .expect(200);

    readiness = await request(app).get(`/api/releases/${id}/readiness`).expect(200);
    expect(readiness.body).toMatchObject({ ready: true, passed: CHECKS.length, outstanding: [] });
  });

  it("404s an unknown check", async () => {
    const created = await request(app).post("/api/releases").send(validRelease).expect(201);
    await request(app).post(`/api/releases/${created.body.id}/checks/nope`).expect(404);
  });
});
