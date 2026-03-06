import * as esbuild from "esbuild";
import { cpSync } from "node:fs";

const isWatch = process.argv.includes("--watch");

const buildOptions: esbuild.BuildOptions = {
  entryPoints: ["src/client/index.ts"],
  bundle: true,
  outfile: "dist/client/bundle.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  minify: !isWatch,
};

function copyHtml(): void {
  cpSync("src/client/index.html", "dist/client/index.html");
}

async function build(): Promise<void> {
  copyHtml();

  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log("[esbuild] Watching for changes...");
  } else {
    await esbuild.build(buildOptions);
    console.log("[esbuild] Build complete.");
  }
}

build();
