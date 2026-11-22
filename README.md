# Ascend

Personal productivity SaaS.

## Structure

```
apps/
  api/      Express + TypeScript (port 4000)
  web/      React + Vite + TypeScript (port 5173, proxies /api -> 4000)
packages/
  shared/   Types & logic shared by api, web (and mobile later)
```

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev
```
