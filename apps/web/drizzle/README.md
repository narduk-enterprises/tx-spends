App-owned PostgreSQL migrations live here.

Generate new migrations with:

```bash
pnpm run db:generate
```

Apply migrations to the Neon database with:

```bash
pnpm run db:migrate
```

Migrations are generated from `pg-schema.ts` + `app-schema.ts`.
