// Regression checks for guard-bash.mjs. Run: node --test .claude/hooks/guard-bash.check.mjs
// Commands run against a temporary fixture folder that holds dummy secret files,
// so the on-disk checks (grep -r, find -exec, rg --hidden) are exercised.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import assert from "node:assert/strict";

const guard = fileURLToPath(new URL("./guard-bash.mjs", import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), "guard-bash-"));
const dirs = ["src", "docs", "dist/server", "a/sub", "b/sub", "nm/node_modules", "links", "big1", "big2", "big3"];
for (const dir of dirs) mkdirSync(join(fixture, dir), { recursive: true });
const files = [
  ".env", ".env.example", ".dev.vars", "dist/server/.dev.vars", "src/a.ts", "docs/x.md",
  "a/sub/ok.txt", "b/sub/.env.qa", "nm/node_modules/.env", "nm/index.js",
  ...[1, 2, 3].flatMap((n) => [1, 2, 3, 4, 5].map((f) => `big${n}/f${f}.txt`)),
];
for (const file of files) writeFileSync(join(fixture, file), "DUMMY=not-a-secret\n");
// A symlink with an ordinary name pointing at a secret (needs privileges on Windows).
let symlinks = true;
try {
  symlinkSync(join(fixture, ".env"), join(fixture, "links", "notes.txt"));
} catch {
  symlinks = false;
}
after(() => rmSync(fixture, { recursive: true, force: true }));

const runRaw = (input, nodeArgs = [], env = {}) =>
  spawnSync(process.execPath, [...nodeArgs, guard], { input, cwd: fixture, env: { ...process.env, ...env } }).status;
const run = (command, env) => runRaw(JSON.stringify({ cwd: fixture, tool_input: { command } }), [], env);

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
for (const input of [{ tool_input: {} }, { tool_input: { command: null } }, { tool_input: null }, null, {}, []]) {
  test(`blocks: hook input ${JSON.stringify(input)}`, () => assert.equal(runRaw(JSON.stringify(input)), 2));
}
test("blocks: an internal error while checking", () => {
  const breakRegExp = "data:text/javascript,RegExp.prototype.test=()=>{throw new Error('injected')}";
  const input = JSON.stringify({ cwd: fixture, tool_input: { command: "ls" } });
  assert.equal(runRaw(input, ["--import", breakRegExp]), 2);
});

// Review findings on PR #33 (Codex, 2026-11-11). Each group pairs blocked and allowed cases.
const reviewCases = {
  // 1. Recursive targets resolve from the directory each command actually runs in.
  "effective directory": {
    blocked: [
      "cd dist && grep -r KEY .",
      "cd docs && cd .. && grep -r KEY .",
      "(cd docs) && grep -r KEY .",
      "cd docs | true; grep -r KEY .",
      "cd docs & grep -r KEY .",
      "cd b && grep -r KEY sub",
      'cd "$D" && grep -r KEY .',
      "cd - && grep -r KEY .",
      "cd nosuchdir; grep -r KEY .",
      "env -C docs grep -r KEY .",
    ],
    allowed: ["cd docs && grep -r KEY .", "cd a && grep -r KEY sub", "cd src; grep -rn KEY ."],
  },
  // 2. One parse decides filters; every option spelling is evaluated by this rule.
  "filter parsing": {
    blocked: [
      "grep -r --include '*.local' KEY .",
      "grep -r --include='*.local' KEY .",
      "rg --hidden -g'*.local' KEY",
      "rg --hidden --glob '*.local' KEY",
      "rg --hidden --glob=*.LOCAL KEY",
      "rg --files --hidden | xargs cat",
    ],
    allowed: [
      "grep -r --include '*.ts' KEY .",
      "rg --hidden -g'*.ts' KEY",
      "rg --hidden --glob '*.ts' KEY",
      "rg --files --hidden -g '*.ts' | xargs wc -l",
    ],
  },
  // 3. Exclusions count only when they provably cover a whole secret family.
  exclusions: {
    blocked: [
      "grep -r --exclude='.env' --exclude='.env.[a-pr-z]*' --exclude='.dev.vars*' KEY b",
      "grep -r --exclude='src/.env*' --exclude='.dev.vars*' KEY .",
      "rg --hidden -g '!.env.local' -g '!.env' -g '!.dev.vars*' KEY b",
      "find . -type f -not -path './.env*' -not -name '.dev.vars*' -exec cat {} +",
      "find . -type f -not -name '.env*' -not -name '.dev.vars*' -o -name x -exec cat {} +",
    ],
    allowed: [
      "grep -r --exclude='.e*' --exclude='.d*' KEY .",
      "grep -r --exclude='*' KEY .",
      "rg --hidden -g '!.*' KEY",
    ],
  },
  // 4. The walk prunes only what the reader skips, and links follow the reader's mode.
  "walk coverage": {
    blocked: ["grep -r KEY nm", "rg --hidden KEY nm"],
    allowed: ["grep -r --exclude-dir=node_modules KEY nm", "rg --hidden -g '!node_modules' KEY nm"],
  },
  // 7. Only the word that runs as the command is treated as a reader.
  "command position": {
    blocked: [
      "X=1 grep -r KEY .",
      "env LC_ALL=C grep -r KEY .",
      "time grep -r KEY .",
      "nice -n 5 grep -r KEY .",
      "timeout 5 grep -r KEY .",
      "if grep -rq KEY .; then echo y; fi",
      "xargs grep -r KEY < list.txt",
      "bash -c 'grep -r KEY .'",
      "sh -lc 'cd dist && grep -r KEY .'",
      "eval grep -r KEY .",
    ],
    allowed: [
      "printf '%s\\n' grep -r needle missing-review-directory",
      "echo grep -r KEY .",
      "git log --grep find -n 5",
      "bash -c 'grep -r KEY src'",
      "xargs grep -n KEY < list.txt",
    ],
  },
};
for (const [group, { blocked: b, allowed: a }] of Object.entries(reviewCases)) {
  for (const command of b) test(`${group} blocks: ${command}`, () => assert.equal(run(command), 2));
  for (const command of a) test(`${group} allows: ${command}`, () => assert.equal(run(command), 0));
}

// 4. Symlinks: grep -r skips them, grep -R / rg -L / find without -type f follow them.
test("walk coverage: symlink handling follows each reader", { skip: !symlinks && "cannot create symlinks here" }, () => {
  assert.equal(run("grep -R KEY links"), 2);
  assert.equal(run("rg -L KEY links"), 2);
  assert.equal(run("find links -exec cat {} +"), 2);
  assert.equal(run("grep -rn KEY links/notes.txt"), 2);
  assert.equal(run("grep -r KEY links"), 0);
  assert.equal(run("find links -type f -exec cat {} +"), 0);
});

// 4. An unreadable directory is uncertain, not clean (root ignores permissions).
const canLock = process.platform !== "win32" && process.getuid?.() !== 0;
test("walk coverage: an unreadable directory blocks", { skip: !canLock && "needs a non-root POSIX user" }, () => {
  const locked = join(fixture, "locked");
  mkdirSync(locked);
  chmodSync(locked, 0);
  try {
    assert.equal(run("grep -r KEY locked"), 2);
  } finally {
    chmodSync(locked, 0o755);
  }
});

// 4. The same check on any platform: make every directory read fail.
test("walk coverage: a directory read failure blocks", () => {
  const failOpendir =
    "data:text/javascript,import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';" +
    "fs.opendirSync=()=>{throw new Error('injected')};syncBuiltinESMExports();";
  const input = JSON.stringify({ cwd: fixture, tool_input: { command: "grep -r KEY src" } });
  assert.equal(runRaw(input), 0);
  assert.equal(runRaw(input, ["--import", failOpendir]), 2);
});

// 8. One entry budget is shared by every target in a hook call.
test("walk budget: shared across targets", () => {
  const env = { GUARD_BASH_MAX_ENTRIES: "12" };
  assert.equal(run("grep -r KEY big1", env), 0);
  assert.equal(run("grep -r KEY big1 big2 big3", env), 2);
  assert.equal(run("grep -r KEY big1 big1 big1", env), 0); // repeated roots reuse one walk
});

// 5. Git Bash spells C:\x as /c/x; the hook converts it (Windows only).
test("Git Bash paths match native paths", { skip: process.platform !== "win32" && "Windows only" }, () => {
  const posix = (p) => p.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`).replace(/\\/g, "/");
  assert.equal(run(`grep -rn KEY ${join(fixture, "src").replace(/\\/g, "/")}`), 0);
  assert.equal(run(`grep -rn KEY ${posix(join(fixture, "src"))}`), 0);
  assert.equal(run(`grep -rn KEY ${posix(fixture)}`), 2);
  assert.equal(run("grep -rn KEY /usr/share"), 2); // depends on the MSYS mount table: unknown
});

// Known gaps no command-text check can close. The Bash sandbox (denyRead) covers them on
// macOS, Linux and WSL2, but not on native Windows. Node lists these as todo, not failures.
for (const command of ["f=.e; cat ${f}nv", "ls -A | xargs cat", "cat $(printf '\\056env')"]) {
  test(`known gap (not detectable from command text): ${command}`, { todo: true }, () =>
    assert.equal(run(command), 2));
}
