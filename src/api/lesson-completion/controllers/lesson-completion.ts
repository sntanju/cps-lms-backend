import type { Context } from 'koa';
import { errors } from '@strapi/utils';

const { ApplicationError, ForbiddenError } = errors;

// Thin handlers; the rules live in the service, like api/auth and api/enrollment.
//
// Only messages we wrote ourselves are sent back. Anything else is a bug or a
// database failure, and its message can carry the SQL statement — so it is
// logged and the client gets the fallback.
function fail(ctx: Context, error: unknown, fallback: string) {
  const forbidden = error instanceof ForbiddenError;
  const expected = forbidden || error instanceof ApplicationError;

  if (!expected) {
    strapi.log.error(error);
  }

  ctx.status = forbidden ? 403 : 400;
  ctx.body = {
    error: {
      message: expected ? (error as Error).message : fallback,
    },
  };
}

export default {
  async complete(ctx: Context) {
    try {
      const { lessonId } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::lesson-completion.lesson-completion')
        .complete(ctx.state.user, lessonId);

      // 201 for a new row, 200 when it was already there — the second click is
      // not an error, it just changed nothing.
      ctx.status = result.created ? 201 : 200;
      ctx.body = { data: result };
    } catch (error) {
      fail(ctx, error, 'Could not mark this lesson complete');
    }
  },

  async uncomplete(ctx: Context) {
    try {
      const { lessonId } = ctx.params;

      const result = await strapi
        .service('api::lesson-completion.lesson-completion')
        .uncomplete(ctx.state.user, lessonId);

      ctx.body = { data: result };
    } catch (error) {
      fail(ctx, error, 'Could not update this lesson');
    }
  },
};
