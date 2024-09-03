const tsConfigPaths = require("tsconfig-paths");
const tsConfig = require("./tsconfig.json");
const path = require("path");

const baseUrl = path.join(__dirname, tsConfig.compilerOptions.outDir);

tsConfigPaths.register({
  baseUrl,
  paths: tsConfig.compilerOptions.paths,
});
