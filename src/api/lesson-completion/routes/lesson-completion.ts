// Hand-written, with no core router: a generic create would accept another
// student's id in the body, and a generic find would list everybody's progress.
export default {
  routes: [
    {
      method: 'POST',
      path: '/lesson-completions/complete',
      handler: 'lesson-completion.complete',
    },
    {
      // The lesson is in the path, not the body: Koa's body parser does not
      // populate ctx.request.body on a DELETE, so a body here arrives empty.
      method: 'DELETE',
      path: '/lesson-completions/complete/:lessonId',
      handler: 'lesson-completion.uncomplete',
    },
  ],
};
