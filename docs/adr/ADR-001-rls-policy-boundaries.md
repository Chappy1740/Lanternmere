# ADR-001: RLS policy boundaries and atomic Lodge creation

**Status:** Accepted; preserved from the original Lanternmere migration design notes.

## Decision

Lodge authorization policies must not query \`lodge_members\` directly when that table is itself RLS-protected. Cross-table membership and role checks use narrowly scoped \`SECURITY DEFINER\` helpers in the private, unexposed schema: \`private.is_lodge_member\`, \`private.is_lodge_admin\`, \`private.is_lodge_owner\`, and \`private.shares_lodge_with\`.

The helpers set \`search_path = ''\` and fully qualify referenced objects. The private schema is not exposed through PostgREST. Its helpers retain the execution grants needed for policy evaluation; the unexposed schema prevents public RPC access.

Lodges are created only through the authenticated \`public.create_lodge(name, description)\` RPC. It atomically creates the Lodge, owner membership, and creation audit event. Direct authenticated inserts into \`public.lodges\` are revoked.

## Context

The Lodge \`SELECT\` policy depends on a membership row. A direct \`INSERT ... RETURNING\` cannot reliably produce a returnable Lodge before the owner membership exists, because returning visibility is evaluated before after-row triggers. The RPC performs both writes within one trusted transaction and checks \`auth.uid()\` itself.

Direct policy lookups against RLS-protected \`lodge_members\` would recursively reapply RLS during policy evaluation. The private helpers flatten that authorization check and keep policy intent explicit.

## Consequences

- RLS remains the final data boundary; hiding UI is never authorization.
- New Lodge-scoped policies reuse or deliberately extend the helpers rather than reintroduce RLS recursion.
- \`SECURITY DEFINER\` functions retain an explicit secure search path and minimal surface area.
- Future invitation or role-management work must honor this boundary instead of bypassing it with service-role writes.

## Evidence

The implementation and original design notes are preserved in [\`supabase/migrations/0001_initial_schema.sql\`](../../supabase/migrations/0001_initial_schema.sql).
