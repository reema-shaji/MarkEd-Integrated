/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AssignmentStatistics = {
    total_submissions: number;
    unique_submitters: number;
    active_users_24h: number;
    total_peer_reviews: number;
    peer_review_stats: Record<string, number>;
    average_reviews_per_student: number;
    completion_rate: number;
    enrolled_students?: number;
    expected_submissions?: number;
    submission_on_time?: number;
    submission_late?: number;
    submission_missing?: number;
    self_assessment_enabled?: boolean;
    self_assessment_submitted?: number;
    grade_distribution?: Record<string, number>;
};

