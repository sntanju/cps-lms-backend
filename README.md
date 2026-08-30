# CPS LMS — Backend (Strapi)

The API and admin panel for a Learning Management System with four roles: **Admin**,
**Content Manager**, **Instructor** and **Student**. Built for the Junior Software
Engineer project round.

The Next.js frontend lives in a separate repository and talks to this API over HTTP.

- Stack: Strapi 5 (TypeScript) + PostgreSQL
- Deployed on Railway

---

## Running it locally

**Requirements:** Node 20–26 (see `engines` in `package.json`) and a PostgreSQL server.

```bash
# 1. a database for it to use
createdb cps_lms_database

# 2. dependencies
npm install

# 3. configuration
cp .env.example .env
#    then edit .env — see the table below

# 4. run it
npm run develop
```

The API is then on `http://localhost:1337` and the Strapi admin on
`http://localhost:1337/admin`.

### Environment variables

Every one of these is read from the environment; nothing is hard-coded, which is what
makes the same build run locally and on Railway.

| Variable | What it is for |
| --- | --- |
| `HOST`, `PORT` | Where Strapi listens. `0.0.0.0` and `1337`. |
| `APP_KEYS` | Comma-separated session signing keys. |
| `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT` | Salts for Strapi's own API/transfer tokens. |
| `ADMIN_JWT_SECRET` | Signs sessions for the Strapi admin panel. |
| `JWT_SECRET` | Signs the access tokens the frontend uses. |
| `ENCRYPTION_KEY` | Encrypts values Strapi stores at rest. |
| `DATABASE_CLIENT` | `postgres` for this project. |
| `DATABASE_HOST`, `_PORT`, `_NAME`, `_USERNAME`, `_PASSWORD`, `_SSL` | Connection details. |
| `DATABASE_URL` | A managed-Postgres connection string. **When set it overrides every `DATABASE_*` value above**, so leave those unset in production. |
| `FRONTEND_URLS` | Comma-separated list of allowed CORS origins. Defaults to `http://localhost:3000`, so local development needs nothing here. |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME` | The first Admin account, created on boot. |

Generate fresh secrets for production. Never reuse the ones from a local `.env`, and
never commit either.

### What happens on boot

`src/index.ts` runs on every start, and it is what makes this app deployable to an empty
database:

1. **Creates the four LMS roles** if they are missing. Users-permissions roles are
   database *rows*, not code, so a brand-new Railway Postgres starts with only `Public`
   and `Authenticated`. Without this step there would be no Admin role, and the boot
   below it throws — leaving no admin panel in which to create the missing role.
2. **Grants each role its permissions.** Permissions are rows too, so the grid in
   Settings → Roles does not travel to production either. The lists at the top of
   `src/index.ts` are the source of truth.
3. **Revokes `auth.register` from Public**, so self-registration can only go through
   `POST /api/auth/register`, which hard-codes the Student role.
4. **Grants Public read access to blog posts**, the one content permission Public has.
5. **Creates the initial Admin** from `INITIAL_ADMIN_*`. Strapi refuses to start if
   those three variables are missing — that is the most likely first-deploy failure.

Every step is idempotent, so restarting changes nothing.

---

## How authorisation works

Two layers, and both matter:

**The permission grid** decides whether a role may attempt an action at all. It is
all-or-nothing per action, so it cannot express the spec's "own only" rules.

**Route policies** decide whether this user may do it to *this row*:

| Policy | Rule |
| --- | --- |
| `course/policies/is-course-owner` | Admin and Content Manager platform-wide; Instructor only their own courses. |
| `lesson/policies/can-manage-lesson` | Resolves through the lesson's course. |
| `quiz/policies/is-quiz-owner`, `question/policies/is-question-owner` | Resolve through the quiz's course. |
| `blog-post/policies/can-manage-blog` | Admin and Content Manager. No per-row check — the matrix gives Content Manager a plain tick for blog posts. |
| `admin-panel/policies/is-admin` | Admin only. |

Nothing trusts a role, user id, ownership or course id sent by the client. Identity
always comes from `ctx.state.user`, which Strapi fills from the verified Bearer token.

### Tokens

`config/plugins.ts` sets `jwtManagement: 'refresh'` with **`sessions.httpOnly: false`**.
Login returns `{ jwt, refreshToken, user }` in the response body; no cookies are used
anywhere.

That was chosen deliberately: Vercel and Railway are different sites, so a refresh
cookie would be a third-party cookie, and Safari blocks those by default — silently
logging users out. The trade-offs that follow:

- `POST /api/auth/refresh` **rotates** the refresh token. The client must store the new
  one every time; reusing the old one fails.
- The refresh token is readable by JavaScript, so user-authored content is never rendered
  as raw HTML. Blog post bodies in particular are plain text on the frontend.
- The access token travels in an `Authorization` header, which makes the API inherently
  CSRF-immune. There is no CSRF machinery, on purpose.

---

## API overview

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | Public. Always creates a Student. |
| POST | `/api/auth/local` | Login. Returns `jwt`, `refreshToken`, `user`. |
| POST | `/api/auth/refresh` | Rotates both tokens. |
| POST | `/api/auth/logout` | Revokes the refresh token. |
| GET | `/api/auth/me` | The signed-in user with their role. |

### Courses and lessons

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST/PUT/DELETE | `/api/courses` | Writes guarded by `is-course-owner`. |
| GET | `/api/managed-courses` | Courses the caller may edit. |
| GET | `/api/course-instructors` | Assignable instructors (Admin / Content Manager). |
| GET | `/api/courses/:documentId/lessons` | Gated on enrolment. |
| GET/POST/PUT/DELETE | `/api/lessons` | `find` is revoked from Students so the whole lesson library is not listable. |

### Enrolment and progress

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/enrollments/enroll` | Student only. |
| GET | `/api/enrollments/mine` | Filtered on the token, not on a client filter. |
| POST | `/api/lesson-completions/complete` | Idempotent — a second click changes nothing. |
| DELETE | `/api/lesson-completions/complete/:lessonId` | |
| GET | `/api/courses/:documentId/progress` | The caller's own progress. |
| GET | `/api/courses/:documentId/students-progress` | Course owners only. |

### Quizzes

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST/PUT/DELETE | `/api/quizzes`, `/api/questions` | Authors only. `question.find`/`findOne` are granted to nobody. |
| GET | `/api/quizzes/:documentId/take` | **Never includes `correctIndex`.** |
| POST | `/api/quizzes/:documentId/submit` | Graded on the server. |
| GET | `/api/quizzes/:documentId/my-results` | The caller's own attempts. |
| GET | `/api/quiz-results/mine` | |
| GET | `/api/courses/:documentId/quiz-results` | Course owners only. |

### Blog

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/blog-posts`, `/api/blog-posts/:documentId` | **Public.** The controller forces `postStatus: 'published'` for anyone who is not an Admin or Content Manager, whatever the client's query says. A draft answers 404, not 403. |
| POST/PUT/DELETE | `/api/blog-posts` | Admin and Content Manager. |

### Admin panel

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin-panel/users` | Whitelisted fields only. |
| GET | `/api/admin-panel/roles` | |
| PUT | `/api/admin-panel/users/:id/role` | `:id` is the numeric user id — users-permissions users have no `documentId`. |
| GET | `/api/admin-panel/stats` | |

`plugin::users-permissions.user.create/update/destroy` are granted to **nobody**. The
plugin's user update accepts a `role` field, so any write on users would be a
privilege-escalation path. Role changes enter the system through one door only.

---

## Completed features

Against the project spec:

**Core**

- Authentication and role-based access — register, login, refresh, logout, four roles,
  enforced server-side by permissions plus route policies.
- Course management — create / edit / delete, platform-wide for Admin and Content
  Manager, own-only for Instructor.
- Lessons under each course — ordered, with text or a video URL.
- Course enrolment, and "My Courses" for the student.
- Lesson viewing in sequence, gated on enrolment.

**Differentiators**

- Progress tracking — one row per completed lesson, percentage computed on read
  (`courseProgress`), never stored, so it cannot drift when a lesson is added.
- Quiz with auto-grading — MCQ quizzes; the correct answer is never sent to a student
  before grading; the score is computed on the server from the quiz's own questions and
  stored with the per-question verdict; every attempt is kept and re-viewable.
- Admin panel — every user with role assignment, plus platform statistics.
- Blog — draft/published, public read of published posts only, full control for Admin
  and Content Manager.

## Deliberately not built

- **Un-enrolling from a course.** Enrolment carries progress and quiz results; deciding
  what happens to those deserved more time than the deadline allowed.
- **User deletion in the admin panel.** The spec asks to "remove a user's role", not to
  remove the user. Deleting one raises the same cascade question as above.
- **Password reset.** Needs an email provider, which is outside the spec.
- **Rich text in blog posts.** Bodies are plain text with line breaks preserved. Any
  HTML renderer here would be a real XSS surface, because the refresh token is readable
  by JavaScript.
- **File uploads for images.** The spec says a cover image URL is fine.

---

## Commands

```bash
npm run develop     # dev server with autoReload; admin at /admin
npm run start       # run without autoReload
npm run build       # build the admin panel
npm run console     # a REPL against the running app
```

There is no test suite; verification for this project was done with `curl` against a
running server, and the checks are listed per feature in the project notes.
