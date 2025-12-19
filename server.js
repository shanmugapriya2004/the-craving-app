import express from "express";
import cors from "cors";

/* Import existing API handlers */
import signupHandler from "./api/auth/signup.js";
import loginHandler from "./api/auth/login.js";

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   ROUTES (same as Vercel)
========================= */
app.post("/api/auth/signup", signupHandler);
app.post("/api/auth/login", loginHandler);

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Local server running on http://localhost:${PORT}`);
});
