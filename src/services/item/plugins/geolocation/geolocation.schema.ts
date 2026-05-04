import { Type } from '@sinclair/typebox';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox.js';

export const geoCoordinateSchema = customType.StrictObject(
  {
    lat: Type.Number(),
    lng: Type.Number(),
  },
  { description: 'Geographic coordinates' },
);

export const geoCoordinateSchemaRef = registerSchemaAsRef(
  'geoCoordinate',
  'Geographic Coordinate',
  geoCoordinateSchema,
);
