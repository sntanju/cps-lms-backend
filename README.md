# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## 🗄️ Database

Postgres, configured entirely through environment variables in `config/database.ts`.

For local development, point the discrete variables at a local Postgres instance
(see `.env.example`):

```
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cps_lms_database
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
```

Strapi creates and syncs the tables from the content-type schemas on first boot,
so there is no migration step to run.

## ⚙️ Deployment

The backend deploys to **Railway**, with Postgres hosted on **Neon**. Set these
variables on the Railway service:

| Variable | Value |
| --- | --- |
| `DATABASE_CLIENT` | `postgres` |
| `DATABASE_URL` | the Neon connection string |
| `FRONTEND_URLS` | the Vercel URLs, comma-separated |
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` | freshly generated secrets |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_ADMIN_NAME` | the first admin account |

Notes:

- **`DATABASE_URL` wins.** When it is set, the URL it parses to overrides
  `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` and
  `DATABASE_SSL`. Leave those unset in production so there is one source of truth.
- **Use Neon's direct endpoint**, not the one with `-pooler` in the host. Strapi is
  a long-running server with its own connection pool, so it does not need
  PgBouncer, and transaction-mode pooling can break session state.
- **Keep `?sslmode=require`** in the URL. Neon requires TLS, and its certificates
  chain to a publicly trusted CA, so verification succeeds with no extra config.
- **The `INITIAL_ADMIN_*` variables are mandatory.** `bootstrap()` seeds the four
  LMS roles and the first admin user on every boot, and throws if they are
  missing — which stops Strapi from starting at all, leaving no admin panel in
  which to fix it.

A fresh Neon database is empty; the first successful boot creates the tables,
seeds the roles and creates the admin user.

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
