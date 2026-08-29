/**
 * quiz router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::quiz.quiz', {
  config: {
    findOne: {
      policies: ['api::quiz.is-quiz-owner'],
    },
    create: {
      policies: ['api::quiz.is-quiz-owner'],
    },
    update: {
      policies: ['api::quiz.is-quiz-owner'],
    },
    delete: {
      policies: ['api::quiz.is-quiz-owner'],
    },
  },
});
