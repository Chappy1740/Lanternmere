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
  "cat .{env,{a,b}}",
  "cat .env.d*",
  "cat .env.*.local",
  "cat .dev.vars.*",
  "cat .d*",
  'cat .e"n"v*',
  "cat src/../.env.?ocal",
  "cat .env.stag*",
  "head .env.[dt]*",
  "cat .e[[:alpha:]]v",
  "cat .e[[:lower:]]v",
  "cat {.e[[:lower:]]v,x}",
  "printf '%s\\n' \"$(cat .env*)\"",
  'echo "$(cat .e?v)"',
  "printf '%s\\n' \"$(cat .e*)\"",
  'echo "`cat .env*`"',
  'echo "x$(cat "$(echo y)" .env*)z"',
  "echo $(cat .env*)",
  "cat .{env,x}",
  "cat {.env,x}",
  "cat .env{,.local}",
  "bash -c 'cat .env*'",
  "sh -c \"head .e?v\"",
  "eval 'cat .dev.vars.*'",
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
  "awk '{print $1}' file.txt",
  'node -e "if (x) { console.log(1) }"',
  "jq '{a: .b}' data.json",
  "find . -name '*.ts' -exec wc -l {} +",
  "cat .prettier{rc,ignore}",
  "rg '\\.env.*' .gitignore",
  'grep ".env*" .gitignore',
  "grep -n .env\\* .gitignore",
  "echo '.*'",
  "echo '.env*'",
  "printf '%s\\n' '.*'",
  "rg '.*' CONTRIBUTING.md",
  "rg '\\.env.*' src",
  "cat .env.example*",
  "ls .dev.vars.example*",
  "cat .eslint*",
  "ls .dockerignore*",
  "ls .{github,claude}",
  "cat .{gitignore,gitattributes}",
  "cat .env{.example,.example.bak}",
  "cat .env[",
  "echo '$(cat .env*)'",
  'echo "$(git status)"',
  'git commit -m "Fix `cat` docs"',
];

for (const command of blocked) {
  test(`blocks: ${command}`, () => assert.equal(run(command), 2));
}
for (const command of allowed) {
  test(`allows: ${command}`, () => assert.equal(run(command), 0));
}
