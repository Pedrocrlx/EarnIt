# Database Schema DBML

This DBML matches the current SQLModel table models in `backend/src/models`.

Key differences from the previous diagram:

- Primary keys and foreign keys are `uuid`, not `bigserial`/`bigint`.
- `users.full_name` is actually `users.family_name`.
- `users.point_value_eur` and `users.email_verified_at` are present in code.
- `goals.child_id` is not unique; a child can have many goals.
- `goals.status` exists, `goals.target_amount` is nullable `integer`, and `goals.image_url`/`updated_at` are not in the model.
- `tasks.is_active` was removed by migration and is not in the current model.
- `task_submissions.task_id` is nullable with `ON DELETE SET NULL`.
- `task_submissions` has `task_title`, `scheduled_date`, and `proof_url`; it does not have `photo_url`.
- The invalid column-to-column refs at the end of the old diagram were removed.

```dbml
Table users {
  id uuid [pk]
  email varchar(320) [not null, unique]
  password_hash varchar(255) [not null]
  parent_pin_hash varchar(255)
  pin_set_at timestamptz
  family_name varchar(150)
  point_value_eur numeric(10,4) [not null, default: 0.01]
  is_active boolean [not null, default: true]
  onboarding_completed boolean [not null, default: false]
  email_verified_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table children {
  id uuid [pk]
  user_id uuid [not null]
  name varchar(100) [not null]
  birth_date date
  avatar_url varchar
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table goals {
  id uuid [pk]
  child_id uuid [not null]
  name varchar(120) [not null]
  status varchar(20) [not null, default: 'requested', note: 'requested | approved | rejected | redeemed']
  target_amount integer
  created_at timestamptz [not null]
}

Table tasks {
  id uuid [pk]
  user_id uuid [not null]
  child_id uuid [not null]
  title varchar(150) [not null]
  description varchar
  task_type varchar(20) [not null, note: 'duty | extra_task']
  reward_amount numeric(10,2) [not null, default: 0]
  expires_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table task_submissions {
  id uuid [pk]
  task_id uuid
  task_title varchar(150)
  child_id uuid [not null]
  scheduled_date date
  submitted_at timestamptz
  status varchar(20) [not null, default: 'pending', note: 'pending | approved | rejected']
  reviewed_at timestamptz
  rejection_note varchar
  proof_url varchar

  indexes {
    (task_id, scheduled_date) [unique, name: 'uq_task_submissions_task_date']
  }
}

Table wallet_transactions {
  id uuid [pk]
  child_id uuid [not null]
  task_submission_id uuid
  amount numeric(10,2) [not null]
  transaction_type varchar(20) [not null, note: 'credit | debit']
  description varchar
  created_at timestamptz [not null]
}

Ref: children.user_id > users.id [delete: cascade]
Ref: goals.child_id > children.id [delete: cascade]
Ref: tasks.user_id > users.id [delete: cascade]
Ref: tasks.child_id > children.id [delete: cascade]
Ref: task_submissions.task_id > tasks.id [delete: set null]
Ref: task_submissions.child_id > children.id [delete: cascade]
Ref: wallet_transactions.child_id > children.id [delete: cascade]
Ref: wallet_transactions.task_submission_id > task_submissions.id [delete: set null]
```
