
import type { Context } from 'koa';

export default {
  async register(ctx: Context) {
    try {
      const { name, email, password } = ctx.request.body;

      const result = await strapi
        .service('api::auth.auth')
        .register({
          name,
          email,
          password,
        });

      ctx.status = 201;
      ctx.body = {
        data: result,
      };
    } catch (error) {
      ctx.status = 400;
      ctx.body = {
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Registration failed',
        },
      };
    }
  },

  async me(ctx: Context) {
    // Populated by Strapi's auth strategy from the Bearer token, so it is the
    // authenticated user — never an id read from the request.
    const authUser = ctx.state.user;

    if (!authUser) {
      return ctx.unauthorized();
    }

    const result = await strapi.service('api::auth.auth').me(authUser.id);

    ctx.body = {
      data: result,
    };
  },
};


