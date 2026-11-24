// `npm run db:migrate -w @ascend/api`
import { migrate } from "./migrate.js";
import { pool } from "./pool.js";

migrate()
  .then(() => console.log("Database is up to date"))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
