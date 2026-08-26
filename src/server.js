const { createApp } = require("./app");

const port = Number(process.env.PORT) || 3000;

createApp().listen(port, () => {
  process.stdout.write(`testrepo1 listening on port ${port}\n`);
});
