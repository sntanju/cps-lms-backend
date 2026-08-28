/**
 * lesson router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::lesson.lesson', {
  config: {
    create: {
      policies: ['api::lesson.can-manage-lesson'],
    },
    update: {
      policies: ['api::lesson.can-manage-lesson'],
    },
    delete: {
      policies: ['api::lesson.can-manage-lesson'],
    },
  },
});
