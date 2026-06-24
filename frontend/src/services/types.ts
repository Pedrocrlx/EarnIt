export type SubmissionStatus = "pending" | "approved" | "rejected" | string;

export type TaskType = "duty" | "extra_task";

export type TaskResponse = {
  child_id: string;
  created_at: string;
  description: string | null;
  expires_at: string | null;
  id: string;
  is_active: boolean;
  reward_amount: string;
  task_type: TaskType | string;
  title: string;
  updated_at: string;
  user_id: string;
};

export type SubmissionResponse = {
  child_id: string;
  has_photo: boolean;
  id: string;
  rejection_note: string | null;
  reviewed_at: string | null;
  scheduled_date: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  task_id: string;
};

export type ChildTaskResponse = {
  description: string | null;
  expires_at: string | null;
  id: string;
  reward_amount: string;
  submission: SubmissionResponse | null;
  task_type: TaskType | string;
  title: string;
};

export type WalletTransaction = {
  amount_points: number;
  child_id: string;
  created_at: string;
  description: string | null;
  id: string;
  task_submission_id: string | null;
  transaction_type: string;
};

export type WalletResponse = {
  balance_points: number;
  child_id: string;
  point_value_eur: string;
  transactions: WalletTransaction[];
};

export type GoalStatus = "requested" | "approved" | "rejected" | "redeemed" | string;

export type Goal = {
  id: string;
  child_id: string;
  name: string;
  status: GoalStatus;
  target_amount: number | null;
  created_at: string;
};

export type GoalListResponse = {
  child_id: string;
  balance_points: number;
  point_value_eur: string;
  goals: Goal[];
};
