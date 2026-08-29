/**
 * quiz controller
 */

import { factories } from '@strapi/strapi';

function questionForStudent(question: any) {
  return {
    id: question.documentId,
    text: question.text,
    options: question.options,
    // correctIndex is deliberately absent.
  };
}


function questionForAuthor(question: any) {
  return {
    id: question.id,
    documentId: question.documentId,
    text: question.text,
    options: question.options,
    correctIndex: question.correctIndex,
  };
}

export default factories.createCoreController('api::quiz.quiz', ({ strapi }) => ({
 
  async findOne(ctx) {
    const quiz = await strapi.documents('api::quiz.quiz').findOne({
      documentId: ctx.params.id,
      populate: ['questions', 'course'],
    });

    if (!quiz) {
      return ctx.notFound();
    }

    ctx.body = {
      data: {
        id: quiz.id,
        documentId: quiz.documentId,
        title: quiz.title,
        courseDocumentId: (quiz as any).course?.documentId ?? null,
        questions: ((quiz as any).questions ?? []).map(questionForAuthor),
      },
    };
  },

  // The student-facing read: the quiz to take, without the answers.
  async take(ctx) {
    const quiz = await strapi.documents('api::quiz.quiz').findOne({
      documentId: ctx.params.documentId,
      populate: { course: { populate: ['instructor'] }, questions: true },
    });

    if (!quiz) {
      return ctx.notFound();
    }

    // A quiz is course content, so the Phase 5 rule applies unchanged.
    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(ctx.state.user, (quiz as any).course);

    if (!allowed) {
      return ctx.forbidden('Enrol in this course to take its quiz');
    }

    ctx.body = {
      data: {
        id: quiz.documentId,
        title: quiz.title,
        questions: ((quiz as any).questions ?? []).map(questionForStudent),
      },
    };
  },
}));
