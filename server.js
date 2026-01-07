import express from "express";
import cors from "cors";

/* Import existing API handlers */
import signupHandler from "./api/auth/signup.js";
import loginHandler from "./api/auth/login.js";
import dishesRoutes from "./api/dishes.js";
import profileRoutes from "./api/profile.js";
import profileEditRoutes from "./api/profileEdit.js";
import OrderRoute from "./api/order.js";
import DashboardRoute from "./api/dashboard.js";
import CartRoute from "./api/cart.js";

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   ROUTES (same as Vercel)
========================= */
app.post("/api/auth/signup", signupHandler);
app.post("/api/auth/login", loginHandler);
app.use("/api/dishes", dishesRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/profileEdit", profileEditRoutes);
app.use("/api/order", OrderRoute);
app.use("/api/dashboard", DashboardRoute);
app.use("/api/cart", CartRoute);

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Local server running on http://localhost:${PORT}`);
});
