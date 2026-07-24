/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupMarkingCriterion } from './GroupMarkingCriterion';
export type GroupMarkingSchema = {
    group_submission_id: number;
    group_name: string;
    criteria: Array<GroupMarkingCriterion>;
    group_score: number;
    group_total: number;
    finalised?: boolean;
};

