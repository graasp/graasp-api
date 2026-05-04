import { type DBConnection } from '../../../../drizzle/db.js';

export class PublisherRepository {
  async getAllValidAppOrigins(dbConnection: DBConnection) {
    const publishers = await dbConnection.query.publishersTable.findMany({
      columns: { origins: true },
    });
    return publishers.map(({ origins }) => origins).flat();
  }
}
