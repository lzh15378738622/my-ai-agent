import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./database.js";
import routes from "./routes.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// 初始化数据库
initDb();
console.log("数据库初始化完成");

// 中间件
app.use(cors());
app.use(express.json());

// API 路由
app.use("/api", routes);

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
