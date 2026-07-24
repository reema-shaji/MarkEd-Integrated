/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A student's own status for an assignment (prototype Assignment Detail).
 */
export type MyAssignmentStatusSchema = {
    assignment_id: number;
    group_id?: (number | null);
    group_name?: (string | null);
    submitted?: boolean;
    submitted_at?: (string | null);
    is_late?: boolean;
};

