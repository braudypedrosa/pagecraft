import type postgres from "npm:postgres@3.4.7";

type Sql = postgres.Sql;
type Kind = "site_owner" | "library";
type Row = Record<string, unknown>;

const OPS = new Set([
  "collaboration.listForUser",
  "collaboration.listForResource",
  "collaboration.invite",
  "collaboration.decide",
  "collaboration.removeForRecipient",
]);

export const isCollaborationOp = (op: string) => OPS.has(op);
const text = (value: unknown) => String(value ?? "");
const one = <T>(rows: T[]): T | null => rows[0] || null;
const kindOf = (value: unknown): Kind => {
  if (value === "site_owner" || value === "library") return value;
  throw Object.assign(new Error("invalid collaboration invitation kind"), {
    status: 400,
    code: "INVALID_INVITATION_KIND",
  });
};
const invitation = (row: Row) => ({
  id: text(row.id),
  kind: kindOf(row.kind),
  resourceId: text(row.resource_id),
  recipientId: text(row.recipient_id),
  invitedBy: text(row.invited_by),
  createdAt: row.created_at,
});

export async function dispatchCollaboration(
  sql: Sql,
  op: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (op === "collaboration.listForUser") {
    const rows = await sql<Row[]>`
      select i.*,
        case when i.kind = 'site_owner'
          then (select s.name from sites s where s.id = i.resource_id)
          else (select l.name from libraries l where l.id = i.resource_id::uuid)
        end as resource_name,
        coalesce(nullif(u.name, ''), u.email) as inviter_name
      from collaboration_invitations i
      join users u on u.id = i.invited_by
      where i.recipient_id = ${text(args.userId)}
      order by i.created_at desc
    `;
    return rows.filter((row) => row.resource_name != null).map((row) => ({
      ...invitation(row),
      resourceName: text(row.resource_name),
      inviterName: text(row.inviter_name),
    }));
  }

  if (op === "collaboration.listForResource") {
    const kind = kindOf(args.kind);
    const rows = await sql<Row[]>`
      select i.*, u.email as recipient_email, u.name as recipient_name
      from collaboration_invitations i
      join users u on u.id = i.recipient_id
      where i.kind = ${kind} and i.resource_id = ${text(args.resourceId)}
      order by i.created_at
    `;
    return rows.map((row) => ({
      ...invitation(row),
      recipientEmail: text(row.recipient_email),
      recipientName: text(row.recipient_name),
    }));
  }

  if (op === "collaboration.invite") {
    const kind = kindOf(args.kind);
    const resourceId = text(args.resourceId);
    const recipientId = text(args.recipientId);
    const invitedBy = text(args.invitedBy);
    return await sql.begin(async (transaction) => {
      if (kind === "site_owner") {
        const resource = one(await transaction<Row[]>`
          select id from sites where id = ${resourceId} for update
        `);
        if (!resource) return { status: "forbidden" };
        const actor = one(await transaction<Row[]>`
          select role from site_users
          where site_id = ${resourceId} and user_id = ${invitedBy}
        `);
        if (actor?.role !== "owner") return { status: "forbidden" };
        const member = one(await transaction<Row[]>`
          select role from site_users
          where site_id = ${resourceId} and user_id = ${recipientId}
        `);
        if (member?.role === "owner") return { status: "already_member" };
      } else {
        const resource = one(await transaction<Row[]>`
          select owner_id from libraries where id = ${resourceId}::uuid for update
        `);
        if (resource?.owner_id !== invitedBy) return { status: "forbidden" };
        const member = one(await transaction<Row[]>`
          select user_id from library_members
          where library_id = ${resourceId}::uuid and user_id = ${recipientId}
        `);
        if (member) return { status: "already_member" };
      }
      const recipient = one(await transaction<Row[]>`
        select id from users where id = ${recipientId}
      `);
      if (!recipient) return { status: "forbidden" };
      const prior = one(await transaction<Row[]>`
        select * from collaboration_invitations
        where kind = ${kind} and resource_id = ${resourceId}
          and recipient_id = ${recipientId}
      `);
      if (prior) return { status: "pending", invitation: invitation(prior) };
      if (kind === "library") {
        const count = one(await transaction<Row[]>`
          select ((select count(*) from library_members
                    where library_id = ${resourceId}::uuid) +
                  (select count(*) from collaboration_invitations
                    where kind = 'library' and resource_id = ${resourceId}))::integer as count
        `);
        if (Number(count?.count || 0) >= 50) return { status: "limit" };
      }
      const saved = one(await transaction<Row[]>`
        insert into collaboration_invitations
          (id, kind, resource_id, recipient_id, invited_by)
        values (${crypto.randomUUID()}, ${kind}, ${resourceId}, ${recipientId}, ${invitedBy})
        returning *
      `)!;
      return { status: "pending", invitation: invitation(saved) };
    });
  }

  if (op === "collaboration.decide") {
    const id = text(args.id);
    const userId = text(args.userId);
    const accept = args.accept === true;
    return await sql.begin(async (transaction) => {
      // Read identity first, then lock resource before invitation. Invite uses the same order.
      const peek = one(await transaction<Row[]>`
        select * from collaboration_invitations where id = ${id}
      `);
      if (!peek || peek.recipient_id !== userId) return "missing";
      const kind = kindOf(peek.kind);
      const resourceId = text(peek.resource_id);
      if (kind === "site_owner") {
        await transaction`select id from sites where id = ${resourceId} for update`;
      } else {
        await transaction`select id from libraries where id = ${resourceId}::uuid for update`;
      }
      const current = one(await transaction<Row[]>`
        select * from collaboration_invitations where id = ${id} for update
      `);
      if (!current || current.recipient_id !== userId) return "missing";
      if (!accept) {
        await transaction`delete from collaboration_invitations where id = ${id}`;
        return "declined";
      }
      if (kind === "site_owner") {
        const actor = one(await transaction<Row[]>`
          select role from site_users
          where site_id = ${resourceId} and user_id = ${text(current.invited_by)}
        `);
        if (actor?.role !== "owner") {
          await transaction`delete from collaboration_invitations where id = ${id}`;
          return "missing";
        }
        await transaction`
          insert into site_users (site_id, user_id, role)
          values (${resourceId}, ${text(current.recipient_id)}, 'owner')
          on conflict (site_id, user_id) do update set role = 'owner'
        `;
      } else {
        const resource = one(await transaction<Row[]>`
          select owner_id from libraries where id = ${resourceId}::uuid
        `);
        if (resource?.owner_id !== current.invited_by) {
          await transaction`delete from collaboration_invitations where id = ${id}`;
          return "missing";
        }
        await transaction`
          insert into library_members (library_id, user_id, invited_by)
          values (${resourceId}::uuid, ${text(current.recipient_id)}, ${text(current.invited_by)})
          on conflict (library_id, user_id) do nothing
        `;
      }
      await transaction`delete from collaboration_invitations where id = ${id}`;
      return "accepted";
    });
  }

  if (op === "collaboration.removeForRecipient") {
    const rows = await sql<Row[]>`
      delete from collaboration_invitations
      where kind = ${kindOf(args.kind)} and resource_id = ${text(args.resourceId)}
        and recipient_id = ${text(args.recipientId)}
      returning id
    `;
    return rows.length > 0;
  }

  throw Object.assign(new Error("unknown collaboration operation"), {
    status: 400,
    code: "UNKNOWN_OPERATION",
  });
}
