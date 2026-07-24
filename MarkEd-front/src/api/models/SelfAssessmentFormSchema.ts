/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChecklistItemSchema } from './ChecklistItemSchema';
import type { ReflectionPromptSchema } from './ReflectionPromptSchema';
import type { RubricItemSchema } from './RubricItemSchema';
export type SelfAssessmentFormSchema = {
    assignment_id: number;
    enabled: boolean;
    deadline?: (string | null);
    is_late?: boolean;
    use_checklist: boolean;
    checklist_items: Array<ChecklistItemSchema>;
    use_reflection: boolean;
    reflection_prompts: Array<ReflectionPromptSchema>;
    use_rubric: boolean;
    rubric_items: Array<RubricItemSchema>;
    checklist_answers: Record<string, boolean>;
    rubric_answers: Record<string, number>;
    reflection_answers: Record<string, string>;
    feedback_text?: string;
    submitted_at?: (string | null);
};

