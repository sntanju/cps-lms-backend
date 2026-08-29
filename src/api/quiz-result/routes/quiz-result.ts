
export default {
  routes: [
    {
      method: 'POST',
      path: '/quizzes/:documentId/submit',
      handler: 'quiz-result.submit',
    },
    {
      method: 'GET',
      path: '/quizzes/:documentId/my-results',
      handler: 'quiz-result.forQuiz',
    },
    {
      method: 'GET',
      path: '/quiz-results/mine',
      handler: 'quiz-result.mine',
    },
    {
      method: 'GET',
      path: '/courses/:documentId/quiz-results',
      handler: 'quiz-result.forCourse',
    },
  ],
};
