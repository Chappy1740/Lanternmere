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
      // Wildcards (or brace choices) the shell can expand into a secret file:
      // .env*, .env.d*, .env.*.local, .dev.vars.*, .e?v, .{env,x}, .*, "$(cat .env*)"
      // A nested shell (bash -c '...', eval '...') runs its quoted text, and a
      // command the parser cannot fully follow (unclosed quote or substitution)
      // may hide one, so in those cases the command is also checked strictly,
      // with quotes removed.
      test: (c) => {
        const state = { anomaly: false };
        const check = (words) =>
          words.some((word) => expandBraces(word).some(couldExpandToSecret));
        if (check(shellWords(c, state))) return true;
        if (!state.anomaly && !nestedShell.test(c)) return false;
        return check(shellWords(c.replace(/['"\\]/g, "")));
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
const nestedShell = /(^|[\s;&|(`/])(eval|(ba|z|da|k)?sh)\b/;
const secretName = /^\.(env|dev\.vars)(\.(?!example\b)[A-Za-z0-9_-]+)*$/;
const sampleSecretNames = [
  ".env", ".env.local", ".env.development", ".env.production", ".env.test", ".env.keys",
  ".env.development.local", ".dev.vars", ".dev.vars.local", ".dev.vars.production",
];

// One brace-expanded word (characters with quoting). True if it names a secret
// file, or its unquoted wildcards could expand to one.
function couldExpandToSecret(word) {
  const name = word.slice(word.findLastIndex((x) => x.ch === "/") + 1);
  if (secretName.test(name.map((x) => x.ch).join(""))) return true;
  const firstGlob = name.findIndex(
    (x, i) =>
      !x.quoted &&
      (x.ch === "*" || x.ch === "?" ||
        (x.ch === "[" && name.some((y, j) => j > i + 1 && !y.quoted && y.ch === "]")))
  );
  if (firstGlob === -1) return false; // no active wildcard (quoted, or unclosed [)
  // Bash globs never match a leading dot unless the dot is typed literally.
  if (name[0].ch !== ".") return false;
  if (couldNameSecret(name.slice(0, firstGlob).map((x) => x.ch).join(""))) return true;
  const pattern = globToRegExp(name);
  return !pattern || sampleSecretNames.some((s) => pattern.test(s));
}

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

// Split a command into shell words, keeping each character's quoting. Quoted or
// backslash-escaped characters are never wildcards in Bash, but a $( ) or ` `
// command substitution inside double quotes runs normally, so its contents are
// split again as separate words.
function shellWords(cmd, state = { anomaly: false }) {
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
      else if (ch === "$" && cmd[i + 1] === "(") {
        const close = substitutionEnd(cmd, i + 2);
        if (close === -1) state.anomaly = true;
        const end = close === -1 ? cmd.length : close;
        words.push(...shellWords(cmd.slice(i + 2, end), state));
        i = end;
      } else if (ch === "`") {
        let close = -1;
        for (let j = i + 1; j < cmd.length; j++) {
          if (cmd[j] === "\\") j++;
          else if (cmd[j] === "`") {
            close = j;
            break;
          }
        }
        if (close === -1) state.anomaly = true;
        const end = close === -1 ? cmd.length : close;
        words.push(...shellWords(cmd.slice(i + 1, end), state));
        i = end;
      } else add(ch, true);
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
  if (quote) state.anomaly = true;
  if (word) words.push(word);
  return words;
}

// Index of the ) closing a $( whose body starts at `start`, honoring quotes and
// escapes inside the body; -1 if it never closes.
function substitutionEnd(cmd, start) {
  let depth = 1;
  let quote = null;
  for (let j = start; j < cmd.length; j++) {
    const ch = cmd[j];
    if (quote === "'") {
      if (ch === "'") quote = null;
    } else if (ch === "\\") {
      j++;
    } else if (quote === '"') {
      if (ch === '"') quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")" && --depth === 0) {
      return j;
    }
  }
  return -1;
}

// Bash brace expansion on unquoted, balanced {a,b} groups: .{env,x} -> .env, .x
// A {...} without a top-level comma stays literal. Over 256 results returns one
// empty-named "word" that couldExpandToSecret blocks, to stay conservative.
function expandBraces(word, budget = { left: 256 }) {
  const open = word.findIndex((x) => !x.quoted && x.ch === "{");
  if (open === -1) return [word];
  let depth = 0;
  const commas = [];
  let close = -1;
  for (let i = open; i < word.length; i++) {
    const x = word[i];
    if (x.quoted) continue;
    if (x.ch === "{") depth++;
    else if (x.ch === "}" && --depth === 0) {
      close = i;
      break;
    } else if (x.ch === "," && depth === 1) commas.push(i);
  }
  const head = word.slice(0, open + 1);
  if (close === -1) return [word];
  if (commas.length === 0) {
    // A sequence like {u..w} or {1..9} expands to a range; treat it as a
    // wildcard (*) to stay conservative.
    const inner = word.slice(open + 1, close).map((x) => x.ch).join("");
    if (/^[^{}]*\.\.[^{}]*$/.test(inner)) {
      const star = [...word.slice(0, open), { ch: "*", quoted: false }, ...word.slice(close + 1)];
      return expandBraces(star, budget);
    }
    // Literal group; keep looking for expandable groups after it.
    return expandBraces(word.slice(open + 1), budget).map((rest) => [...head, ...rest]);
  }
  const prefix = word.slice(0, open);
  const suffix = word.slice(close + 1);
  const bounds = [open, ...commas, close];
  const out = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const choice = [...prefix, ...word.slice(bounds[k] + 1, bounds[k + 1]), ...suffix];
    for (const w of expandBraces(choice, budget)) {
      if (--budget.left < 0) return [[{ ch: ".", quoted: false }, { ch: "*", quoted: false }]];
      out.push(w);
    }
  }
  return out;
}

// Convert one brace-expanded word to a RegExp. Only unquoted *, ? and closed
// [...] are special. Returns null only if the RegExp cannot be built (or uses
// POSIX classes); the caller then blocks.
function globToRegExp(chars) {
  const is = (x, c) => !x.quoted && x.ch === c;
  let out = "";
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
    } else out += x.ch.replace(/[.*+?^$()|\\[\]{}]/g, "\\$&");
  }
  try {
    return new RegExp(`^${out}$`);
  } catch {
    return null;
  }
}
