// Regression checks for guard-bash.mjs. Run: node --test .claude/hooks/guard-bash.check.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const guard = fileURLToPath(new URL("./guard-bash.mjs", import.meta.url));
const run = (command) =>
  spawnSync(process.execPath, [guard], { input: JSON.stringify({ tool_input: { command } }) }).status;

const blocked = [
  "cat .env",
  "cat .env.local",
  "cat ./.dev.vars",
  "cp .dev.vars.example .dev.vars",
  "cat .env*",
  "cat ./.env*",
  "head .e?v",
  "cat .env.[lp]*",
  "cat .dev.v*",
  "cat .{env,foo}",
  "cat .*",
  'cat ".e"*',
  "cat .e[n]v",
  "cat .env.local[",
  "git push --force",
  "rm -rf src",
];

const allowed = [
  "cat .env.example",
  "cp .env.example .env.example.bak",
  "npm run lint",
  "rm -rf node_modules",
  "ls .github/*",
  "cat .prettier*",
  "cat *",
  "ls src/*.ts",
  "git log --oneline -5",
];

for (const command of blocked) {
  test(`blocks: ${command}`, () => assert.equal(run(command), 2));
}
for (const command of allowed) {
  test(`allows: ${command}`, () => assert.equal(run(command), 0));
}
