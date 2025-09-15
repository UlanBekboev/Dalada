import { Request, Response, NextFunction } from "express";

export const validateRequest = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter(f => !(f in req.body));
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`
      });
    }
    next();
  };
};
