import { Response } from "express";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";
import { GString } from "../utils/stringUtils";

// --- helpers ----------------------------------------------------
const DOW_ALIAS: Record<
  string,
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
> = {
  sun: "sun",
  sunday: "sun",
  mon: "mon",
  monday: "mon",
  tue: "tue",
  tues: "tue",
  tuesday: "tue",
  wed: "wed",
  weds: "wed",
  wednesday: "wed",
  thu: "thu",
  thur: "thu",
  thurs: "thu",
  thursday: "thu",
  fri: "fri",
  friday: "fri",
  sat: "sat",
  saturday: "sat",
};
const DOW_FROM_INDEX: Array<
  "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"
> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const normalizeDow = (
  s: unknown
): "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | null => {
  if (typeof s !== "string") return null;
  const key = s.trim().toLowerCase();
  return DOW_ALIAS[key] ?? null;
};

// strict YYYY-MM-DD validator that also gives you the UTC date parts
const parseISODateYMD = (
  v: unknown
): { y: number; m: number; d: number } | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return { y, m, d };
};

// --- controller -------------------------------------------------
/**
 * POST /api/task/progress
 * Body: { task_id: UUID, completed_count: int >= 0, date: "YYYY-MM-DD" }
 * - Upsert by (task_id, date)
 * - Validate: ownership, date format, weekday allowed by task.days_of_week, completed_count <= target_count
 */
export const addTaskProgress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { task_id, completed_count, date } = req.body ?? {};

    // task_id
    if (!GString.isUuid(task_id)) {
      return res.status(400).json({ message: "task_id must be a valid UUID" });
    }

    // date
    const ymd = parseISODateYMD(date);
    if (!ymd) {
      return res.status(400).json({ message: 'date must be "YYYY-MM-DD"' });
    }
    const { y, m, d } = ymd;
    const dtUTC = new Date(Date.UTC(y, m - 1, d));
    const dowFromDate = DOW_FROM_INDEX[dtUTC.getUTCDay()]; // "sun".."sat"

    // completed_count
    const cc = Number(completed_count);
    if (!(Number.isInteger(cc) && cc >= 0)) {
      return res
        .status(400)
        .json({ message: "completed_count must be a non-negative integer" });
    }

    // fetch task (ownership + constraints we need)
    const t = await pool.query(
      "SELECT user_id, target_count, days_of_week FROM user_tasks WHERE task_id = $1",
      [task_id]
    );
    if (t.rowCount === 0)
      return res.status(404).json({ message: "Task not found" });
    if (t.rows[0].user_id !== userId)
      return res.status(403).json({ message: "Not allowed for this task" });

    const target = Number(t.rows[0].target_count);
    if (cc > target) {
      return res.status(400).json({
        message: `completed_count (${cc}) cannot exceed target_count (${target})`,
      });
    }

    // ensure date's weekday is in task.days_of_week
    const allowedArray: unknown[] = t.rows[0].days_of_week ?? [];
    const allowedSet = new Set(
      (Array.isArray(allowedArray) ? allowedArray : [])
        .map((s) => normalizeDow(s))
        .filter((v): v is NonNullable<typeof v> => !!v)
    );
    if (!allowedSet.has(dowFromDate)) {
      // turn allowed set into display like ["Mon","Wed","Fri"]
      const display = [...allowedSet]
        .map(
          (k) =>
            ({
              sun: "Sun",
              mon: "Mon",
              tue: "Tue",
              wed: "Wed",
              thu: "Thu",
              fri: "Fri",
              sat: "Sat",
            }[k])
        )
        .join(", ");
      return res.status(400).json({
        message: `Date ${date} is a ${
          dowFromDate[0].toUpperCase() + dowFromDate.slice(1)
        }, which is not allowed for this task. Allowed: [${display}]`,
      });
    }

    // UPSERT: try update first
    const upd = await pool.query(
      `
      UPDATE task_progress
      SET completed_count = $3
      WHERE task_id = $1 AND date = $2
      RETURNING progress_id, task_id, date, completed_count
      `,
      [task_id, date, cc]
    );

    if (upd.rowCount !== null && upd.rowCount > 0) {
      return res.json({ progress: upd.rows[0], status: "updated" });
    }

    // else insert
    const ins = await pool.query(
      `
      INSERT INTO task_progress (task_id, date, completed_count)
      VALUES ($1, $2, $3)
      RETURNING progress_id, task_id, date, completed_count
      `,
      [task_id, date, cc]
    );
    return res.status(201).json({ progress: ins.rows[0], status: "created" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/tasks/by-date?date=YYYY-MM-DD
 * Protected. Returns all tasks for the user scheduled on that weekday,
 * with category info and the completed_count for that exact date (0 if none).
 */
export const getTasksByDate = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const dateStr = String(req.query.date ?? "");

    const ymd = parseISODateYMD(dateStr);
    if (!ymd) {
      return res.status(400).json({ message: 'date must be "YYYY-MM-DD"' });
    }

    // Compute weekday (UTC) as mon/tue/... key
    const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d));
    const dowKey = DOW_FROM_INDEX[dt.getUTCDay()]; // "sun".."sat"
    const dow3 = dowKey.slice(0, 3); // "sun".."sat"

    // Fetch tasks that include this weekday.
    // We accept stored day strings like "Mon", "Monday", "mon", etc.
    // Matching rule: lower(left(day, 3)) == dow3
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
        c.category_emoji,
        COALESCE(p.completed_count, 0) AS completed_count
      FROM user_tasks t
      LEFT JOIN categories c
        ON c.category_id = t.category_id
      LEFT JOIN task_progress p
        ON p.task_id = t.task_id
       AND p.date = $1::date
      WHERE t.user_id = $2
        AND EXISTS (
          SELECT 1
          FROM unnest(t.days_of_week) AS d(day)
          WHERE lower(left(d, 3)) = $3
        )
      ORDER BY t.created_at DESC
    `;

    const { rows } = await pool.query(q, [dateStr, userId, dow3]);
    return res.json({ date: dateStr, tasks: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
};
