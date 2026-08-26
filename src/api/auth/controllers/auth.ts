
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
};


