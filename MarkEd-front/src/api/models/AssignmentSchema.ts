/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AssignmentSchema = {
    id: number;
    course_id: number;
    assignmentTitle: string;
    assignmentDescription?: (string | null);
    assignmentWebsite?: (string | null);
    deadline: string;
    assignment_instructions?: (Array<string> | null);
    assignment_type: string;
    status: number;
    group_set_id?: (number | null);
    max_group_size?: (number | null);
    min_group_size?: (number | null);
    peer_review_enabled?: boolean;
    is_peer_review_matching_complete?: boolean;
    review_deadline?: (string | null);
    reviews_per_student?: (number | null);
    release_date?: (string | null);
    self_assessment_enabled?: boolean;
    self_assessment_deadline?: (string | null);
};

