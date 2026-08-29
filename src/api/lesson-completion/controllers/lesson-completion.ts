import type { Context } from 'koa';
import { errors } from '@strapi/utils';

const { ApplicationError, ForbiddenError } = errors;

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
