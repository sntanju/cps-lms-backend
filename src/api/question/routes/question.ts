/**
 * question router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::question.question', {
  config: {
    create: {
      policies: ['api::question.is-question-owner'],
    },
    update: {
      policies: ['api::question.is-question-owner'],
    },
    delete: {
      policies: ['api::question.is-question-owner'],
    },
  },
});
