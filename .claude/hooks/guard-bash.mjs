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
      // Wildcards the shell expands into a secret file: .env*, .e?v, .{env,x}, .*
      test: (c) => {
        const secretNames = [".env", ".env.local", ".env.production", ".env.keys", ".dev.vars"];
        for (const token of c.replace(/['"\\]/g, "").split(/[\s;&|()<>=`]+/)) {
          const name = token.slice(token.lastIndexOf("/") + 1);
          // Bash globs never match a leading dot unless the dot is typed literally.
          if (!/^[.{]/.test(name) || !/[*?[{]/.test(name)) continue;
          const pattern = globToRegExp(name);
          if (!pattern || secretNames.some((s) => pattern.test(s))) return true;
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

// Convert a shell glob (*, ?, [...], {a,b}) to a RegExp. Like Bash, an unclosed [ or
// unbalanced braces are literal characters (so awk '{print $1}' is not a glob).
// Returns null only if the RegExp cannot be built; the caller then blocks.
function globToRegExp(glob) {
  let depth = 0;
  let balanced = true;
  for (const ch of glob) {
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) balanced = false;
  }
  const expandBraces = balanced && depth === 0;
  let out = "";
  let braces = 0;
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    const end = ch === "[" ? glob.indexOf("]", i + 2) : -1;
    if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else if (end !== -1) {
      out += "[" + glob.slice(i + 1, end).replace(/^!/, "^").replace(/\\/g, "\\\\") + "]";
      i = end;
    } else if (expandBraces && ch === "{") (braces++, (out += "(?:"));
    else if (expandBraces && ch === "}") (braces--, (out += ")"));
    else if (expandBraces && ch === "," && braces > 0) out += "|";
    else out += ch.replace(/[.+^$()|\\[\]{}]/g, "\\$&");
  }
  try {
    return new RegExp(`^${out}$`);
  } catch {
    return null;
  }
}
