/**
 * lesson controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::lesson.lesson', ({ strapi }) => ({
  
  async create(ctx) {
    const data = ctx.request.body?.data ?? {};

    if (data.order === undefined || data.order === null || data.order === '') {
      
      const [last] = await strapi.documents('api::lesson.lesson').findMany({
        filters: { course: data.course },
        sort: { order: 'desc' },
        limit: 1,
      });

      data.order = (last?.order ?? 0) + 1;
      ctx.request.body.data = data;
    }

    return super.create(ctx);
  },
}));
