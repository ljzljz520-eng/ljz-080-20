# Project Structure

This project contains a React frontend and a NestJS backend, managed as a monorepo.

## Tech Stack

- **Frontend**: React 18+, TypeScript, Vite, React Router v6, antd (PC), antd-mobile (H5), LESS.
- **Backend**: Node.js 20+, NestJS, TypeScript, Supabase (Postgres).
- **Database**: Supabase Postgres (Dockerized).

## Project Structure

```
apps/
  client/          # React Frontend Application
  server/          # NestJS Backend Application
```

## How to Run

```bash
docker compose up
```

## Services

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Database: localhost:5432

## Verification

1. **Frontend**: Open http://localhost:3000 in your browser. You should see the React application running.
2. **Backend**: Open http://localhost:8000 in your browser. You should see the NestJS "Hello World" message.
3. **Database**: You can connect to the database using a Postgres client at `localhost:5432` with user `postgres` and password `password`.
