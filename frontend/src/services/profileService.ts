import { apiFetch } from "@/lib/api";

export type CreateChildPayload = {
  avatar_url: string | null;
  birth_date: string | null;
  name: string;
};

export type ChildProfileResponse = {
  avatar_url: string | null;
  birth_date: string | null;
  id: string;
  is_active: boolean;
  name: string;
  user_id: string;
};

export const createChild = (payload: CreateChildPayload) =>
  apiFetch<ChildProfileResponse>("/profiles/children", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const uploadChildAvatar = (childId: string, avatar: File) => {
  const formData = new FormData();
  formData.append("avatar", avatar);

  return apiFetch<{ status: string; id: string; avatar_url: string }>(
    `/profiles/children/${childId}/avatar`,
    {
      method: "POST",
      body: formData,
    },
  );
};

export const updateChildBirthDate = (
  childId: string,
  birthDate: string | null,
) =>
  apiFetch<{ status: string; id: string; birth_date: string | null }>(
    `/profiles/children/${childId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ birth_date: birthDate }),
    },
  );

export const updateFamilyName = (familyName: string) =>
  apiFetch("/profiles/family-name", {
    method: "PATCH",
    body: JSON.stringify({ family_name: familyName }),
  });

// The conversion rate is euros-per-point (e.g. 0.01 = 1 point worth €0.01).
export type PointValueResponse = { point_value_eur: string };

export const getPointValue = () =>
  apiFetch<PointValueResponse>("/profiles/point-value");

export const setPointValue = (pointValueEur: string) =>
  apiFetch<{ status: string; point_value_eur: string }>("/profiles/point-value", {
    method: "PATCH",
    body: JSON.stringify({ point_value_eur: pointValueEur }),
  });
