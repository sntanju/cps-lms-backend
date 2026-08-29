/**
 * blog-post router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::blog-post.blog-post', {
  config: {
   
    create: {
      policies: ['api::blog-post.can-manage-blog'],
    },
    update: {
      policies: ['api::blog-post.can-manage-blog'],
    },
    delete: {
      policies: ['api::blog-post.can-manage-blog'],
    },
  },
});
