import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { userId?: string; role?: string };
}

interface JwtPayload {
  userId?: string;
  role?: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log("Auth middleware called");
  const token = req.headers.authorization?.split(" ")[1];
  console.log("Token:", token);

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: "Нет токена, авторизация отклонена" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    console.log("Decoded token:", decoded);

    (req as AuthRequest).user = { 
      userId: decoded.userId, 
      role: decoded.role 
    };
    
    console.log("User set to:", (req as AuthRequest).user);
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ message: "Неверный или истёкший токен" });
  }
};