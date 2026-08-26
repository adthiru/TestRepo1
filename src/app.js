const express = require("express");
const { ZodError } = require("zod");

const { ReleaseStore } = require("./releases");

function createApp() {
  const app = express();
  const store = new ReleaseStore();

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "testrepo1", release: "1.0.0" });
  });

  app.post("/api/releases", (req, res) => {
    try {
      res.status(201).json(store.create(req.body));
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: "invalid release", issues: error.issues });
        return;
      }
      throw error;
    }
  });

  app.get("/api/releases", (req, res) => {
    res.json({ releases: store.list() });
  });

  app.get("/api/releases/:id", (req, res) => {
    const record = store.get(req.params.id);
    if (!record) {
      res.status(404).json({ message: "unknown release" });
      return;
    }
    res.json(record);
  });

  app.post("/api/releases/:id/checks/:check", (req, res) => {
    const record = store.markCheck(req.params.id, req.params.check);
    if (!record) {
      res.status(404).json({ message: "unknown release or check" });
      return;
    }
    res.json(record);
  });

  app.get("/api/releases/:id/readiness", (req, res) => {
    const readiness = store.readiness(req.params.id);
    if (!readiness) {
      res.status(404).json({ message: "unknown release" });
      return;
    }
    res.json(readiness);
  });

  return app;
}

module.exports = { createApp };
