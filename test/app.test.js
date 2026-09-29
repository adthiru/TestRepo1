const request = require("supertest");

const { createApp } = require("../src/app");
const { CHECKS, GATES } = require("../src/releases");

const BLOCKING = GATES.filter((gate) => gate.blocking).map((gate) => gate.name);
const ADVISORY = GATES.filter((gate) => !gate.blocking).map((gate) => gate.name);

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

describe("gates", () => {
  it("serves the gate catalogue with ownership and blocking metadata", async () => {
    const response = await request(app).get("/api/gates").expect(200);
    expect(response.body.gates).toEqual(GATES);
    expect(response.body.gates.every((gate) => typeof gate.owner === "string")).toBe(true);
  });

  it("stamps each check on a new release with its gate metadata", async () => {
    const response = await request(app).post("/api/releases").send(validRelease).expect(201);
    for (const check of response.body.checks) {
      const gate = GATES.find((item) => item.name === check.name);
      expect(check).toMatchObject({ blocking: gate.blocking, owner: gate.owner });
    }
  });

  it("is ready once every blocking gate passes, even with an advisory gate outstanding", async () => {
    expect(ADVISORY.length).toBeGreaterThan(0);

    const created = await request(app).post("/api/releases").send(validRelease).expect(201);
    const { id } = created.body;

    for (const check of BLOCKING) {
      await request(app).post(`/api/releases/${id}/checks/${check}`).expect(200);
    }

    const readiness = await request(app).get(`/api/releases/${id}/readiness`).expect(200);
    expect(readiness.body.ready).toBe(true);
    expect(readiness.body.outstanding).toEqual(ADVISORY);
    expect(readiness.body.blocking).toMatchObject({
      passed: BLOCKING.length,
      total: BLOCKING.length,
      outstanding: [],
    });
    expect(readiness.body.advisory).toMatchObject({
      passed: 0,
      total: ADVISORY.length,
      outstanding: ADVISORY,
    });
  });

  it("is not ready while a blocking gate is outstanding", async () => {
    const created = await request(app).post("/api/releases").send(validRelease).expect(201);
    const { id } = created.body;

    for (const check of ADVISORY) {
      await request(app).post(`/api/releases/${id}/checks/${check}`).expect(200);
    }

    const readiness = await request(app).get(`/api/releases/${id}/readiness`).expect(200);
    expect(readiness.body.ready).toBe(false);
    expect(readiness.body.blocking.outstanding).toEqual(BLOCKING);
  });
});
