

import { factories } from '@strapi/strapi';

const BLOG_ROLES = ['Admin', 'Content Manager'];

function canSeeDrafts(user: any) {

  return BLOG_ROLES.includes(user?.role?.name);
}
function publicAuthor(author: any) {
  if (!author) {
    return null;
  }

  return {
    id: author.id,
    fullName: author.fullName ?? author.username,
  };
}

export default factories.createCoreController('api::blog-post.blog-post', ({ strapi }) => ({
  async find(ctx) {
    if (!canSeeDrafts(ctx.state.user)) {
    
      ctx.query.filters = {
        ...(ctx.query.filters as object),
        postStatus: 'published',
      };
    }

    const response = await super.find(ctx);

    if (!response?.data?.length) {
      return response;
    }

    const posts = await strapi.documents('api::blog-post.blog-post').findMany({
      filters: {
        documentId: { $in: response.data.map((post: any) => post.documentId) },
      },
      populate: ['author'],
    });

    const authorByDocumentId = new Map(
      posts.map((post: any) => [post.documentId, publicAuthor(post.author)]),
    );

    response.data = response.data.map((post: any) => ({
      ...post,
      author: authorByDocumentId.get(post.documentId) ?? null,
    }));

    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    const entry = response?.data;

    if (!canSeeDrafts(ctx.state.user) && entry?.postStatus !== 'published') {
      return ctx.notFound();
    }

    const post = await strapi.documents('api::blog-post.blog-post').findOne({
      documentId: entry.documentId,
      populate: ['author'],
    });

    entry.author = publicAuthor((post as any)?.author);

    return response;
  },

  async create(ctx) {
    const data = ctx.request.body?.data ?? {};

    delete data.author;
    ctx.request.body.data = data;

    const response = await super.create(ctx);
    const entry = response?.data;

    if (entry) {
      await strapi.documents('api::blog-post.blog-post').update({
        documentId: entry.documentId,
        data: { author: ctx.state.user.id },
      });

      entry.author = publicAuthor(ctx.state.user);
    }

    return response;
  },

  async update(ctx) {
    const data = ctx.request.body?.data ?? {};

    delete data.author;
    ctx.request.body.data = data;

    return super.update(ctx);
  },
}));
