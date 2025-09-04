import express from "express";
import { requireAuth } from "../middleware/auth";
import {
  addCategory,
  deleteCategory,
  editCategory,
  getAllCategories,
} from "../controllers/categoryController";

const router = express.Router();

router.get("/", getAllCategories);
router.post("/", requireAuth, addCategory);
router.patch("/:category_id", requireAuth, editCategory);
router.delete("/:category_id", requireAuth, deleteCategory);

export default router;
