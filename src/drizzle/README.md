# Drizzle

- `schema.ts`, `relations.ts`: the database as seen by core. `schema.ts` is maintained by hand to describe the database migrated by the admin app ([graasp/graasp-web](https://github.com/graasp/graasp-web)), which owns the schema. `mise run schema-drift-check` verifies it.
- `0000_*.sql` to `0021_*.sql` and `meta/`: drizzle migrations from before admin took over the schema. They are frozen history: do not add, edit or run them.
