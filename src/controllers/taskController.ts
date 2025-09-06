import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import pool from "../db";
import { GNumber } from "../utils/numberUtils";
import { GString } from "../utils/stringUtils";

export const getAllUserTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const q = `
      SELECT
        t.task_id,
        t.user_id,
        t.category_id,
        t.task_name,
        t.target_count,
        t.days_of_week,
        t.created_at,
        c.category_name,
        c.category_emoji
      FROM user_tasks t
      LEFT JOIN categories c ON c.category_id = t.category_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
    `;
    const { rows } = await pool.query(q, [userId]);

    return res.json({ tasks: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: `Server error: ${e}` });
  }
};

export const addTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category_id, task_name, target_count, days_of_week } =
      req.body ?? {};

    // minimal validation
    if (!task_name || typeof task_name !== "string")
      return res.status(400).json({ message: "task_name is required" });

    const tgt = Number(target_count);
    if (!GNumber.isPositiveInteger(tgt))
      return res
        .status(400)
        .json({ message: "target_count must be a positive integer" });

    if (
      !Array.isArray(days_of_week) ||
      days_of_week.length === 0 ||
      !days_of_week.every((d) => typeof d === "string")
    )
      return res
        .status(400)
        .json({ message: "days_of_week must be a non-empty string array" });

    if (category_id) {
      if (!GString.isUuid(category_id)) {
        return res
          .status(400)
          .json({ message: "category_id is not a valid uuid" });
      }
      const { rowCount } = await pool.query(
        "SELECT 1 FROM categories WHERE category_id = $1",
        [category_id]
      );
      if (rowCount === 0) {
        return res.status(400).json({ message: "category_id does not exist" });
      }
    }

    // insert task
    const q = `
      INSERT INTO user_tasks (user_id, category_id, task_name, target_count, days_of_week)
      VALUES ($1, $2, $3, $4, $5::text[])
      RETURNING task_id, user_id, category_id, task_name, target_count, days_of_week, created_at
    `;
    const params = [
      userId,
      category_id ?? null,
      task_name.trim(),
      tgt,
      days_of_week,
    ];
    const { rows } = await pool.query(q, params);

    return res.status(201).json({ task: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: `Server error: ${err}` });
  }
};

export const editTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { category_id, task_name, target_count, days_of_week } =
      req.body ?? {};
    const { task_id } = req.params;
    if (!task_id || !GString.isUuid(task_id))
      return res.status(400).json({ message: "task_id is required" });

    // Ensure the task belongs to this user
    const owned = await pool.query(
      "SELECT 1 FROM user_tasks WHERE task_id = $1 AND user_id = $2",
      [task_id, userId]
    );
    if (owned.rowCount === 0)
      return res.status(404).json({ message: "Task not found" });

    // Validate provided fields
    const set: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (category_id !== undefined) {
      if (category_id === null) {
        set.push(`category_id = NULL`);
      } else {
        if (!GString.isUuid(category_id)) {
          return res
            .status(400)
            .json({ message: "Invalid category_id for this user" });
        }
        const ok = await pool.query(
          "SELECT 1 FROM categories WHERE category_id = $1 AND user_id = $2",
          [category_id, userId]
        );
        if (ok.rowCount === 0)
          return res
            .status(400)
            .json({ message: "Invalid category_id for this user" });
        params.push(category_id);
        set.push(`category_id = $${i++}`);
      }
    }

    if (task_name !== undefined) {
      if (typeof task_name !== "string" || task_name.trim().length === 0)
        return res
          .status(400)
          .json({ message: "task_name must be a non-empty string" });
      params.push(task_name.trim());
      set.push(`task_name = $${i++}`);
    }

    if (target_count !== undefined) {
      const tgt = Number(target_count);
      if (!GNumber.isPositiveInteger(tgt))
        return res
          .status(400)
          .json({ message: "target_count must be a positive number" });
      params.push(tgt);
      set.push(`target_count = $${i++}`);
    }

    if (days_of_week !== undefined) {
      if (
        !Array.isArray(days_of_week) ||
        days_of_week.length === 0 ||
        !days_of_week.every((d) => typeof d === "string")
      )
        return res
          .status(400)
          .json({ message: "days_of_week must be a non-empty string array" });
      params.push(days_of_week);
      set.push(`days_of_week = $${i++}::text[]`);
    }

    if (set.length === 0)
      return res.status(400).json({ message: "No fields to update" });

    params.push(task_id); // final param for WHERE
    const q = `
      UPDATE user_tasks
      SET ${set.join(", ")}
      WHERE task_id = $${i}
      RETURNING task_id, user_id, category_id, task_name, target_count, days_of_week, created_at
    `;
    const { rows } = await pool.query(q, params);
    res.json({ task: rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: `Server error: ${e}` });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { task_id } = req.params;

    if (!GString.isUuid(task_id)) {
      return res.status(400).json({ message: "task_id must be a valid UUID" });
    }

    // Delete only if owned by user; return the deleted task
    const q = `
      DELETE FROM user_tasks
      WHERE task_id = $1 AND user_id = $2
      RETURNING task_id, user_id, category_id, task_name, target_count, days_of_week, created_at
    `;
    const { rows } = await pool.query(q, [task_id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    // rows[0] is the deleted task; progress removed via cascade
    return res.json({ deleted: rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: `Server error: ${e}` });
  }
};
