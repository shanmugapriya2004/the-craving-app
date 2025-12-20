// routes/dishes.js
import express from "express";
import supabaseAdmin from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/dishes
 * Protected route
 */
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("dishes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
