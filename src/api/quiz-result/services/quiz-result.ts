import { errors } from '@strapi/utils';

const { ApplicationError, ForbiddenError } = errors;

// "Take quizzes" is Student-only in the permission matrix.
const TAKING_ROLE = 'Student';

function resultSummary(result: any) {
  return {
    id: result.id,
    documentId: result.documentId,
    score: result.score,
    totalQuestions: result.totalQuestions,
    submittedAt: result.submittedAt,
  };
}

function courseSummary(course: any) {
  if (!course) {
    return null;
  }

  return {
    documentId: course.documentId,
    title: course.title,
  };
}

function quizSummary(quiz: any) {
  if (!quiz) {
    return null;
  }

  return {
    documentId: quiz.documentId,
    title: quiz.title,
  };
}

export default ({ strapi }: { strapi: any }) => ({
  
  async grade(user: any, quizDocumentId: string, submitted: unknown) {
    if (user.role?.name !== TAKING_ROLE) {
      throw new ForbiddenError('Only students can take a quiz');
    }

    if (!Array.isArray(submitted)) {
      throw new ApplicationError('Answers must be a list');
    }

    const quiz = await strapi.documents('api::quiz.quiz').findOne({
      documentId: quizDocumentId,
      populate: { course: { populate: ['instructor'] }, questions: true },
    });

    if (!quiz) {
      throw new ApplicationError('That quiz does not exist');
    }

   
    const allowed = await strapi
      .service('api::course.course')
      .canAccessContent(user, quiz.course);

    if (!allowed) {
      throw new ForbiddenError('Enrol in this course to take its quiz');
    }

    const chosen = new Map<string, number>();

    for (const answer of submitted as any[]) {
      if (Number.isInteger(answer?.selectedIndex)) {
        chosen.set(answer.questionId, answer.selectedIndex);
      }
    }

    let score = 0;
    const answers = (quiz.questions ?? []).map((question: any) => {
      const selectedIndex = chosen.get(question.documentId);

      const correct = selectedIndex === question.correctIndex;

      if (correct) {
        score += 1;
      }

      return {
        questionId: question.documentId,
        selectedIndex: selectedIndex ?? null,
        correct,
      };
    });

    const result = await strapi.documents('api::quiz-result.quiz-result').create({
      data: {
        student: user.id,
        quiz: quiz.id,
        course: quiz.course?.id ?? null,
        score,
        totalQuestions: answers.length,
        answers,
        submittedAt: new Date(),
      },
    });

    return { ...resultSummary(result), answers };
  },

  // Every result for one student, newest first.
  async mine(studentId: number) {
    const results = await strapi
      .documents('api::quiz-result.quiz-result')
      .findMany({
        
        filters: { student: { id: studentId } },
        populate: ['quiz', 'course'],
        sort: { submittedAt: 'desc' },
      });

    return results.map((result: any) => ({
      ...resultSummary(result),
      quiz: quizSummary(result.quiz),
      course: courseSummary(result.course),
    }));
  },

  // One student's attempts at one quiz, for the history list under the quiz.
  async forQuiz(user: any, quizDocumentId: string) {
    const quiz = await strapi.documents('api::quiz.quiz').findOne({
      documentId: quizDocumentId,
    });

    if (!quiz) {
      throw new ApplicationError('That quiz does not exist');
    }

    const results = await strapi
      .documents('api::quiz-result.quiz-result')
      .findMany({
        filters: { student: { id: user.id }, quiz: { id: quiz.id } },
        sort: { submittedAt: 'desc' },
      });

    return results.map((result: any) => ({
      ...resultSummary(result),
      answers: result.answers ?? [],
    }));
  },

  // Every student's results in one course, for the people who run it.
  async forCourse(user: any, courseDocumentId: string) {
    const course = await strapi.documents('api::course.course').findOne({
      documentId: courseDocumentId,
      populate: ['instructor'],
    });

    if (!course) {
      throw new ApplicationError('That course does not exist');
    }

    if (!strapi.service('api::course.course').canManageCourse(user, course)) {
      throw new ForbiddenError('You do not manage this course');
    }

    const results = await strapi
      .documents('api::quiz-result.quiz-result')
      .findMany({
        filters: { course: { id: course.id } },
        populate: ['student', 'quiz'],
        sort: { submittedAt: 'desc' },
      });

    const rows = results
      // A student deleted after taking the quiz leaves a row with no student.
      .filter((result: any) => result.student)
      .map((result: any) => ({
        ...resultSummary(result),
        student: {
          id: result.student.id,
          fullName: result.student.fullName ?? result.student.username,
          email: result.student.email,
        },
        quiz: quizSummary(result.quiz),
      }));

    return {
      rows,
      course: courseSummary(course),
    };
  },
});
