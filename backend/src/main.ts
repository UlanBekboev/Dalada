import express, { Request, Response } from 'express';
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import passport from 'passport';
import uploadFileRoutes from './routes/uploadFileRoutes.js';
import vacancyRoutes from './routes/vacancyRoutes.js';
import chatRoutes from './routes/chatRouts.js';
import favorites from './routes/favorites.js'
import { createServer } from 'http';
import { initSocketIO } from './sockets/socketHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';
import openApiDoc from '../openapi.json' with { type: 'json' };
import swaggerUi from "swagger-ui-express";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Инициализация Socket.io
initSocketIO(server);

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Обслуживание статических файлов
app.use('/uploads/employer-logos', express.static(path.join(__dirname, 'uploads/employer-logos')));
app.use('/uploads/candidate-photos', express.static(path.join(__dirname, 'uploads/candidate-photos')));
app.use('/uploads/chat-files', express.static(path.join(__dirname, 'uploads/chat-files')));
app.use('/uploads/resumes', express.static(path.join(__dirname, 'uploads/resumes')));

app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", uploadFileRoutes);
app.use("/api", vacancyRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api", favorites)
app.get("/api", (req: Request, res: Response) => {
    res.send("Dalada работает!");
});

// Swagger UI доступен по /api-docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));

const PORT = process.env.PORT || 5000;

app.listen(process.env.PORT, () =>{
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log("📑 Swagger docs: http://localhost:5000/api-docs");
})