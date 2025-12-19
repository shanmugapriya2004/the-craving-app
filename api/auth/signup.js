import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import supabaseAdmin from "../../lib/supabase.js";
import { generateToken } from "../../utils/jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password, firstname, lastname } = req.body;

  if (!email || !password || !firstname || !lastname) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("userid")
    .eq("email", email)
    .single();

  if (existingUser) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const userid = uuidv4();
  const profilename =
    firstname.charAt(0).toUpperCase() + lastname.charAt(0).toUpperCase();

  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabaseAdmin.from("users").insert({
    userid,
    firstname,
    lastname,
    profilename,
    email,
    password: hashedPassword,
    profile_image: null,
    is_active: false,
    gender: null,
    dob: null,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const token = generateToken({ userid, email });

  return res.status(201).json({
    message: "Signup successful",
    token,
    userid,
  });
}
