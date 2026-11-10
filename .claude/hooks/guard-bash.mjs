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
