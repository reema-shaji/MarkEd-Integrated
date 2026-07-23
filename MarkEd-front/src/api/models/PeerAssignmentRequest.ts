/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PeerAssignmentRequest = {
    course_id: string;
    title: string;
    description: string;
    reviews_per_student: number;
    release_date: string;
    submission_deadline: string;
    review_deadline: string;
    instructions?: (Array<string> | null);
    max_submissions_per_student: number;
    allow_late_submissions: boolean;
    students_can_see_reviews: boolean;
    markers_can_see_reviews: boolean;
    is_anonymous: boolean;
    markers_per_submission: number;
};

