import { buildApp } from "./_core/app";
import { serveStatic } from "./_core/static";

const app = buildApp();
serveStatic(app);

// Vercel serverless entry — Express app as the default handler
export default app;
