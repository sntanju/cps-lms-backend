import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError } = errors;


function assertValidQuestion(options: unknown, correctIndex: unknown) {
  if (!Array.isArray(options)) {
    throw new ApplicationError('Options must be a list');
  }

  if (options.length < 2) {
    throw new ApplicationError('A question needs at least two options');
  }

  if (options.some((option) => typeof option !== 'string' || !option.trim())) {
    throw new ApplicationError('Every option needs text');
  }

  if (!Number.isInteger(correctIndex)) {
    throw new ApplicationError('Choose which option is the correct answer');
  }

  const index = correctIndex as number;

  if (index < 0 || index >= options.length) {
    throw new ApplicationError('The correct answer must be one of the options');
  }
}

export default factories.createCoreService('api::question.question', ({ strapi }) => ({
  validateNew(data: any) {
    assertValidQuestion(data?.options, data?.correctIndex);
  },

  async validateUpdate(documentId: string, data: any) {
    const existing = await strapi.documents('api::question.question').findOne({
      documentId,
    });

    if (!existing) {
      return;
    }

    assertValidQuestion(
      data?.options ?? existing.options,
      data?.correctIndex ?? existing.correctIndex,
    );
  },
}));
