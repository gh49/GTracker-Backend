import { Request, Response } from "express";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";
import { GString } from "../utils/stringUtils";
import emojiRegex from "emoji-regex";

/** treat "one visible char" like Postgres char_length() = 1 */
const isSingleEmoji = (v: unknown): v is string => {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  const regex = emojiRegex(); // matches full emoji sequences
  const matches = [...s.matchAll(regex)];
  return matches.length === 1 && matches[0]![0] === s;
};

/** POST /api/category */
export const addCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category_name, category_emoji } = req.body ?? {};

    if (
      typeof category_name !== "string" ||
      category_name.trim().length === 0
    ) {
      return res.status(400).json({ message: "category_name is required" });
    }

    let emoji: string | null = null;
    if (category_emoji !== undefined && category_emoji !== null) {
      if (!isSingleEmoji(category_emoji)) {
        return res
          .status(400)
          .json({ message: "category_emoji must be a single emoji" });
      }
      emoji = category_emoji.trim();
    }

    const q = `
      INSERT INTO categories (user_id, category_name, category_emoji)
      VALUES ($1, $2, $3)
      RETURNING category_id, user_id, category_name, category_emoji, created_at
    `;
    const { rows } = await pool.query(q, [userId, category_name.trim(), emoji]);
    return res.status(201).json({ category: rows[0] });
  } catch (e: any) {
    // unique(category_name) -> 23505
    if (e?.code === "23505") {
      return res.status(409).json({ message: "Category name already exists" });
    }
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};

/** PATCH /api/category/:category_id (creator-only) */
export const editCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category_id } = req.params;
    const { category_name, category_emoji } = req.body ?? {};

    if (!category_id || !GString.isUuid(category_id)) {
      return res
        .status(400)
        .json({ message: "category_id must be a valid UUID" });
    }

    const set: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (category_name !== undefined) {
      if (
        typeof category_name !== "string" ||
        category_name.trim().length === 0
      ) {
        return res
          .status(400)
          .json({ message: "category_name must be a non-empty string" });
      }
      params.push(category_name.trim());
      set.push(`category_name = $${i++}`);
    }

    if (category_emoji !== undefined) {
      if (category_emoji === null) {
        set.push(`category_emoji = NULL`);
      } else {
        if (!isSingleEmoji(category_emoji)) {
          return res
            .status(400)
            .json({ message: "category_emoji must be a single emoji" });
        }
        params.push(category_emoji.trim());
        set.push(`category_emoji = $${i++}`);
      }
    }

    if (set.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Only the creator can edit
    params.push(category_id, userId);
    const q = `
      UPDATE categories
      SET ${set.join(", ")}
      WHERE category_id = $${i++} AND user_id = $${i}
      RETURNING category_id, user_id, category_name, category_emoji, created_at
    `;
    const { rows } = await pool.query(q, params);

    if (rows.length === 0) {
      // Either not found, or not owned by this user
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json({ category: rows[0] });
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ message: "Category name already exists" });
    }
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};

/** DELETE /api/category/:category_id (creator-only) */
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category_id } = req.params;

    if (!category_id || !GString.isUuid(category_id)) {
      return res
        .status(400)
        .json({ message: "category_id must be a valid UUID" });
    }

    const q = `
      DELETE FROM categories
      WHERE category_id = $1 AND user_id = $2
      RETURNING category_id, user_id, category_name, category_emoji, created_at
    `;
    const { rows } = await pool.query(q, [category_id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Note: tasks pointing to this category will be handled by your FK rule
    return res.json({ deleted: rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const q = `
      SELECT
        category_id,
        user_id,
        category_name,
        category_emoji,
        created_at
      FROM categories
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(q);
    return res.json({ categories: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};
