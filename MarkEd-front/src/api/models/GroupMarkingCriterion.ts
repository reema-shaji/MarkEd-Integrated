/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GroupMarkingLevel } from './GroupMarkingLevel';
export type GroupMarkingCriterion = {
    criteria_id: number;
    name: string;
    marks: number;
    levels: Array<GroupMarkingLevel>;
    selected_element_id?: (number | null);
    score?: (number | null);
    finalised?: boolean;
};

