/**
 * Shared type definitions for the Kaam Ki Baat app.
 */

/** Lightweight team member reference used in task creation. */
export interface TeamMember {
  user_id: string;
  name: string;
}

/** Extended team member with submission stats, used in admin dashboard. */
export interface TeamMemberWithStats extends TeamMember {
  role: string;
  submission_count: number;
}

/** Full team membership record with profile info, used in team management. */
export interface TeamMembership {
  id: string;
  user_id: string;
  role: 'captain' | 'vice_captain' | 'member';
  status: 'active' | 'inactive';
  profiles: {
    name: string;
    phone: string | null;
  };
}
