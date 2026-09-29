const dayjs = require("dayjs");
const { CHECKS } = require("release-check-config");
const { z } = require("zod");

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
      checks: CHECKS.map((name) => ({ name, passed: false })),
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
   * A release is ready only when every check has passed.
   */
  readiness(id) {
    const record = this.releases.get(id);
    if (!record) {
      return undefined;
    }
    const passed = record.checks.filter((check) => check.passed);
    return {
      id,
      ready: passed.length === record.checks.length,
      passed: passed.length,
      total: record.checks.length,
      outstanding: record.checks.filter((check) => !check.passed).map((check) => check.name),
    };
  }
}

module.exports = { ReleaseStore, releaseSchema, CHECKS };
