/**
 * The courses the signed-in user may manage.
 *
 * This exists because the client cannot ask for them. Filtering the catalogue
 * with ?filters[instructor][id][$eq]=<id> is rejected with "Invalid key
 * instructor": the content API sanitizer drops the user relation from queries,
 * the same way it drops it from `populate` and from a write body.
 *
 * That is no loss. Scoping the list here is the better design anyway — a filter
 * supplied by the client is an authorization decision made by the client, and
 * swapping the id in the query string would list somebody else's courses.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/managed-courses',
      handler: 'course.managed',
    },
  ],
};
