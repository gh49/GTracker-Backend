export interface UserData {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  password_hash: string;
  created_at: string;
}

export interface PublicUserData {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  created_at: string;
}

export interface UserLoginRequestBody {
  email: string;
  username: string;
  fullName: string;
  password: string;
}
