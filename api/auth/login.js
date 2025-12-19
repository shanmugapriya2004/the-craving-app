import bcrypt from "bcryptjs";
import supabaseAdmin from "../../lib/supabase.js";
import { generateToken } from "../../utils/jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  await supabaseAdmin
    .from("users")
    .update({ is_active: true })
    .eq("userid", user.userid);

  const token = generateToken({
    userid: user.userid,
    email: user.email,
  });

  return res.status(200).json({
    message: "Login successful",
    token,
  });
}
