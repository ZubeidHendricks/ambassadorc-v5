import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../lib/jwt";

export interface AuthRequest extends Request {
  ambassador?: JwtPayload;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Authentication required. Provide a Bearer token.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Authentication token is missing.",
      });
      return;
    }

    const payload = verifyToken(token);
    req.ambassador = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token.",
    });
  }
}
