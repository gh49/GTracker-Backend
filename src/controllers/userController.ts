import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db";
import { GString } from "../utils/stringUtils";
import { PublicUserData, UserData, UserLoginRequestBody } from "./types";

export const signup = async (req: Request, res: Response) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request is missing the body" });
  }
  const { email, username, fullName, password }: UserLoginRequestBody =
    req.body;

  if (!email || !username || !fullName || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const emailString: string = email.trim().toLowerCase();
  const usernameString: string = username.trim().toLowerCase();
  const fullNameString: string = fullName.trim();
  const passwordString: string = password;

  try {
    // Check validity of data
    if (!GString.isValidEmail(emailString)) {
      return res.status(400).json({ message: "Email not valid" });
    } else if (!GString.isAlphaNumeric(usernameString)) {
      return res.status(400).json({ message: "Username not valid" });
    } else if (!GString.isValidFullName(fullNameString)) {
      return res.status(400).json({ message: "Full name not valid" });
    } else if (!GString.isValidPassword(passwordString)) {
      return res.status(400).json({ message: "Password not valid" });
    }

    // Check if email or username exists
    const existing = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [emailString, usernameString]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.email === emailString) {
        return res.status(400).json({
          message:
            "Email already registered. If you forgot your password, good luck lol",
        });
      } else {
        return res.status(400).json({
          message: "Username already taken. Please try a different one.",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(passwordString, 10);

    const result = await pool.query(
      `INSERT INTO users (email, username, full_name, password_hash, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING user_id, email, username, full_name`,
      [emailString, usernameString, fullNameString, hashedPassword]
    );

    const user: PublicUserData = result.rows[0];

    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { identifier, password } = req.body; // 'identifier' can be email or username

  if (!identifier || !password) {
    return res.status(400).json({ message: "Missing identifier or password" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $1",
      [identifier]
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid username/email or password." });
    }

    const user: UserData = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res
        .status(400)
        .json({ message: "Invalid username/email or password." });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not defined");

    const token = jwt.sign({ userId: user.user_id }, secret);

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, userData: userWithoutPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
