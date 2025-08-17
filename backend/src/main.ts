import express, { Request, Response } from 'express';
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (req: Request, res: Response) => {
    res.send("Dalada работает!");
});

const PORT = process.env.PORT || 5000;

app.listen(process.env.PORT, () =>{
    console.log(`Сервер запущен на http://localhost:${PORT}`);
})