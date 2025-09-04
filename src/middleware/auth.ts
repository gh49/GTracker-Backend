import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token)
      return res.status(401).json({ message: "Missing Bearer token" });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not defined");

    // You signed with { userId: user.user_id } earlier
    const payload = jwt.verify(token, secret) as {
      userId?: string;
      sub?: string;
    };
    const userId = payload.userId || payload.sub;
    if (!userId) return res.status(401).json({ message: "Invalid token" });

    req.userId = userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
