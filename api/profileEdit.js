// routes/profile.js
import express from "express";
import supabaseAdmin from "../lib/supabase.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.put("/:userid", authMiddleware, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!userid) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // 🔒 Allow ONLY these fields
    const { firstname, lastname, gender, dob, mobile_number, address } =
      req.body;

    const updates = {
      firstname,
      lastname,
      gender,
      dob,
      mobile_number,
      address,
    };

    // Remove undefined fields (important)
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("userid", userid)
      .select("*")
      .single();

    if (error || !data) {
      return res
        .status(400)
        .json({ message: error?.message || "Update failed" });
    }

    // 🔒 Never expose password
    delete data.password;

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
