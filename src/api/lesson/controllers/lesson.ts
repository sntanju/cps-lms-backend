/**
 * lesson controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::lesson.lesson', ({ strapi }) => ({
  
  async findOne(ctx) {
    const lesson = await strapi.documents('api::lesson.lesson').findOne({
      documentId: ctx.params.id,
      populate: { course: { populate: ['instructor'] } },
    });

    if (!lesson) {
      return ctx.notFound();
    }

    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(ctx.state.user, lesson.course);

    if (!allowed) {
      return ctx.forbidden('Enrol in this course to view its lessons');
    }

    return super.findOne(ctx);
  },

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
