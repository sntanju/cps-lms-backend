import type { Context } from 'koa';
import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

export default {
  async enroll(ctx: Context) {
    try {
      const { courseId } = ctx.request.body ?? {};

      const result = await strapi
        .service('api::enrollment.enrollment')
        .enroll(ctx.state.user, courseId);

      ctx.status = 201;
      ctx.body = {
        data: result,
      };
    } catch (error) {
      
      const expected = error instanceof ApplicationError;

      if (!expected) {
        strapi.log.error(error);
      }

      ctx.status = 400;
      ctx.body = {
        error: {
          message: expected
            ? (error as Error).message
            : 'Could not enrol in this course',
        },
      };
    }
  },

  async mine(ctx: Context) {
    const authUser = ctx.state.user;

    if (!authUser) {
      return ctx.unauthorized();
    }

    const result = await strapi.service('api::enrollment.enrollment').mine(authUser.id);

    ctx.body = {
      data: result,
    };
  },
};
