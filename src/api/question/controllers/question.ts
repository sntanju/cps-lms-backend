import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::question.question', ({ strapi }) => ({
  async create(ctx) {
    strapi.service('api::question.question').validateNew(ctx.request.body?.data);

    return super.create(ctx);
  },

  async update(ctx) {
    await strapi
      .service('api::question.question')
      .validateUpdate(ctx.params.id, ctx.request.body?.data);

    return super.update(ctx);
  },
}));
