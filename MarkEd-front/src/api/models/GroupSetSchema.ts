/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GroupSetSchema = {
    id: number;
    course_id: number;
    name: string;
    description?: (string | null);
    max_group_size: number;
    min_group_size: number;
    allow_student_self_assignment: boolean;
    self_assignment_deadline?: (string | null);
    created_at: string;
    groups_count?: number;
    students_count?: number;
};

