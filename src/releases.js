const dayjs = require("dayjs");
const { GATES } = require("release-check-config");
const { z } = require("zod");

const CHECKS = GATES.map((gate) => gate.name);
const GATES_BY_NAME = new Map(GATES.map((gate) => [gate.name, gate]));

const releaseSchema = z.object({
  service: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver-like"),
  stage: z.enum(["beta", "gamma", "prod"]),
});

/**
 * In-memory store. Keeps behaviour deterministic across runs.
 */
class ReleaseStore {
  constructor() {
    this.releases = new Map();
    this.nextId = 1;
  }

  create(input) {
    const release = releaseSchema.parse(input);
    const id = `rel-${this.nextId++}`;
    const record = {
      id,
      ...release,
      createdAt: dayjs().toISOString(),
      checks: GATES.map((gate) => ({
        name: gate.name,
        blocking: gate.blocking,
        owner: gate.owner,
        passed: false,
      })),
    };
    this.releases.set(id, record);
    return record;
  }

  get(id) {
    return this.releases.get(id);
  }

  list() {
    return [...this.releases.values()];
  }

  markCheck(id, checkName) {
    const record = this.releases.get(id);
    if (!record) {
      return undefined;
    }
    const check = record.checks.find((item) => item.name === checkName);
    if (!check) {
      return undefined;
    }
    check.passed = true;
    return record;
  }

  /**
   * A release is ready once every blocking gate has passed. Advisory gates are
   * still tracked and reported, but they never hold up a release.
   */
  readiness(id) {
    const record = this.releases.get(id);
    if (!record) {
      return undefined;
    }

    const summarise = (checks) => ({
      passed: checks.filter((check) => check.passed).length,
      total: checks.length,
      outstanding: checks.filter((check) => !check.passed).map((check) => check.name),
    });

    const overall = summarise(record.checks);
    const blocking = summarise(record.checks.filter((check) => check.blocking));
    const advisory = summarise(record.checks.filter((check) => !check.blocking));

    return {
      id,
      ready: blocking.outstanding.length === 0,
      ...overall,
      blocking,
      advisory,
    };
  }
}

module.exports = { ReleaseStore, releaseSchema, CHECKS, GATES, GATES_BY_NAME };
