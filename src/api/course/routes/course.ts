/**
 * course router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::course.course', {
  config: {
    // create takes no ownership policy: there is no existing row to own yet.
    // Who the new course belongs to is decided in the controller instead.
    update: {
      policies: ['api::course.is-course-owner'],
    },
    delete: {
      policies: ['api::course.is-course-owner'],
    },
  },
});
