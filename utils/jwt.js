import jwt from "jsonwebtoken";

export function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET);
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
