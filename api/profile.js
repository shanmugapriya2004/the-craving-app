// routes/profile.js
import express from "express";
import supabaseAdmin from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/profile/:userid
 * Protected route (JWT required)
 */
router.get("/:userid", authMiddleware, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!userid) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*") // 👈 all fields
      .eq("userid", userid)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔒 Never expose password
    delete data.password;

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
