# CampusCart Backend — Phase 1 (Setup + Auth)

This is the first phase of the backend: project setup, database schema, and
authentication (register, login, get/update profile, avatar upload). It's
built to match your frontend's `AuthContext.jsx` exactly — no frontend
changes needed once this is running.

## 1. Install PostgreSQL (if you don't have it locally)

Easiest options:
- Install Postgres.app (Mac) or the official installer (Windows)
- Or skip local Postgres entirely and create a free database on
  [Render](https://render.com) right away — then point `DATABASE_URL` at that.

## 2. Set up environment variables

Copy `.env.example` to `.env` and fill in:

```
cp .env.example .env
```

- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — any long random string (e.g. run `openssl rand -hex 32`)
- `CORS_ORIGIN` — your frontend's URL, e.g. `http://localhost:5173`

## 3. Install dependencies

```
npm install
```

## 4. Create the database tables

```
npm run migrate
```

This runs `sql/schema.sql` against your database — creates all tables and
seeds the starter categories.

## 5. Run the server

```
npm run dev
```

You should see `CampusCart API running on http://localhost:5000`.
Visit `http://localhost:5000/api/health` — you should get `{"status":"ok"}`.

## 6. Point your frontend at it

In your frontend's `.env` (create one from `.env.example` if you have it),
make sure:

```
VITE_API_URL=http://localhost:5000/api
```

Restart your frontend dev server after adding this.

## 7. Test it

With both servers running, register a new account on your site — it should
now create a real user in Postgres instead of falling back to the mock
localStorage user. Try the profile drawer too — editing your bio/WhatsApp/
location and uploading an avatar should now persist for real.

## What's included in this phase

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/me/avatar`

## Coming in later phases

- Products & categories (`/api/products`, `/api/categories`)
- Reviews (`/api/reviews/seller/:id`)
- Messages/conversations (`/api/messages`, `/api/messages/:userId`)

## Deploying to Render later

- Create a **PostgreSQL** instance on Render, copy its Internal Connection
  String into `DATABASE_URL`, and set `DB_SSL=true`.
- Create a **Web Service** pointing at this backend folder, build command
  `npm install`, start command `npm start`.
- Set the same environment variables (`DATABASE_URL`, `JWT_SECRET`,
  `CORS_ORIGIN`, `DB_SSL=true`) in Render's dashboard.
- Heads up: Render's free-tier disk is not persistent — avatar/product
  images uploaded via multer will be lost on redeploy. Fine for testing now;
  swap to Cloudinary or S3 before you rely on this for real users.
