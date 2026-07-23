/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AssignmentSchema = {
    id: number;
    assignmentTitle: string;
    assignmentDescription: (string | null);
    deadline: string;
    assignment_instructions: (Array<string> | null);
    assignment_type: string;
    status: number;
    is_peer_review_matching_complete: boolean;
    review_deadline: string;
    reviews_per_student: number;
    release_date: string;
};

