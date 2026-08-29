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
  async submit(ctx: Context) {
    try {
      const { documentId } = ctx.params;
      // Only `answers` is read. A "score" in the body is not looked at anywhere.
      const { answers } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::quiz-result.quiz-result')
        .grade(ctx.state.user, documentId, answers);

      ctx.status = 201;
      ctx.body = { data: result };
    } catch (error) {
      fail(ctx, error, 'Could not submit this quiz');
    }
  },

  async mine(ctx: Context) {
    const result = await strapi
      .service('api::quiz-result.quiz-result')
      .mine(ctx.state.user.id);

    ctx.body = { data: result };
  },

  async forQuiz(ctx: Context) {
    try {
      const result = await strapi
        .service('api::quiz-result.quiz-result')
        .forQuiz(ctx.state.user, ctx.params.documentId);

      ctx.body = { data: result };
    } catch (error) {
      fail(ctx, error, 'Could not load your attempts');
    }
  },

  async forCourse(ctx: Context) {
    try {
      const { rows, course } = await strapi
        .service('api::quiz-result.quiz-result')
        .forCourse(ctx.state.user, ctx.params.documentId);

      ctx.body = { data: rows, meta: { course } };
    } catch (error) {
      fail(ctx, error, 'Could not load these results');
    }
  },
};
