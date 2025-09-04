export interface UserData {
  user_id: string;
  email: string;
  username: string;
  full_name: string | null;
  password_hash: string;
  created_at: string;
}

export interface PublicUserData {
  user_id: string;
  email: string;
  username: string;
  full_name: string | null;
  created_at: string;
}

export interface UserSignUpRequestBody {
  email: string;
  username: string;
  fullName: string;
  password: string;
}

export interface UserLoginRequestBody {
  identifier: string;
  password: string;
}
