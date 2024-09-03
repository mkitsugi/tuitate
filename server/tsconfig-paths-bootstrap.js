const tsConfigPaths = require("tsconfig-paths");
const tsConfig = require("./tsconfig.json");
const path = require("path");

const baseUrl = path.join(__dirname, "dist");
const cleanup = tsConfigPaths.register({
  baseUrl,
  paths: {
    "@shared/*": ["shared/*"],
  },
});

// Optionally, you can call cleanup() when your app is shutting down.
