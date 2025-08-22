import express, { Request, Response } from 'express';
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import passport from 'passport';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/auth", authRoutes);
app.get("/", (req: Request, res: Response) => {
    res.send("Dalada работает!");
});

const PORT = process.env.PORT || 5000;

app.listen(process.env.PORT, () =>{
    console.log(`Сервер запущен на http://localhost:${PORT}`);
})