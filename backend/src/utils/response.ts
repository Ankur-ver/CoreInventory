// src/utils/response.ts
import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, data });

export const sendError = (res: Response, message: string, status = 400, errors?: unknown) =>
  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });

// src/utils/prisma.ts  (appended below — kept in same file for convenience)
