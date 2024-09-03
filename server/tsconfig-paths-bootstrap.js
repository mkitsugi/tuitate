const tsConfigPaths = require("tsconfig-paths");
const tsConfig = require("./tsconfig.json");
const path = require("path");

const baseUrl = path.join(__dirname, "dist");
const cleanup = tsConfigPaths.register({
  baseUrl,
  paths: {
    "@shared/*": [path.join(__dirname, "..", "shared", "*")],
  },
});

// When path registration is no longer needed
// cleanup();
