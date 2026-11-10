#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash commands.
// Blocks destructive commands and shell reads of local secret files.
// Exit code 2 blocks the command and shows the reason to Claude. Any internal
// failure also exits 2, so the hook fails closed.
// This is a seatbelt for honest mistakes, not a security boundary: it cannot
// see through variables or every tool chain. Pair it with the Bash sandbox.

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";

const block = (why) => {
  process.stderr.write(
    `Blocked by project safety hook: ${why}\n` +
      "Stop and ask Will for explicit approval for this exact command.\n"
  );
  process.exit(2);
};
process.on("uncaughtException", () => block("The safety hook failed while checking this command."));

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("error", () => block("The safety hook could not read the command."));
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    block("The safety hook could not read the command.");
  }
  const command = payload?.tool_input?.command ?? "";
  if (typeof command !== "string") block("The safety hook could not read the command.");
  const cwd = typeof payload?.cwd === "string" ? payload.cwd : process.cwd();

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
      // Also secret names spelled with $'...' escapes, like $'\x2eenv'.
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
    {
      // Patterns that a tool matches itself, even when quoted: find -name '.env*',
      // rg -g '.env*', grep --include='*.local'. Tool globs match leading dots.
      test: (c) => toolGlobs(shellWords(c)).some(toolGlobCouldMatchSecret),
      why: "A search pattern (find -name, rg -g, grep --include) that can match a local secret file.",
    },
    {
      // Recursive readers that reach a secret file on disk: grep -r, rg --hidden,
      // find -exec / | xargs / $(find ...).
      test: (c, dir) => recursiveReadReachesSecret(c, dir),
      why:
        "A recursive search or find that can read a local secret file. " +
        "Exclude secrets (for example --exclude='.env*' --exclude='.dev.vars*'), narrow the path, or use the Grep tool.",
    },
  ];

  let hit;
  try {
    hit = rules.find((r) => r.test(command, cwd));
  } catch {
    block("The safety hook failed while checking this command.");
  }
  if (hit) block(hit.why);
  process.exit(0);
});

const secretFamilies = [".env", ".dev.vars"];
const nestedShell = /(^|[\s;&|(`/])(eval|(ba|z|da|k)?sh)\b/;
const secretName = /^\.(env|dev\.vars)(\.(?!example\b)[A-Za-z0-9_-]+)*$/;
const sampleSecretNames = [
  ".env", ".env.local", ".env.development", ".env.production", ".env.test", ".env.keys",
  ".env.development.local", ".env.production.local", ".env.test.local", ".env.staging",
  ".env.preview", ".dev.vars", ".dev.vars.local", ".dev.vars.production", ".dev.vars.staging",
];
const SEP = Symbol("separator");
const REDIR = Symbol("redirect");
const text = (word) => word.map((x) => x.ch).join("");

// One brace-expanded word (characters with quoting). True if it names a secret
// file, or its unquoted wildcards could expand to one.
function couldExpandToSecret(word) {
  const name = word.slice(word.findLastIndex((x) => x.ch === "/") + 1);
  if (secretName.test(text(name))) return true;
  const firstGlob = firstGlobIndex(name, (x) => !x.quoted);
  if (firstGlob === -1) return false; // no active wildcard (quoted, or unclosed [)
  // Bash globs never match a leading dot unless the dot is typed literally.
  if (name[0].ch !== ".") return false;
  if (couldNameSecret(text(name.slice(0, firstGlob)))) return true;
  const pattern = globToRegExp(name);
  return !pattern || sampleSecretNames.some((s) => pattern.test(s));
}

function firstGlobIndex(name, active) {
  return name.findIndex(
    (x, i) =>
      active(x) &&
      (x.ch === "*" || x.ch === "?" ||
        (x.ch === "[" && name.some((y, j) => j > i + 1 && active(y) && y.ch === "]")))
  );
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
// split again as separate words. $'...' strings are decoded.
// With state.marks, command separators become SEP, redirections become REDIR
// (dropping a leading file-descriptor number), and = does not split words.
function shellWords(cmd, state = { anomaly: false }) {
  const words = [];
  let word = null;
  let quote = null;
  const marks = !!state.marks;
  const splitters = marks ? /[\s;&|()<>`]/ : /[\s;&|()<>=`]/;
  const add = (ch, quoted) => (word ??= []).push({ ch, quoted });
  const flush = () => {
    if (word) words.push(word);
    word = null;
  };
  const nested = (body) => {
    if (marks) words.push(SEP);
    words.push(...shellWords(body, state));
    if (marks) words.push(SEP);
  };
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
        nested(cmd.slice(i + 2, end));
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
        nested(cmd.slice(i + 1, end));
        i = end;
      } else add(ch, true);
    } else if (ch === "$" && cmd[i + 1] === "'") {
      // ANSI-C quoting: $'\x2eenv' is the literal text .env
      const r = readAnsiC(cmd, i + 2);
      if (r.end === -1) state.anomaly = true;
      word ??= [];
      for (const c of r.text) add(c, true);
      i = r.end === -1 ? cmd.length : r.end;
    } else if (ch === "$" && cmd[i + 1] === '"') {
      // $"..." is a locale string; it quotes like "..."
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      word ??= [];
    } else if (ch === "\\" && i + 1 < cmd.length) {
      add(cmd[++i], true);
    } else if (splitters.test(ch)) {
      if (marks && (ch === "<" || ch === ">")) {
        if (word && /^\d+$/.test(text(word)) && word.every((x) => !x.quoted)) word = null;
        flush();
        words.push(REDIR);
        if (cmd[i + 1] === "&") i++; // 2>&1, >&2
      } else {
        flush();
        if (marks && /[;&|()`\n]/.test(ch)) words.push(SEP);
      }
    } else {
      add(ch, false);
    }
  }
  if (quote) state.anomaly = true;
  flush();
  return words;
}

// Decode the body of a $'...' string starting at `start`. Returns the text and
// the index of the closing quote (-1 if it never closes).
function readAnsiC(cmd, start) {
  const simple = {
    a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t",
    v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?",
  };
  let out = "";
  for (let j = start; j < cmd.length; j++) {
    const ch = cmd[j];
    if (ch === "'") return { text: out, end: j };
    if (ch !== "\\" || j + 1 >= cmd.length) {
      out += ch;
      continue;
    }
    const n = cmd[++j];
    if (Object.hasOwn(simple, n)) out += simple[n];
    else if (/[0-7]/.test(n)) {
      const digits = cmd.slice(j).match(/^[0-7]{1,3}/)[0];
      out += String.fromCharCode(parseInt(digits, 8) & 0xff);
      j += digits.length - 1;
    } else if (n === "x" || n === "u" || n === "U") {
      const max = { x: 2, u: 4, U: 8 }[n];
      const digits = cmd.slice(j + 1).match(new RegExp(`^[0-9A-Fa-f]{1,${max}}`));
      if (digits) {
        const cp = parseInt(digits[0], 16);
        out += cp <= 0x10ffff ? String.fromCodePoint(cp) : "\ufffd";
        j += digits[0].length;
      } else out += "\\" + n;
    } else if (n === "c" && j + 1 < cmd.length) {
      out += String.fromCharCode(cmd[++j].charCodeAt(0) & 0x1f);
    } else out += "\\" + n;
  }
  return { text: out, end: -1 };
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
    } else if (ch === "$" && cmd[j + 1] === "'") {
      const r = readAnsiC(cmd, j + 2);
      if (r.end === -1) return -1;
      j = r.end;
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
    const inner = text(word.slice(open + 1, close));
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
// [...] are special. `any` is what * and ? match; `flags` are RegExp flags. Returns null only if the
// RegExp cannot be built (or uses POSIX classes); the caller then blocks.
function globToRegExp(chars, any = "[^/]", flags = "") {
  const is = (x, c) => !x.quoted && x.ch === c;
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const x = chars[i];
    const end = is(x, "[") ? chars.findIndex((y, j) => j > i + 1 && is(y, "]")) : -1;
    if (is(x, "*")) out += `${any}*`;
    else if (is(x, "?")) out += any;
    else if (end !== -1) {
      const inner = text(chars.slice(i + 1, end));
      // POSIX classes like [[:alpha:]] are not translated; block conservatively.
      if (/\[[:=.]/.test(inner)) return null;
      out += "[" + inner.replace(/^!/, "^").replace(/[\\\]]/g, "\\$&") + "]";
      i = end;
    } else out += x.ch.replace(/[.*+?^$()|\\[\]{}]/g, "\\$&");
  }
  try {
    return new RegExp(`^${out}$`, flags);
  } catch {
    return null;
  }
}

// Words that a tool treats as its own glob: find -name/-path ..., rg -g/--glob,
// grep --include. A find test negated with ! or -not is skipped.
const toolGlobOptions = new Set([
  "-name", "-iname", "-path", "-ipath", "-wholename", "-iwholename", "-lname", "-ilname",
  "-g", "--glob", "--iglob", "--include",
]);
function toolGlobs(words) {
  const out = [];
  for (let k = 0; k + 1 < words.length; k++) {
    if (!toolGlobOptions.has(text(words[k]))) continue;
    const prev = k > 0 ? text(words[k - 1]) : "";
    if (prev !== "!" && prev !== "-not") out.push(words[k + 1]);
    k++;
  }
  return out;
}

// True if a tool-applied glob could match a secret file name. The tool sees
// the pattern after shell quoting is removed, and its * matches a leading dot.
// A leading ! (rg exclusion) never selects a file.
function toolGlobCouldMatchSecret(word) {
  if (word.length === 0 || word[0].ch === "!") return false;
  const raw = word.map((x) => ({ ch: x.ch, quoted: false }));
  return expandBraces(raw).some((w) => {
    const name = w.slice(w.findLastIndex((x) => x.ch === "/") + 1);
    if (name.length === 0) return false;
    if (secretName.test(text(name))) return true;
    const firstGlob = firstGlobIndex(name, () => true);
    if (firstGlob === -1) return false;
    if (name[0].ch === "." && couldNameSecret(text(name.slice(0, firstGlob)))) return true;
    const pattern = globToRegExp(name, ".", "i"); // -iname, --iglob ignore case
    return !pattern || sampleSecretNames.some((s) => pattern.test(s));
  });
}

// True if every sample secret name is excluded by one of these tool globs.
function excludesAllSecrets(patterns) {
  const res = patterns.map((p) =>
    globToRegExp([...p.replace(/^.*\//, "")].map((ch) => ({ ch, quoted: false })), ".")
  );
  return sampleSecretNames.every((s) => res.some((re) => re && re.test(s)));
}

// Split a command into simple commands (arrays of words, redirections removed).
function simpleCommands(cmd) {
  const state = { anomaly: false, marks: true };
  const all = shellWords(cmd, state);
  const out = [[]];
  for (let k = 0; k < all.length; k++) {
    const w = all[k];
    if (w === SEP) out.push([]);
    else if (w === REDIR) {
      if (all[k + 1] !== SEP && all[k + 1] !== REDIR) k++;
    } else out.at(-1).push(w);
  }
  return { commands: out.filter((c) => c.length), anomaly: state.anomaly };
}

const grepValueOptions = new Set([
  "-e", "-f", "-m", "-A", "-B", "-C", "-d", "-D", "--regexp", "--file", "--max-count",
  "--after-context", "--before-context", "--context", "--include", "--exclude",
  "--exclude-dir", "--exclude-from", "--label", "--directories", "--devices", "--binary-files",
]);
const rgValueOptions = new Set([
  "-e", "-f", "-g", "-t", "-T", "-m", "-A", "-B", "-C", "-j", "-M", "-d", "-E", "-r",
  "--regexp", "--file", "--glob", "--iglob", "--type", "--type-not", "--max-count",
  "--after-context", "--before-context", "--context", "--threads", "--max-columns",
  "--max-depth", "--encoding", "--replace", "--sort", "--sortr", "--pre", "--pre-glob",
  "--type-add", "--ignore-file", "--path-separator", "--color", "--colors",
  "--context-separator", "--field-context-separator", "--field-match-separator",
  "--max-filesize", "--dfa-size-limit", "--regex-size-limit", "--engine",
]);

// Parse a grep- or rg-style argument list. Returns options (with values),
// positionals, and whether an explicit pattern option (-e/-f) was given.
function parseSearchArgs(args, valueOptions) {
  const opts = [];
  const positionals = [];
  let explicitPattern = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === "--") {
      positionals.push(...args.slice(k + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq === -1 ? a : a.slice(0, eq);
      const value = eq === -1 ? (valueOptions.has(name) ? args[++k] ?? "" : null) : a.slice(eq + 1);
      opts.push({ name, value });
      if (name === "--regexp" || name === "--file") explicitPattern = true;
    } else if (a.startsWith("-") && a.length > 1) {
      // Short option cluster like -rn or -A3 or -e PATTERN.
      for (let p = 1; p < a.length; p++) {
        const name = `-${a[p]}`;
        if (valueOptions.has(name)) {
          const value = p + 1 < a.length ? a.slice(p + 1) : args[++k] ?? "";
          opts.push({ name, value });
          if (name === "-e" || name === "-f") explicitPattern = true;
          break;
        }
        opts.push({ name, value: null });
      }
    } else positionals.push(a);
  }
  return { opts, positionals, explicitPattern };
}

// True if a command searches or reads recursively into a path that holds a
// secret file. Uncertain paths (variables, ~user, missing) count as reaching.
function recursiveReadReachesSecret(cmd, cwd) {
  const { commands } = simpleCommands(cmd);
  const hasCd = commands.some((c) => text(c[0]) === "cd" || text(c[0]) === "pushd");
  const hasSubstitution = /\$\(|`|[<>]\(/.test(cmd); // $( ), ` `, <( ), >( )
  for (let i = 0; i < commands.length; i++) {
    const words = commands[i].map(text);
    for (let k = 0; k < words.length; k++) {
      const tool = basename(words[k]);
      const args = words.slice(k + 1);
      let targets = null;
      if (/^[ef]?grep$|^rgrep$/.test(tool) && words[k - 1] !== "git") {
        const { opts, positionals, explicitPattern } = parseSearchArgs(args, grepValueOptions);
        const recursive =
          tool === "rgrep" ||
          opts.some(
            (o) =>
              o.name === "-r" || o.name === "-R" || o.name === "--recursive" ||
              o.name === "--dereference-recursive" ||
              ((o.name === "-d" || o.name === "--directories") && o.value === "recurse")
          );
        if (!recursive) continue;
        const excludes = opts.filter((o) => o.name === "--exclude").map((o) => o.value);
        if (excludesAllSecrets(excludes)) continue;
        if (opts.some((o) => o.name === "--include")) continue; // matching ones caught by tool-glob rule
        targets = explicitPattern ? positionals : positionals.slice(1);
        if (targets.length === 0) targets = ["."];
      } else if (tool === "rg" || tool === "ag") {
        const { opts, positionals, explicitPattern } = parseSearchArgs(args, rgValueOptions);
        const unrestricted = opts.filter((o) => o.name === "-u").length;
        const hidden =
          unrestricted >= (tool === "ag" ? 1 : 2) ||
          opts.some((o) => ["--hidden", "-.", "--unrestricted"].includes(o.name));
        // --files only lists names; it does not read contents.
        if (!hidden || opts.some((o) => o.name === "--files")) continue;
        const globs = opts.filter((o) => ["-g", "--glob", "--iglob"].includes(o.name)).map((o) => o.value);
        if (globs.some((g) => g && !g.startsWith("!"))) continue; // positive globs: tool-glob rule
        if (excludesAllSecrets(globs.map((g) => g.slice(1)))) continue;
        targets = explicitPattern ? positionals : positionals.slice(1);
        if (targets.length === 0) targets = ["."];
      } else if (tool === "find") {
        const reads =
          hasSubstitution ||
          args.some((a) => ["-exec", "-execdir", "-ok", "-okdir"].includes(a)) ||
          (i + 1 < commands.length && /xargs|parallel|while/.test(commands[i + 1].map(text).join(" ")));
        if (!reads) continue;
        const tests = [];
        const negated = [];
        let orBranch = false;
        for (let a = 0; a < args.length; a++) {
          if (["-o", "-or", ","].includes(args[a])) orBranch = true;
          if (/^-i?(name|path|wholename|regex)$/.test(args[a]) && a + 1 < args.length) {
            const neg = args[a - 1] === "!" || args[a - 1] === "-not";
            (neg ? negated : tests).push({ kind: args[a], value: args[a + 1] });
          }
        }
        if (excludesAllSecrets(negated.filter((t) => !/regex/.test(t.kind)).map((t) => t.value))) continue;
        const safeFilter =
          !orBranch && tests.length > 0 &&
          tests.every((t) => !/regex/.test(t.kind) &&
            !toolGlobCouldMatchSecret([...t.value].map((ch) => ({ ch, quoted: false }))));
        if (safeFilter) continue;
        targets = [];
        for (const a of args) {
          if (/^-[HLP]$/.test(a)) continue;
          if (a.startsWith("-") || a === "!" || a === "(") break;
          targets.push(a);
        }
        if (targets.length === 0) targets = ["."];
      } else continue;
      if (targets.some((t) => pathReachesSecret(t, cwd, hasCd))) return true;
    }
  }
  return false;
}

// True if `target` (a file or directory) is, or contains, a secret file.
// Paths that cannot be resolved with certainty count as reaching one.
function pathReachesSecret(target, cwd, hasCd) {
  if (target === "-") return false;
  if (/[$`]|^~[^/]/.test(target)) return true;
  let path = target.replace(/^~(?=\/|$)/, homedir());
  // A shell wildcard in the path: walk the literal directory above it instead.
  const glob = path.search(/[*?[{]/);
  if (glob !== -1) path = path.slice(0, path.lastIndexOf("/", glob) + 1) || ".";
  const full = resolve(cwd, path);
  let info;
  try {
    info = statSync(full);
  } catch {
    return true; // missing or unreadable: cannot tell, so block
  }
  if (!hasCd && !info.isDirectory()) return secretName.test(basename(full));
  return treeHasSecret(info.isDirectory() ? full : resolve(full, ".."));
}

// Walk a directory (skipping .git and node_modules) looking for secret files.
// Gives up after 50,000 entries and reports a secret, to stay conservative.
function treeHasSecret(root) {
  const stack = [root];
  let budget = 50000;
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (--budget < 0) return true;
      if (secretName.test(e.name)) return true;
      if (e.isDirectory() && e.name !== ".git" && e.name !== "node_modules") {
        stack.push(resolve(dir, e.name));
      }
    }
  }
  return false;
}
