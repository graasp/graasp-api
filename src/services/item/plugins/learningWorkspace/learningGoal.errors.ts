import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const LearningGoalNotFound = createError(
  'GLG001',
  'Learning goal not found',
  StatusCodes.NOT_FOUND,
);

export const InvalidLearningGoalText = createError(
  'GLG002',
  'Learning goal text must contain between 1 and 200 characters',
  StatusCodes.BAD_REQUEST,
);

export const LearningGoalLimitReached = createError(
  'GLG003',
  'An item cannot have more than 20 learning goals',
  StatusCodes.BAD_REQUEST,
);

export const InvalidLearningGoalOrder = createError(
  'GLG004',
  'Learning goal order must contain every goal for the item exactly once',
  StatusCodes.BAD_REQUEST,
);
