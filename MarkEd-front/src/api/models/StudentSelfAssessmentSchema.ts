/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SAChecklistAnswerSchema } from './SAChecklistAnswerSchema';
import type { SAReflectionAnswerSchema } from './SAReflectionAnswerSchema';
import type { SARubricAnswerSchema } from './SARubricAnswerSchema';
export type StudentSelfAssessmentSchema = {
    submission_id: number;
    student_id: number;
    userNumber: string;
    userName: string;
    submitted_at: string;
    is_late: boolean;
    checklist: Array<SAChecklistAnswerSchema>;
    rubric: Array<SARubricAnswerSchema>;
    rubric_total: number;
    reflections: Array<SAReflectionAnswerSchema>;
    feedback_text?: string;
};

