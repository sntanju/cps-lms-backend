
export default {
  routes: [
    {
      method: 'POST',
      path: '/lesson-completions/complete',
      handler: 'lesson-completion.complete',
    },
    {
      
      method: 'DELETE',
      path: '/lesson-completions/complete/:lessonId',
      handler: 'lesson-completion.uncomplete',
    },
  ],
};
