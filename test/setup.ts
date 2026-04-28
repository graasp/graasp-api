import 'reflect-metadata';

import { client } from '../src/drizzle/db.js';

async function beforeTests() {
  await client.connect();
}
export default beforeTests;
