import 'reflect-metadata';

import { client } from '../src/drizzle/db.js';

async function afterTests() {
  await client.end();
}
export default afterTests;
