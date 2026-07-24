/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Unified create form (Design PRD): an INDIVIDUAL or GROUP assignment with
 * peer review and self-assessment as independent configuration toggles.
 */
export type AssignmentCreateRequest = {
    title: string;
    description?: (string | null);
    deadline: string;
    assignmentWebsite?: (string | null);
    assignment_type: string;
    group_set_id?: (number | null);
    min_group_size?: (number | null);
    max_group_size?: (number | null);
    peer_review_enabled?: boolean;
    reviews_per_student?: (number | null);
    review_deadline?: (string | null);
    self_assessment_enabled?: boolean;
    self_assessment_deadline?: (string | null);
};

