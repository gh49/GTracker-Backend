import express from "express";
import { requireAuth } from "../middleware/auth";
import {
  addTask,
  deleteTask,
  editTask,
  getAllUserTasks,
} from "../controllers/taskController";

const router = express.Router();

router.get("/", requireAuth, getAllUserTasks);
router.post("/", requireAuth, addTask);
router.patch("/:task_id", requireAuth, editTask);
router.delete("/:task_id", requireAuth, deleteTask);

export default router;
