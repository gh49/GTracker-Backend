import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes";
import taskRoutes from "./routes/tasksRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/categories", categoriesRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SEVER LISTENING ON PORT ${PORT}`);
});
