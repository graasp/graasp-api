/**
 * Fails when `schema.ts` and the database disagree.
 *
 * The database schema is owned by the admin app (graasp/graasp-web, ADR 0002):
 * it writes and runs the migrations, and `schema.ts` is a hand-maintained
 * description of the database admin has migrated. This check introspects such a
 * database with `drizzle-kit pull` and asks drizzle which statements would turn
 * it into `schema.ts`. Any statement means `schema.ts` has drifted.
 *
 * Only the tables and views declared in `schema.ts` are compared. Admin-only
 * tables (oban_*, notifications, folder_exports, ...) are left out: without the
 * filter drizzle would offer to drop them. For the same reason, never run
 * `drizzle-kit push` against a shared database.
 *
 * (`pushSchema` from `drizzle-kit/api` would do this in one call, but as of
 * drizzle-kit 0.31.11 it drops query parameters while introspecting.)
 *
 * Usage: mise run schema-drift-check (uses DB_CONNECTION)
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { getTableName, getViewName, is } from 'drizzle-orm';
import { PgTable, PgView } from 'drizzle-orm/pg-core';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as schema from './schema';

function declaredNames(): string[] {
  return Object.values(schema).flatMap((value) => {
    if (is(value, PgTable)) {
      return [getTableName(value)];
    }
    if (is(value, PgView)) {
      return [getViewName(value)];
    }
    return [];
  });
}

/** Introspects the database into a drizzle snapshot, limited to `names`. */
function pullSnapshot(url: string, names: string[]) {
  const dir = mkdtempSync(path.join(tmpdir(), 'schema-drift-'));
  try {
    const config = path.join(dir, 'drizzle.config.json');
    writeFileSync(
      config,
      JSON.stringify({
        dialect: 'postgresql',
        out: path.join(dir, 'out'),
        dbCredentials: { url },
        schemaFilter: ['public'],
        tablesFilter: names,
      }),
    );
    execFileSync('drizzle-kit', ['pull', `--config=${config}`], { stdio: 'pipe' });
    return JSON.parse(readFileSync(path.join(dir, 'out', 'meta', '0000_snapshot.json'), 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The parts of a drizzle snapshot that are normalized below. */
type Snapshot = {
  tables: Record<
    string,
    {
      name: string;
      indexes: Record<
        string,
        {
          columns: { expression: string; isExpression: boolean; opclass?: string }[];
          where?: string;
        }
      >;
      uniqueConstraints: Record<string, { columns: string[] }>;
      compositePrimaryKeys: Record<string, { columns: string[] }>;
    }
  >;
  views: Record<string, unknown>;
  enums: Record<string, unknown>;
  sequences: Record<string, unknown>;
};

/** Lowercased, without quotes, table qualifiers, parentheses or extra spaces. */
function canonicalWhere(where: string | undefined, table: string) {
  return where
    ?.replaceAll('"', '')
    .replaceAll(`${table}.`, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Removes the differences that come from how drizzle compares snapshots rather
 * than from the schema itself:
 * - the database reports every index opclass; `schema.ts` only declares
 *   non-default ones, so the database's is dropped when `schema.ts` has none;
 * - partial index conditions and index expressions are written differently on
 *   each side, and `drizzle-kit pull` marks every column of an expression index
 *   as an expression;
 * - `drizzle-kit pull` does not keep the column order of unique constraints
 *   and composite primary keys (it reads them from
 *   information_schema.constraint_column_usage, which has no position);
 * - enums and sequences are not covered by `tablesFilter`;
 * - views are compared as SQL text, which never matches, so they are only
 *   checked for existence.
 */
function normalize(database: Snapshot, declared: Snapshot) {
  const missingViews = Object.keys(declared.views).filter((view) => !(view in database.views));
  database.views = {};
  declared.views = {};

  database.enums = pick(database.enums, Object.keys(declared.enums));
  database.sequences = pick(database.sequences, Object.keys(declared.sequences));

  for (const [key, table] of Object.entries(declared.tables)) {
    const databaseTable = database.tables[key];
    if (!databaseTable) {
      continue;
    }

    for (const [name, index] of Object.entries(table.indexes)) {
      const databaseIndex = databaseTable.indexes[name];
      if (!databaseIndex) {
        continue;
      }
      index.columns.forEach((column, i) => {
        if (!column.opclass && databaseIndex.columns[i]) {
          delete databaseIndex.columns[i].opclass;
        }
      });
      for (const column of [...index.columns, ...databaseIndex.columns]) {
        column.expression = canonicalExpression(column.expression);
        column.isExpression = false;
      }
      index.where = canonicalWhere(index.where, table.name);
      databaseIndex.where = canonicalWhere(databaseIndex.where, table.name);
    }

    for (const constraint of [
      ...Object.values(table.uniqueConstraints),
      ...Object.values(databaseTable.uniqueConstraints),
      ...Object.values(table.compositePrimaryKeys),
      ...Object.values(databaseTable.compositePrimaryKeys),
    ]) {
      constraint.columns.sort();
    }
  }

  return missingViews;
}

/** Without quotes, extra spaces or wrapping parentheses. */
function canonicalExpression(expression: string) {
  let canonical = expression.replaceAll('"', '').replace(/\s+/g, ' ').trim();
  while (/^\(.*\)$/.test(canonical) && balanced(canonical.slice(1, -1))) {
    canonical = canonical.slice(1, -1);
  }
  return canonical;
}

function balanced(text: string) {
  let depth = 0;
  for (const char of text) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (depth < 0) {
      return false;
    }
  }
  return depth === 0;
}

function pick<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => keys.includes(key)));
}

async function main() {
  const url = process.env.DB_CONNECTION;
  if (!url) {
    throw new Error('DB_CONNECTION is not set');
  }

  const database = pullSnapshot(url, declaredNames());
  const declared = generateDrizzleJson(schema);
  const missingViews = normalize(database, declared as unknown as Snapshot);
  const statements = await generateMigration(database, declared);

  if (statements.length === 0 && missingViews.length === 0) {
    // eslint-disable-next-line no-console
    console.log('schema.ts matches the database');
    return;
  }

  console.error(
    'schema.ts does not match the database.\n\n' +
      (missingViews.length
        ? `Views missing from the database: ${missingViews.join(', ')}\n\n`
        : '') +
      (statements.length
        ? `Making the database match schema.ts would run:\n\n${statements.join('\n')}\n\n`
        : '') +
      'Update schema.ts to describe the database. Schema changes are made with an Ecto migration in the admin app.',
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
