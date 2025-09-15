import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const handleUploadError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Размер файла превышает допустимый лимит' });
    }
  }
  
  if (err.message.includes('Разрешены только файлы')) {
    return res.status(400).json({ message: err.message });
  }
  
  next(err);
};