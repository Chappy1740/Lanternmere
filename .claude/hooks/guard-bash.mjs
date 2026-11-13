#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash commands.
// Blocks destructive commands and shell reads of local secret files.
// Exit code 2 blocks the command and shows the reason to Claude. Any internal
// failure also exits 2, so the hook fails closed.
// This is a seatbelt for honest mistakes, not a security boundary: it cannot
// see through variables or every tool chain. Pair it with the Bash sandbox.

import { opendirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";

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
  // Anything but an object envelope with a string command is blocked, including
  // a null or missing command: there is no safe default for a Bash call.
  const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  const command = isObject(payload) && isObject(payload.tool_input) ? payload.tool_input.command : undefined;
  if (typeof command !== "string") block("The safety hook could not read the command.");
  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();

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
// With state.marks, command separators become { sep: char } (a double-quoted
// $( ) is bracketed by "$(" and ")"), redirections become REDIR (dropping a
// leading file-descriptor number), and = does not split words.
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
    if (marks) words.push({ sep: "$(" });
    words.push(...shellWords(body, state));
    if (marks) words.push({ sep: ")" });
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
        if (marks && /[;&|()`\n]/.test(ch)) words.push({ sep: ch });
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

// --- Exclusions -------------------------------------------------------------
// An exclusion proves a whole secret family is skipped only when it is a literal
// prefix of the family name plus one trailing * (".env*", ".e*", ".*", "*") and
// has no "/" (so it applies at every depth). Any other exclusion is not trusted;
// the reader's targets are inspected instead.
function exclusionCoversFamily(pattern, family) {
  if (typeof pattern !== "string" || pattern.includes("/")) return false;
  const m = pattern.match(/^([^*?[\]{}\\]*)\*$/);
  return !!m && family.startsWith(m[1]);
}
function excludesAllSecrets(patterns) {
  return secretFamilies.every((f) => patterns.some((p) => exclusionCoversFamily(p, f)));
}
const chars = (s) => [...s].map((ch) => ({ ch, quoted: false }));

// --- Simple commands --------------------------------------------------------
// Split a command into simple commands: { words, before, after, depth }.
// `before`/`after` are the separators around it ("&&", "|", ";", "(" ...) and
// `depth` is how many ( or $( groups it sits inside. Redirections are removed.
function simpleCommands(cmd) {
  const all = shellWords(cmd, { anomaly: false, marks: true });
  const out = [];
  let words = [];
  let seps = "";
  let before = "";
  let depth = 0;
  let startDepth = 0;
  for (let k = 0; k < all.length; k++) {
    const w = all[k];
    if (w === REDIR) {
      if (Array.isArray(all[k + 1])) k++; // the redirection's file word
      continue;
    }
    if (!Array.isArray(w)) {
      if (words.length) out.push({ words, before, depth: startDepth });
      words = [];
      seps += w.sep;
      if (w.sep === "(" || w.sep === "$(") depth++;
      else if (w.sep === ")") depth = Math.max(0, depth - 1);
      continue;
    }
    if (!words.length) {
      before = seps;
      seps = "";
      startDepth = depth;
    }
    words.push(text(w));
  }
  if (words.length) out.push({ words, before, depth: startDepth });
  out.forEach((c, i) => (c.after = i + 1 < out.length ? out[i + 1].before : seps));
  return out;
}
// True if a separator string puts a command in a pipeline or the background.
const pipedOrBackground = (s) => /[|&]/.test(s.replace(/&&|\|\|/g, ""));

// --- Command words ----------------------------------------------------------
// Prefixes that run the next word as the command, with their options that take
// a value. Shell keywords that start a command list are skipped the same way.
const wrapperValueOptions = {
  sudo: ["-u", "-g", "-C", "-h", "-p", "-r", "-t", "-U", "-D", "-R", "-T", "--user", "--group", "--chdir"],
  doas: ["-u", "-C"],
  env: ["-u", "-C", "-S", "--unset", "--chdir", "--split-string"],
  nice: ["-n", "--adjustment"],
  ionice: ["-c", "-n", "-p"],
  timeout: ["-s", "-k", "--signal", "--kill-after"],
  stdbuf: ["-i", "-o", "-e"],
  xargs: ["-I", "-L", "-n", "-P", "-s", "-d", "-E", "-a", "--max-args", "--max-procs",
    "--delimiter", "--arg-file", "--replace", "--max-lines", "--eof", "--max-chars"],
  time: ["-f", "-o", "--format", "--output"],
  nohup: [], command: [], builtin: [], exec: ["-a"], chronic: [],
  if: [], then: [], else: [], elif: [], do: [], while: [], until: [], "!": [], "{": [],
};

// Find the word that runs as the command. Returns { index, chdir, viaXargs },
// or { index: -1 } when a wrapper hides it (env -S).
function findCommandWord(words) {
  let k = 0;
  let chdir = false;
  let viaXargs = false;
  while (k < words.length) {
    const w = words[k];
    if (/^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/.test(w)) {
      k++; // variable assignment
      continue;
    }
    const name = basename(w);
    if (!Object.hasOwn(wrapperValueOptions, name)) break;
    const valueOpts = wrapperValueOptions[name];
    if (name === "xargs") viaXargs = true;
    k++;
    while (k < words.length && words[k].startsWith("-") && words[k] !== "-") {
      const o = words[k];
      if (o === "--") {
        k++;
        break;
      }
      const optName = o.startsWith("--") ? o.split("=")[0] : o;
      if ((name === "env" || name === "sudo" || name === "doas") &&
        (["--chdir", "-D"].includes(optName) || (name !== "sudo" && /^-[^-]*C/.test(o)))) {
        chdir = true;
      }
      if (name === "env" && (/^-[^-]*S/.test(o) || optName === "--split-string")) return { index: -1 };
      k += valueOpts.includes(o) ? 2 : 1;
    }
    if (name === "env") while (k < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[k])) k++;
    if (name === "timeout" && k < words.length) k++; // the duration
  }
  return { index: k < words.length ? k : -1, chdir, viaXargs };
}

// --- Option parsing -----------------------------------------------------------
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
const agValueOptions = new Set([
  "-A", "-B", "-C", "-G", "-g", "-m", "-p", "--ignore", "--ignore-dir", "--file-search-regex",
  "--depth", "--pager", "--workers", "--path-to-ignore", "--max-count", "--context",
]);

// Parse a grep/rg/ag argument list once. Returns options (with values),
// positionals, and whether an explicit pattern option (-e/-f) was given.
function parseSearchArgs(args, valueOptions, patternOptions) {
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
      if (patternOptions.includes(name)) explicitPattern = true;
    } else if (a.startsWith("-") && a.length > 1) {
      // Short option cluster like -rn or -A3 or -e PATTERN.
      for (let p = 1; p < a.length; p++) {
        const name = `-${a[p]}`;
        if (valueOptions.has(name)) {
          const value = p + 1 < a.length ? a.slice(p + 1) : args[++k] ?? "";
          opts.push({ name, value });
          if (patternOptions.includes(name)) explicitPattern = true;
          break;
        }
        opts.push({ name, value: null });
      }
    } else positionals.push(a);
  }
  const has = (...names) => opts.some((o) => names.includes(o.name));
  const values = (...names) => opts.filter((o) => names.includes(o.name)).map((o) => o.value ?? "");
  return { opts, positionals, explicitPattern, has, values };
}

// Literal directory names (no wildcards) that a reader is told to skip.
const literalNames = (patterns) =>
  new Set(patterns.map((p) => p.replace(/\/+$/, "")).filter((p) => p && !/[*?[\]{}/\\]/.test(p)));

// --- Recursive readers --------------------------------------------------------
const shells = /^(ba|z|da|k|mk)?sh$/;
const pipesToReader = (cmds, i) =>
  i + 1 < cmds.length &&
  /\|/.test(cmds[i].after.replace(/\|\|/g, "")) &&
  /\b(xargs|parallel|while)\b/.test(cmds[i + 1].words.join(" "));

// True if a command reads (recursively, or through find/xargs) a path that is,
// or holds, a secret file. Anything that cannot be resolved with certainty
// counts as reaching one. The working directory is tracked through literal cd
// commands in the top-level shell; any other directory change makes it unknown.
function recursiveReadReachesSecret(cmd, cwd, ctx = { budget: { left: walkBudget() }, cache: new Map(), depth: 0 }) {
  if (ctx.depth > 4) return true;
  const cmds = simpleCommands(cmd);
  const hasSubstitution = /\$\(|`|[<>]\(/.test(cmd); // $( ), ` `, <( ), >( )
  let dir = cwd; // effective working directory; null when unknown
  for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    const { index, chdir, viaXargs } = findCommandWord(c.words);
    if (index === -1) {
      if (c.words.some((w) => /^(e|f|r)?grep$|^rg$|^ag$|^find$/.test(basename(w)))) return true;
      continue;
    }
    const tool = basename(c.words[index]);
    const args = c.words.slice(index + 1);

    if (tool === "cd" || tool === "pushd" || tool === "popd") {
      const scoped = c.depth > 0 || pipedOrBackground(c.before) || pipedOrBackground(c.after) || /`/.test(cmd);
      if (scoped || tool === "popd" || dir === null) {
        dir = null;
        continue;
      }
      const target = args.filter((a) => !/^-[LPe@]+$/.test(a))[0];
      dir = changeDirectory(dir, target);
      continue;
    }

    const here = chdir ? null : dir;
    const reach = (targets, mode) =>
      viaXargs || targets.some((t) => pathReachesSecret(t, here, mode, ctx));

    if (shells.test(tool) || tool === "eval") {
      // Check the text a nested shell runs, from the same directory.
      let body = null;
      if (tool === "eval") body = args.join(" ");
      else {
        const cAt = args.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a));
        if (cAt !== -1) body = args.slice(cAt + 1).find((a) => !a.startsWith("-")) ?? "";
      }
      if (body !== null && recursiveReadReachesSecret(body, here, { ...ctx, depth: ctx.depth + 1 })) return true;
      continue;
    }

    if (/^[ef]?grep$|^rgrep$/.test(tool)) {
      const p = parseSearchArgs(args, grepValueOptions, ["-e", "-f", "--regexp", "--file"]);
      const recursive =
        tool === "rgrep" ||
        p.has("-r", "-R", "--recursive", "--dereference-recursive") ||
        p.opts.some((o) => (o.name === "-d" || o.name === "--directories") && o.value === "recurse");
      if (!recursive) continue;
      const includes = p.values("--include");
      if (includes.some((g) => toolGlobCouldMatchSecret(chars(g)))) return true;
      if (includes.length) continue; // grep reads only files matching a safe --include
      if (excludesAllSecrets(p.values("--exclude"))) continue;
      const follow = p.has("-R", "--dereference-recursive");
      const targets = p.explicitPattern ? p.positionals : p.positionals.slice(1);
      const mode = { links: follow ? "uncertain" : "skip", prune: literalNames(p.values("--exclude-dir")) };
      if (reach(targets.length ? targets : ["."], mode)) return true;
    } else if (tool === "rg" || tool === "ag") {
      const isRg = tool === "rg";
      const p = parseSearchArgs(args, isRg ? rgValueOptions : agValueOptions, isRg ? ["-e", "-f", "--regexp", "--file"] : []);
      const u = p.opts.filter((o) => o.name === "-u").length;
      const hidden = u >= (isRg ? 2 : 1) || p.has("--hidden", "-.", "--unrestricted");
      const follow = isRg ? p.has("-L", "--follow") : p.has("-f", "--follow");
      const listOnly = isRg && p.has("--files");
      if (!hidden && !follow) continue;
      if (listOnly && !pipesToReader(cmds, i)) continue; // --files only prints names
      const globs = isRg ? p.values("-g", "--glob", "--iglob") : p.values("--ignore").map((g) => `!${g}`);
      const positive = globs.filter((g) => !g.startsWith("!"));
      const negative = globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
      if (positive.some((g) => toolGlobCouldMatchSecret(chars(g)))) return true;
      if (positive.length) continue; // rg reads (or lists) only files matching a safe glob
      if (excludesAllSecrets(negative)) continue;
      const targets = p.explicitPattern || listOnly ? p.positionals : p.positionals.slice(1);
      const mode = { links: follow ? "uncertain" : "skip", prune: literalNames(negative) };
      if (reach(targets.length ? targets : ["."], mode)) return true;
    } else if (tool === "find") {
      const reads =
        hasSubstitution || pipesToReader(cmds, i) ||
        args.some((a) => ["-exec", "-execdir", "-ok", "-okdir"].includes(a));
      if (!reads) continue;
      const orBranch = args.some((a) => ["-o", "-or", ","].includes(a));
      const positive = [];
      const negated = [];
      for (let a = 0; a + 1 < args.length; a++) {
        if (!/^-i?(name|path|wholename|regex)$/.test(args[a])) continue;
        const neg = args[a - 1] === "!" || args[a - 1] === "-not";
        (neg ? negated : positive).push({ kind: args[a], value: args[a + 1] });
      }
      // Only -name/-iname exclusions apply to every file in the tree.
      const nameExclusions = negated.filter((t) => /^-i?name$/.test(t.kind)).map((t) => t.value);
      if (!orBranch && excludesAllSecrets(nameExclusions)) continue;
      const safeFilter =
        !orBranch && positive.length > 0 &&
        positive.every((t) => !/regex/.test(t.kind) && !toolGlobCouldMatchSecret(chars(t.value)));
      if (safeFilter) continue;
      const targets = [];
      let follow = args.includes("-follow");
      for (let a = 0; a < args.length; a++) {
        if (/^-[HLP]$/.test(args[a])) {
          if (args[a] === "-L") follow = true;
          continue;
        }
        if (args[a] === "-D") {
          a++;
          continue;
        }
        if (/^-O\d$/.test(args[a])) continue;
        if (args[a].startsWith("-") || args[a] === "!" || args[a] === "(") break;
        targets.push(args[a]);
      }
      // find hands symlinks to -exec unless -type f filters them out.
      const typeF = !orBranch && args.some((a, j) => a === "-type" && args[j + 1] === "f");
      const mode = { links: !follow && typeF ? "skip" : "uncertain", prune: new Set() };
      if (reach(targets.length ? targets : ["."], mode)) return true;
    }
  }
  return false;
}

// Apply a literal cd target to a known directory. Unknown results return null.
function changeDirectory(dir, target) {
  if (target === undefined) return homedir();
  if (target === "-" || /[$`*?[{]|^~[^/]/.test(target)) return null;
  const native = toNativePath(target.replace(/^~(?=\/|$)/, homedir()));
  if (native === null) return null;
  const next = resolve(dir, native);
  try {
    return statSync(next).isDirectory() ? next : null; // CDPATH or a failed cd: unknown
  } catch {
    return null;
  }
}

// Git Bash spells C:\x as /c/x (or /cygdrive/c/x). The command reaches the hook
// as JSON, so MSYS never converts it; do that here. Other POSIX-style absolute
// paths on Windows depend on the MSYS mount table, so they are unknown (null).
function toNativePath(path) {
  if (process.platform !== "win32" || !path.startsWith("/")) return path;
  const m = path.match(/^\/(?:cygdrive\/)?([a-zA-Z])(?=\/|$)(.*)$/);
  return m ? `${m[1].toUpperCase()}:${m[2] || "/"}` : null;
}

// True if `target` is, or holds, a secret file. `dir` is the effective working
// directory (null if unknown). Paths that cannot be resolved count as reaching.
function pathReachesSecret(target, dir, mode, ctx) {
  if (target === "-") return false;
  if (/[$`]|^~[^/]/.test(target)) return true;
  let path = toNativePath(target.replace(/^~(?=\/|$)/, homedir()));
  if (path === null) return true;
  // A shell wildcard in the path: walk the literal directory above it instead.
  const glob = path.search(/[*?[{]/);
  if (glob !== -1) path = path.slice(0, Math.max(path.lastIndexOf("/", glob), path.lastIndexOf("\\", glob)) + 1) || ".";
  if (!isAbsolute(path) && dir === null) return true;
  const full = dir === null ? resolve(path) : resolve(dir, path);
  let info;
  let real;
  try {
    info = statSync(full);
    real = realpathSync(full);
  } catch {
    return true; // missing or unreadable: cannot tell, so block
  }
  if (!info.isDirectory()) return secretName.test(basename(full)) || secretName.test(basename(real));
  const key = `${real}\0${mode.links}\0${[...mode.prune].sort().join("/")}`;
  if (!ctx.cache.has(key)) ctx.cache.set(key, treeMayHoldSecret(full, mode, ctx.budget));
  return ctx.cache.get(key);
}

// Entry budget for one hook call, shared by every walk in it. A test may lower
// it with GUARD_BASH_MAX_ENTRIES; it can never be raised.
function walkBudget() {
  const fromEnv = Number.parseInt(process.env.GUARD_BASH_MAX_ENTRIES ?? "", 10);
  return Number.isInteger(fromEnv) && fromEnv >= 0 ? Math.min(fromEnv, 50000) : 50000;
}

// Walk a directory one entry at a time. True if it holds a secret file, or if
// the walk cannot be completed: an unreadable directory, a symlink when the
// reader may follow it (mode.links "uncertain"), or an exhausted budget.
// Only directories the reader itself skips (mode.prune) are pruned.
function treeMayHoldSecret(root, mode, budget) {
  const stack = [root];
  while (stack.length) {
    const path = stack.pop();
    let dir;
    try {
      dir = opendirSync(path);
    } catch {
      return true;
    }
    try {
      for (let e = dir.readSync(); e !== null; e = dir.readSync()) {
        if (--budget.left < 0) return true;
        if (secretName.test(e.name)) return true;
        if (e.isSymbolicLink()) {
          if (mode.links === "skip") continue;
          return true;
        }
        if (e.isDirectory() && !mode.prune.has(e.name)) stack.push(resolve(path, e.name));
      }
    } catch {
      return true;
    } finally {
      try {
        dir.closeSync();
      } catch {
        // already closed
      }
    }
  }
  return false;
}
