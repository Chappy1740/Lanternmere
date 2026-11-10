// Regression checks for guard-bash.mjs. Run: node --test .claude/hooks/guard-bash.check.mjs
// Commands run against a temporary fixture folder that holds dummy secret files,
// so the on-disk checks (grep -r, find -exec, rg --hidden) are exercised.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import assert from "node:assert/strict";

const guard = fileURLToPath(new URL("./guard-bash.mjs", import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), "guard-bash-"));
for (const dir of ["src", "docs", "dist/server"]) mkdirSync(join(fixture, dir), { recursive: true });
for (const file of [".env", ".env.example", ".dev.vars", "dist/server/.dev.vars", "src/a.ts", "docs/x.md"]) {
  writeFileSync(join(fixture, file), "DUMMY=not-a-secret\n");
}
after(() => rmSync(fixture, { recursive: true, force: true }));

const runRaw = (input, nodeArgs = []) =>
  spawnSync(process.execPath, [...nodeArgs, guard], { input, cwd: fixture }).status;
const run = (command) => runRaw(JSON.stringify({ cwd: fixture, tool_input: { command } }));

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
  "echo \"$(printf '(')\"; cat .e?v",
  "echo \"$(printf ')'; cat .e*)\"",
  "echo \"$(cat .env*",
  'echo "`cat .env*',
  "/bin/bash -c 'cat .env*'",
  "/usr/bin/env bash -c 'cat .env*'",
  "cat .en{u..w}",
  "cat .{d..f}nv",
  "cat .dev.var{r..t}",
  "git push --force",
  "rm -rf src",
  // Kept strict on purpose: nested shells and heredocs are checked with quotes removed.
  "bash -c \"rg '\\.env.*' .gitignore\"",
  "cat > /dev/null <<'EOF'\ncat .env*\nEOF",
  "bash --version; echo '.env*'",
  // ANSI-C and locale quoting spell the same names.
  "cat $'\\x2eenv'",
  "cat $'\\056env'",
  "cat $'\\u002edev.vars'",
  "cat $'.e'nv",
  'cat $".env"',
  "cat $'\\x2ee'*",
  'echo "$(cat $\'\\x2eenv\')"',
  // Patterns the tool matches itself.
  "find . -name '.env*' -exec cat {} \\;",
  "find . -iname '*.local'",
  "find . -path '*/.dev.vars*'",
  "find . -name '*' -exec cat {} +",
  "rg -g '.env*' KEY",
  "rg --glob='.env*' KEY",
  "rg --iglob '*.LOCAL' KEY",
  "grep -r --include='.env*' KEY .",
  // Recursive readers that reach a secret file in the fixture.
  "grep -r SECRET .",
  "grep -rn KEY",
  "grep -R KEY ./",
  "grep --recursive KEY dist",
  "grep -d recurse KEY .",
  "rgrep KEY .",
  "grep -r --exclude='.env*' KEY .",
  "grep -r KEY nosuchdir",
  "grep -r KEY $HOME",
  "cd docs && grep -r KEY .",
  "rg --hidden KEY",
  "rg -uu KEY .",
  "rg -. KEY",
  "rg --hidden -g '!.env*' KEY",
  "find . -type f -exec cat {} +",
  "find . -type f | xargs cat",
  "find dist -type f -exec head {} +",
  "cat $(find . -type f)",
  'while read f; do cat "$f"; done < <(find . -type f)',
  "find . -type f -print0 | xargs -0 cat",
  "sudo grep -r KEY .",
  "grep -r -e KEY -- .",
  "find . -name '*.ts' -o -type f -exec cat {} +",
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
  "echo \"$(printf '(')\" done",
  'echo "$(git log --format="%h (%s)" -1)"',
  "ls {1..3}.txt",
  "seq 1 3; echo {a..c}",
  "/bin/bash scripts/check.sh",
  // New rules must not block ordinary work.
  "printf '%s\\n' $'hello\\tworld'",
  "cat $'src/a.ts'",
  "grep -rn KEY src",
  "grep -rn KEY src docs 2>/dev/null",
  "grep -r --exclude='.env*' --exclude='.dev.vars*' KEY .",
  "grep -r --include='*.ts' KEY .",
  "grep -n KEY src/a.ts",
  "git grep -n KEY",
  "rg KEY .",
  "rg -n --hidden -g '*.ts' KEY",
  "rg --hidden -g '!.env*' -g '!.dev.vars*' KEY",
  "rg --files --hidden",
  "rg -g '!.env*' KEY",
  "find src -type f -exec cat {} +",
  "find . -name '*.ts' | xargs wc -l",
  "find . -type f | wc -l",
  "find . -type f -not -name '.env*' -not -name '.dev.vars*' -exec cat {} +",
  "find . -name .gitignore",
  "npm install -g typescript",
];

for (const command of blocked) {
  test(`blocks: ${command}`, () => assert.equal(run(command), 2));
}
for (const command of allowed) {
  test(`allows: ${command}`, () => assert.equal(run(command), 0));
}

// Fails closed: anything the hook cannot read or finish checking is blocked.
test("blocks: input that is not JSON", () => assert.equal(runRaw("not json"), 2));
test("blocks: a non-string command", () =>
  assert.equal(runRaw(JSON.stringify({ tool_input: { command: 5 } })), 2));
test("allows: a call with no command", () => assert.equal(runRaw(JSON.stringify({ tool_input: {} })), 0));
test("blocks: an internal error while checking", () => {
  const breakRegExp = "data:text/javascript,RegExp.prototype.test=()=>{throw new Error('injected')}";
  const input = JSON.stringify({ cwd: fixture, tool_input: { command: "ls" } });
  assert.equal(runRaw(input, ["--import", breakRegExp]), 2);
});

// Known gaps no command-text check can close. The Bash sandbox (denyRead) covers them on
// macOS, Linux and WSL2, but not on native Windows. Node lists these as todo, not failures.
for (const command of ["f=.e; cat ${f}nv", "ls -A | xargs cat", "cat $(printf '\\056env')"]) {
  test(`known gap (not detectable from command text): ${command}`, { todo: true }, () =>
    assert.equal(run(command), 2));
}
