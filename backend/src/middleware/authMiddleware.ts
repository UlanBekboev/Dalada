import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { userId: string; role?: string };
}

interface JwtPayload {
  userId?: string;
  role?: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];

  console.log("Cookies:", req.cookies);
  console.log("Authorization header:", req.headers.authorization);
  console.log("Token from header:", token);

  if (!token) {
    return res.status(401).json({ message: "Нет токена, авторизация отклонена" });
  }
  console.log("Token:", token);
  // Логируем payload даже без проверки подписи
  const decodedRaw = jwt.decode(token) as JwtPayload | null;
  console.log("Decoded payload (без проверки подписи):", decodedRaw);

  try {
    console.log("JWT_SECRET при проверке:", `${process.env.JWT_SECRET}`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    console.log("Decoded payload (после проверки подписи):", decoded);

    const userId = decoded.userId; // иногда поле называется user_id
    (req as AuthRequest).user = { userId: userId!, role: decoded.role };

    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ message: "Неверный или истёкший токен" });
  }
};
