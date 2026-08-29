import type { Context } from 'koa';
import { errors } from '@strapi/utils';

const { ApplicationError, NotFoundError } = errors;

function fail(ctx: Context, error: unknown, fallback: string) {
  const missing = error instanceof NotFoundError;
  const expected = missing || error instanceof ApplicationError;

  if (!expected) {
    strapi.log.error(error);
  }

  ctx.status = missing ? 404 : 400;
  ctx.body = {
    error: {
      message: expected ? (error as Error).message : fallback,
    },
  };
}

export default {
  async users(ctx: Context) {
    ctx.body = { data: await strapi.service('api::admin-panel.admin-panel').users() };
  },

  async roles(ctx: Context) {
    ctx.body = { data: await strapi.service('api::admin-panel.admin-panel').roles() };
  },

  async stats(ctx: Context) {
    ctx.body = { data: await strapi.service('api::admin-panel.admin-panel').stats() };
  },

  async setRole(ctx: Context) {
    try {
      const { roleId } = ctx.request.body ?? {};

      const user = await strapi
        .service('api::admin-panel.admin-panel')
        .setRole(ctx.state.user, ctx.params.id, roleId);

      ctx.body = { data: user };
    } catch (error) {
      fail(ctx, error, 'Could not change this role');
    }
  },
};
