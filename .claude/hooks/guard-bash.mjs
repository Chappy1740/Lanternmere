#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash commands.
// Blocks destructive commands and shell reads of local secret files.
// Exit code 2 blocks the command and shows the reason to Claude.
// This is a seatbelt for honest mistakes, not a security boundary.

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(input)?.tool_input?.command ?? "";
  } catch {
    process.exit(0);
  }

  // Build output folders that are safe to delete recursively.
  const safeRmTargets =
    /^(\.\/)?(node_modules|\.next|dist|out|build|coverage|\.open-next|\.wrangler|\.vinext|test-results|playwright-report)\/?$/;

  const rules = [
    {
      test: (c) =>
        /\bgit\s+push\b[^;&|]*(\s--force(-with-lease)?\b|\s-[a-zA-Z]*f\b|\s\+\S)/.test(c),
      why: "Force-pushing rewrites remote history.",
    },
    {
      test: (c) => /\bgit\s+reset\s+[^;&|]*--hard\b/.test(c),
      why: "git reset --hard discards uncommitted work.",
    },
    {
      test: (c) => /\bgit\s+clean\s+[^;&|]*-[a-zA-Z]*f/.test(c),
      why: "git clean -f deletes untracked files.",
    },
    {
      test: (c) => {
        for (const m of c.matchAll(/\brm\s+((?:-[a-zA-Z]+\s+|--[a-z-]+\s+)+)([^;&|]*)/g)) {
          const flags = m[1];
          const recursive = /-[a-zA-Z]*[rR]|--recursive/.test(flags);
          const force = /-[a-zA-Z]*f|--force/.test(flags);
          if (!recursive || !force) continue;
          const targets = m[2].trim().split(/\s+/).filter(Boolean);
          if (targets.length === 0 || targets.some((t) => !safeRmTargets.test(t))) return true;
        }
        return false;
      },
      why: "Recursive force delete outside build folders.",
    },
    {
      // .env, .env.local, .env.production, .env.keys, .dev.vars ... but not *.example
      test: (c) =>
        /(^|[\s/'"=<>])\.(env|dev\.vars)(\.(?!example\b)[A-Za-z0-9_-]+)*(?=$|[\s'";&|)>])/.test(c),
      why: "Shell access to a local secret file (.env or .dev.vars).",
    },
    {
      // Unquoted wildcards the shell can expand into a secret file:
      // .env*, .env.d*, .env.*.local, .dev.vars.*, .e?v, .{env,x}, .*
      test: (c) => {
        for (const word of shellWords(c)) {
          const name = word.slice(word.findLastIndex((x) => x.ch === "/") + 1);
          const firstGlob = name.findIndex((x) => !x.quoted && "*?[{".includes(x.ch));
          if (firstGlob === -1) continue; // quoted wildcards are plain text in Bash
          // Bash globs never match a leading dot unless the dot is typed literally
          // (or comes from a brace expansion such as {.env,x}).
          if (name[0].ch !== "." && !(name[0].ch === "{" && !name[0].quoted)) continue;
          const literal = name.slice(0, firstGlob).map((x) => x.ch).join("");
          if (name[0].ch === "." && couldNameSecret(literal)) return true;
          const pattern = globToRegExp(name);
          if (!pattern || sampleSecretNames.some((s) => pattern.test(s))) return true;
        }
        return false;
      },
      why: "A wildcard that can expand to a local secret file (.env or .dev.vars).",
    },
  ];

  const hit = rules.find((r) => r.test(command));
  if (hit) {
    process.stderr.write(
      `Blocked by project safety hook: ${hit.why}\n` +
        "Stop and ask Will for explicit approval for this exact command.\n"
    );
    process.exit(2);
  }
  process.exit(0);
});

const secretFamilies = [".env", ".dev.vars"];
const sampleSecretNames = [
  ".env", ".env.local", ".env.development", ".env.production", ".env.test", ".env.keys",
  ".env.development.local", ".dev.vars", ".dev.vars.local", ".dev.vars.production",
];

// True if a filename starting with this literal text (before the first wildcard)
// could be a secret file: a prefix of ".env"/".dev.vars", or ".env.<suffix>"
// / ".dev.vars.<suffix>" other than the committed ".example" templates.
function couldNameSecret(literal) {
  return secretFamilies.some(
    (f) =>
      f.startsWith(literal) ||
      (literal.startsWith(`${f}.`) && !literal.startsWith(`${f}.example`))
  );
}

// Split a command into shell words, keeping each character's quoting.
// Quoted or backslash-escaped characters are never wildcards in Bash.
function shellWords(cmd) {
  const words = [];
  let word = null;
  let quote = null;
  const add = (ch, quoted) => (word ??= []).push({ ch, quoted });
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else add(ch, true);
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < cmd.length) add(cmd[++i], true);
      else add(ch, true);
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      word ??= [];
    } else if (ch === "\\" && i + 1 < cmd.length) {
      add(cmd[++i], true);
    } else if (/[\s;&|()<>=`]/.test(ch)) {
      if (word) words.push(word);
      word = null;
    } else {
      add(ch, false);
    }
  }
  if (word) words.push(word);
  return words;
}

// Convert a shell word (characters with quoting) to a RegExp. Only unquoted
// *, ?, [...] and balanced {a,b} are special; like Bash, an unclosed [ or
// unbalanced braces are literal (so awk '{print $1}' is not a glob).
// Returns null only if the RegExp cannot be built; the caller then blocks.
function globToRegExp(chars) {
  const is = (x, c) => !x.quoted && x.ch === c;
  let depth = 0;
  let balanced = true;
  for (const x of chars) {
    if (is(x, "{")) depth++;
    else if (is(x, "}") && --depth < 0) balanced = false;
  }
  const expandBraces = balanced && depth === 0;
  let out = "";
  let braces = 0;
  for (let i = 0; i < chars.length; i++) {
    const x = chars[i];
    const end = is(x, "[") ? chars.findIndex((y, j) => j > i + 1 && is(y, "]")) : -1;
    if (is(x, "*")) out += "[^/]*";
    else if (is(x, "?")) out += "[^/]";
    else if (end !== -1) {
      const inner = chars.slice(i + 1, end).map((y) => y.ch).join("");
      // POSIX classes like [[:alpha:]] are not translated; block conservatively.
      if (/\[[:=.]/.test(inner)) return null;
      out += "[" + inner.replace(/^!/, "^").replace(/[\\\]]/g, "\\$&") + "]";
      i = end;
    } else if (expandBraces && is(x, "{")) (braces++, (out += "(?:"));
    else if (expandBraces && is(x, "}")) (braces--, (out += ")"));
    else if (expandBraces && braces > 0 && is(x, ",")) out += "|";
    else out += x.ch.replace(/[.*+?^$()|\\[\]{}]/g, "\\$&");
  }
  try {
    return new RegExp(`^${out}$`);
  } catch {
    return null;
  }
}
