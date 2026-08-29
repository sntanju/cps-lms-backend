
export default {
  routes: [
    {
      method: 'GET',
      path: '/quizzes/:documentId/take',
      handler: 'quiz.take',
    },
  ],
};
