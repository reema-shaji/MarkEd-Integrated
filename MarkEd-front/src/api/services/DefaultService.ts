/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActionResponse } from '../models/ActionResponse';
import type { AddMembersRequest } from '../models/AddMembersRequest';
import type { AllSubmissionSchema } from '../models/AllSubmissionSchema';
import type { AssignmentSchema } from '../models/AssignmentSchema';
import type { AssignmentStatistics } from '../models/AssignmentStatistics';
import type { AutoAssignRequest } from '../models/AutoAssignRequest';
import type { ChangePasswordIn } from '../models/ChangePasswordIn';
import type { ChecklistItemRequest } from '../models/ChecklistItemRequest';
import type { ChecklistItemSchema } from '../models/ChecklistItemSchema';
import type { CommentCreate } from '../models/CommentCreate';
import type { CourseSchema } from '../models/CourseSchema';
import type { CreationResponse } from '../models/CreationResponse';
import type { DismissedLLMFeedbackResponse } from '../models/DismissedLLMFeedbackResponse';
import type { DismissLLMFeedbackRequest } from '../models/DismissLLMFeedbackRequest';
import type { FileAccessResponse } from '../models/FileAccessResponse';
import type { FileUploadResponse } from '../models/FileUploadResponse';
import type { GroupCreateRequest } from '../models/GroupCreateRequest';
import type { GroupResultSchema } from '../models/GroupResultSchema';
import type { GroupSchema } from '../models/GroupSchema';
import type { GroupSetCreateRequest } from '../models/GroupSetCreateRequest';
import type { GroupSetSchema } from '../models/GroupSetSchema';
import type { GroupSetUpdateRequest } from '../models/GroupSetUpdateRequest';
import type { GroupSubmissionSchema } from '../models/GroupSubmissionSchema';
import type { GroupSubmitRequest } from '../models/GroupSubmitRequest';
import type { GroupUpdateRequest } from '../models/GroupUpdateRequest';
import type { LoginIn } from '../models/LoginIn';
import type { MarkerCommentUpdate } from '../models/MarkerCommentUpdate';
import type { MessageOut } from '../models/MessageOut';
import type { MoveMemberRequest } from '../models/MoveMemberRequest';
import type { MyGroupResultSchema } from '../models/MyGroupResultSchema';
import type { PeerAssignmentCreationResponse } from '../models/PeerAssignmentCreationResponse';
import type { PeerAssignmentRequest } from '../models/PeerAssignmentRequest';
import type { PeerMatch } from '../models/PeerMatch';
import type { PeerReviewCommentAction } from '../models/PeerReviewCommentAction';
import type { PeerReviewCommentSchema } from '../models/PeerReviewCommentSchema';
import type { PeerReviewCompletion } from '../models/PeerReviewCompletion';
import type { PeerReviewSchema } from '../models/PeerReviewSchema';
import type { PeerReviewSchemaWithStudent } from '../models/PeerReviewSchemaWithStudent';
import type { PeersLastSubmissionResponse } from '../models/PeersLastSubmissionResponse';
import type { PersonalAdjustmentSaveRequest } from '../models/PersonalAdjustmentSaveRequest';
import type { PersonalAdjustmentSchema } from '../models/PersonalAdjustmentSchema';
import type { RandomAssignRequest } from '../models/RandomAssignRequest';
import type { ReflectionPromptSchema } from '../models/ReflectionPromptSchema';
import type { ReflectionPromptsSaveRequest } from '../models/ReflectionPromptsSaveRequest';
import type { RubricSelectionSaveRequest } from '../models/RubricSelectionSaveRequest';
import type { RubricTreeNode } from '../models/RubricTreeNode';
import type { SAFeedbackRequest } from '../models/SAFeedbackRequest';
import type { SAStatusSchema } from '../models/SAStatusSchema';
import type { SelfAssessmentFormSchema } from '../models/SelfAssessmentFormSchema';
import type { SelfAssessmentSettingSchema } from '../models/SelfAssessmentSettingSchema';
import type { SelfAssessmentSettingUpdateRequest } from '../models/SelfAssessmentSettingUpdateRequest';
import type { SelfAssessmentSubmitRequest } from '../models/SelfAssessmentSubmitRequest';
import type { SelfAssessmentSubmitResponse } from '../models/SelfAssessmentSubmitResponse';
import type { StudentSelfAssessmentSchema } from '../models/StudentSelfAssessmentSchema';
import type { SubmissionRequest } from '../models/SubmissionRequest';
import type { SubmissionResponse } from '../models/SubmissionResponse';
import type { SubmissionSchema } from '../models/SubmissionSchema';
import type { TokenOut } from '../models/TokenOut';
import type { UngroupedStudentSchema } from '../models/UngroupedStudentSchema';
import type { UserSchema } from '../models/UserSchema';
import type { WorkspaceCommentCreateRequest } from '../models/WorkspaceCommentCreateRequest';
import type { WorkspaceCommentSchema } from '../models/WorkspaceCommentSchema';
import type { WorkspaceFileCreateRequest } from '../models/WorkspaceFileCreateRequest';
import type { WorkspaceFileSchema } from '../models/WorkspaceFileSchema';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health
     * @returns any OK
     * @throws ApiError
     */
    public static markEdApiRoutesHealthHealth(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health/health',
        });
    }
    /**
     * Ping
     * @returns any OK
     * @throws ApiError
     */
    public static markEdApiRoutesHealthPing(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health/ping',
        });
    }
    /**
     * Login
     * @param requestBody
     * @returns TokenOut OK
     * @throws ApiError
     */
    public static apiLogin(
        requestBody: LoginIn,
    ): CancelablePromise<TokenOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/login',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Logout
     * @returns MessageOut OK
     * @throws ApiError
     */
    public static apiLogout(): CancelablePromise<MessageOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/logout',
        });
    }
    /**
     * Change Password
     * @param requestBody
     * @returns MessageOut OK
     * @throws ApiError
     */
    public static apiChangePassword(
        requestBody: ChangePasswordIn,
    ): CancelablePromise<MessageOut> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/change-password',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Current User
     * @returns UserSchema OK
     * @throws ApiError
     */
    public static getCurrentUser(): CancelablePromise<UserSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/current-user',
        });
    }
    /**
     * Get Users Online
     * @returns UserSchema OK
     * @throws ApiError
     */
    public static getUsersOnline(): CancelablePromise<Array<UserSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/users-online',
        });
    }
    /**
     * Get Users Online Count
     * @returns number OK
     * @throws ApiError
     */
    public static getUsersOnlineCount(): CancelablePromise<number> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/users-online-count',
        });
    }
    /**
     * List My Courses
     * Courses the current user belongs to, for the sidebar course switcher.
     *
     * All three source codebases scope every view to a course; the unified
     * navigation surfaces that as an explicit switcher (Design PRD §3.1).
     * @returns CourseSchema OK
     * @throws ApiError
     */
    public static getMyCourses(): CancelablePromise<Array<CourseSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/courses/',
        });
    }
    /**
     * Get Course
     * @param courseId
     * @returns CourseSchema OK
     * @throws ApiError
     */
    public static getCourse(
        courseId: number,
    ): CancelablePromise<CourseSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/courses/{course_id}',
            path: {
                'course_id': courseId,
            },
        });
    }
    /**
     * List Assignments
     * Assignments visible to the current user, optionally scoped to a course.
     *
     * The course filter backs the sidebar's course switcher, which the unified
     * navigation treats as a context filter rather than a navigation selector
     * (Design PRD §3.1).
     * @param courseId
     * @returns AssignmentSchema OK
     * @throws ApiError
     */
    public static getAssignments(
        courseId?: number,
    ): CancelablePromise<Array<AssignmentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/',
            query: {
                'course_id': courseId,
            },
        });
    }
    /**
     * Get Assignment
     * @param assignmentId
     * @returns AssignmentSchema OK
     * @throws ApiError
     */
    public static getAssignment(
        assignmentId: number,
    ): CancelablePromise<AssignmentSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Create Peer Assignment
     * @param courseId
     * @param requestBody
     * @returns PeerAssignmentCreationResponse OK
     * @throws ApiError
     */
    public static createPeerAssignment(
        courseId: number,
        requestBody: PeerAssignmentRequest,
    ): CancelablePromise<PeerAssignmentCreationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/create-peer-assignment/{course_id}',
            path: {
                'course_id': courseId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Matched Peers
     * @param assignmentId
     * @returns PeerMatch OK
     * @throws ApiError
     */
    public static getMatchedPeers(
        assignmentId: number,
    ): CancelablePromise<Array<PeerMatch>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/matched-peers',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Trigger Peer Review Matching
     * @param assignmentId
     * @returns CreationResponse OK
     * @throws ApiError
     */
    public static triggerPeerReviewMatching(
        assignmentId: number,
    ): CancelablePromise<CreationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/trigger-peer-review-matching',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Assignment Statistics
     * @param assignmentId
     * @returns AssignmentStatistics OK
     * @throws ApiError
     */
    public static getAssignmentStatistics(
        assignmentId: number,
    ): CancelablePromise<AssignmentStatistics> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/statistics',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Peer Reviews
     * @param assignmentId
     * @returns PeerReviewSchema OK
     * @throws ApiError
     */
    public static getPeerReviews(
        assignmentId: number,
    ): CancelablePromise<Array<PeerReviewSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/reviews',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Submit Peer Review
     * @param assignmentId
     * @param submissionId
     * @returns CreationResponse OK
     * @throws ApiError
     */
    public static markEdApiRoutesPeerReviewsSubmitPeerReview(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<CreationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/submit-review',
            path: {
                'assignment_id': assignmentId,
            },
            query: {
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Create Peer Review Comment
     * @param assignmentId
     * @param submissionId
     * @param requestBody
     * @returns PeerReviewCommentSchema OK
     * @throws ApiError
     */
    public static createPeerReviewComment(
        assignmentId: number,
        submissionId: number,
        requestBody: CommentCreate,
    ): CancelablePromise<PeerReviewCommentSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Peer Review Comments
     * @param assignmentId
     * @param submissionId
     * @returns PeerReviewCommentSchema OK
     * @throws ApiError
     */
    public static getPeerReviewComments(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<Array<PeerReviewCommentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Delete Peer Review Comment
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @returns PeerReviewCommentAction OK
     * @throws ApiError
     */
    public static deletePeerReviewComment(
        assignmentId: number,
        submissionId: number,
        commentId: number,
    ): CancelablePromise<PeerReviewCommentAction> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
        });
    }
    /**
     * Update Peer Review Comment
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @param requestBody
     * @returns PeerReviewCommentAction OK
     * @throws ApiError
     */
    public static updatePeerReviewComment(
        assignmentId: number,
        submissionId: number,
        commentId: number,
        requestBody: CommentCreate,
    ): CancelablePromise<PeerReviewCommentAction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Peer Review Complete
     * @param assignmentId
     * @param submissionId
     * @returns PeerReviewCompletion OK
     * @throws ApiError
     */
    public static isPeerReviewComplete(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeerReviewCompletion> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/complete',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Complete Peer Review
     * @param assignmentId
     * @param submissionId
     * @returns PeerReviewCompletion OK
     * @throws ApiError
     */
    public static togglePeerReviewCompleteness(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeerReviewCompletion> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/completenessToggle',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Dismiss Llm Feedback
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @param requestBody
     * @returns DismissedLLMFeedbackResponse OK
     * @throws ApiError
     */
    public static dismissLlmFeedback(
        assignmentId: number,
        submissionId: number,
        commentId: number,
        requestBody: DismissLLMFeedbackRequest,
    ): CancelablePromise<DismissedLLMFeedbackResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}/dismiss-llm',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Update Marker Comment
     * @param assignmentId
     * @param submissionId
     * @param commentId
     * @param requestBody
     * @returns PeerReviewCommentAction OK
     * @throws ApiError
     */
    public static updateMarkerComment(
        assignmentId: number,
        submissionId: number,
        commentId: number,
        requestBody: MarkerCommentUpdate,
    ): CancelablePromise<PeerReviewCommentAction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/peer-reviews/{assignment_id}/{submission_id}/comments/{comment_id}/marker',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
                'comment_id': commentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Marker Allocations
     * Get peer reviews allocated to this marker
     * @param assignmentId
     * @returns PeerReviewSchemaWithStudent OK
     * @throws ApiError
     */
    public static getMarkerAllocations(
        assignmentId: number,
    ): CancelablePromise<Array<PeerReviewSchemaWithStudent>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/peer-reviews/{assignment_id}/marker-allocations',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * List Submissions
     * @returns SubmissionSchema OK
     * @throws ApiError
     */
    public static listSubmissions(): CancelablePromise<Array<SubmissionSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/',
        });
    }
    /**
     * Create Submission
     * @param requestBody
     * @returns SubmissionResponse OK
     * @throws ApiError
     */
    public static createSubmission(
        requestBody: SubmissionRequest,
    ): CancelablePromise<SubmissionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/submissions/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Submission
     * @param submissionId
     * @returns SubmissionSchema OK
     * @throws ApiError
     */
    public static getSubmission(
        submissionId: number,
    ): CancelablePromise<SubmissionSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/{submission_id}',
            path: {
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Get Last Submission
     * @param assignmentId
     * @returns SubmissionSchema OK
     * @throws ApiError
     */
    public static getLastSubmission(
        assignmentId: number,
    ): CancelablePromise<SubmissionSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/assignment/{assignment_id}/last',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Peers Last Submission
     * @param assignmentId
     * @param submissionId
     * @returns PeersLastSubmissionResponse OK
     * @throws ApiError
     */
    public static getPeersLastSubmission(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeersLastSubmissionResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/assignment/{assignment_id}/peer-review/{submission_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Get All Submissions
     * Get all submissions for an assignment, ordered by most recent first
     * @param assignmentId
     * @returns AllSubmissionSchema OK
     * @throws ApiError
     */
    public static getAllSubmissions(
        assignmentId: number,
    ): CancelablePromise<Array<AllSubmissionSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/{assignment_id}/all',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Submission For Marking
     * Get a specific submission for marking
     * @param assignmentId
     * @param submissionId
     * @returns PeersLastSubmissionResponse OK
     * @throws ApiError
     */
    public static getSubmissionForMarking(
        assignmentId: number,
        submissionId: number,
    ): CancelablePromise<PeersLastSubmissionResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/submissions/assignment/{assignment_id}/submission/{submission_id}',
            path: {
                'assignment_id': assignmentId,
                'submission_id': submissionId,
            },
        });
    }
    /**
     * Get Submission File Access Url
     * Get the presigned URL for a submission file
     * @param assignmentId
     * @param filename
     * @returns FileAccessResponse OK
     * @throws ApiError
     */
    public static getSubmissionFileAccessUrl(
        assignmentId: number,
        filename: string,
    ): CancelablePromise<FileAccessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/get-submission-file-access-url',
            query: {
                'assignment_id': assignmentId,
                'filename': filename,
            },
        });
    }
    /**
     * Get Instruction File Access Url
     * Get the presigned URL for a file
     * TODO: Check permissions of user to access the file. They need to be enrolled in the course and the assingment must be open
     * @param assignmentId
     * @param filename
     * @returns FileAccessResponse OK
     * @throws ApiError
     */
    public static getInstructionFileAccessUrl(
        assignmentId: number,
        filename: string,
    ): CancelablePromise<FileAccessResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/get-instruction-file-access-url',
            query: {
                'assignment_id': assignmentId,
                'filename': filename,
            },
        });
    }
    /**
     * Get Upload Url
     * @param filename
     * @param type
     * @param contentType
     * @returns FileUploadResponse OK
     * @throws ApiError
     */
    public static getUploadUrl(
        filename: string,
        type: 'submission' | 'instruction',
        contentType: string,
    ): CancelablePromise<FileUploadResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/files/get-upload-url',
            query: {
                'filename': filename,
                'type': type,
                'content_type': contentType,
            },
        });
    }
    /**
     * List Group Sets
     * @param courseId
     * @returns GroupSetSchema OK
     * @throws ApiError
     */
    public static listGroupSets(
        courseId: number,
    ): CancelablePromise<Array<GroupSetSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/courses/{course_id}/groupsets',
            path: {
                'course_id': courseId,
            },
        });
    }
    /**
     * Create Group Set
     * @param courseId
     * @param requestBody
     * @returns GroupSetSchema OK
     * @throws ApiError
     */
    public static createGroupSet(
        courseId: number,
        requestBody: GroupSetCreateRequest,
    ): CancelablePromise<GroupSetSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/courses/{course_id}/groupsets',
            path: {
                'course_id': courseId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Random Assign Students
     * Randomly assign ungrouped students into NEW groups.
     *
     * Ported from Hao's random_assign_students (teacher/views.py:5458). Shuffles
     * the ungrouped students and then either splits them across a fixed number of
     * groups, or chunks them into groups of a fixed size.
     * @param courseId
     * @param requestBody
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static randomAssignStudents(
        courseId: number,
        requestBody: RandomAssignRequest,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/courses/{course_id}/random-assign',
            path: {
                'course_id': courseId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Auto Assign Ungrouped
     * Fill existing groups that still have capacity; create new ones if needed.
     *
     * Ported from Hao's auto_assign_ungrouped_students (teacher/views.py:5589).
     * Unlike random assign, this reuses groups that already exist and only
     * creates a new group once every existing group is full.
     * @param courseId
     * @param requestBody
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static autoAssignUngrouped(
        courseId: number,
        requestBody: AutoAssignRequest,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/courses/{course_id}/auto-assign-ungrouped',
            path: {
                'course_id': courseId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Group Set
     * @param groupSetId
     * @returns GroupSetSchema OK
     * @throws ApiError
     */
    public static getGroupSet(
        groupSetId: number,
    ): CancelablePromise<GroupSetSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groupsets/{group_set_id}',
            path: {
                'group_set_id': groupSetId,
            },
        });
    }
    /**
     * Update Group Set
     * @param groupSetId
     * @param requestBody
     * @returns GroupSetSchema OK
     * @throws ApiError
     */
    public static updateGroupSet(
        groupSetId: number,
        requestBody: GroupSetUpdateRequest,
    ): CancelablePromise<GroupSetSchema> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/groupsets/{group_set_id}',
            path: {
                'group_set_id': groupSetId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete Group Set
     * @param groupSetId
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static deleteGroupSet(
        groupSetId: number,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/groupsets/{group_set_id}',
            path: {
                'group_set_id': groupSetId,
            },
        });
    }
    /**
     * List Groups
     * @param groupSetId
     * @returns GroupSchema OK
     * @throws ApiError
     */
    public static listGroups(
        groupSetId: number,
    ): CancelablePromise<Array<GroupSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groupsets/{group_set_id}/groups',
            path: {
                'group_set_id': groupSetId,
            },
        });
    }
    /**
     * Create Group
     * @param groupSetId
     * @param requestBody
     * @returns GroupSchema OK
     * @throws ApiError
     */
    public static createGroup(
        groupSetId: number,
        requestBody: GroupCreateRequest,
    ): CancelablePromise<GroupSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groupsets/{group_set_id}/groups',
            path: {
                'group_set_id': groupSetId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List Ungrouped Students
     * @param groupSetId
     * @returns UngroupedStudentSchema OK
     * @throws ApiError
     */
    public static listUngroupedStudents(
        groupSetId: number,
    ): CancelablePromise<Array<UngroupedStudentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groupsets/{group_set_id}/ungrouped-students',
            path: {
                'group_set_id': groupSetId,
            },
        });
    }
    /**
     * Add Group Members
     * @param groupId
     * @param requestBody
     * @returns GroupSchema OK
     * @throws ApiError
     */
    public static addGroupMembers(
        groupId: number,
        requestBody: AddMembersRequest,
    ): CancelablePromise<GroupSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/{group_id}/members',
            path: {
                'group_id': groupId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Remove Group Member
     * @param groupId
     * @param studentId
     * @returns GroupSchema OK
     * @throws ApiError
     */
    public static removeGroupMember(
        groupId: number,
        studentId: number,
    ): CancelablePromise<GroupSchema> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/groups/{group_id}/members/{student_id}',
            path: {
                'group_id': groupId,
                'student_id': studentId,
            },
        });
    }
    /**
     * Move Group Member
     * Backs the drag-and-drop interface (Hao GM-4).
     *
     * Moving a student to `target_group_id=null` returns them to the unassigned
     * pool. Hao's jQuery UI sortable posted the same intent.
     * @param groupSetId
     * @param requestBody
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static moveGroupMember(
        groupSetId: number,
        requestBody: MoveMemberRequest,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/move-member',
            query: {
                'group_set_id': groupSetId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List My Groups
     * @returns GroupSchema OK
     * @throws ApiError
     */
    public static listMyGroups(): CancelablePromise<Array<GroupSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/my-groups',
        });
    }
    /**
     * Join Group
     * Student self-enrolment — only when the group set allows it (Hao GM-7).
     * @param groupId
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static joinGroup(
        groupId: number,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/{group_id}/join',
            path: {
                'group_id': groupId,
            },
        });
    }
    /**
     * Leave Group
     * @param groupId
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static leaveGroup(
        groupId: number,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/{group_id}/leave',
            path: {
                'group_id': groupId,
            },
        });
    }
    /**
     * List Workspace Files
     * @param groupId
     * @param assignmentId
     * @returns WorkspaceFileSchema OK
     * @throws ApiError
     */
    public static listWorkspaceFiles(
        groupId: number,
        assignmentId: number,
    ): CancelablePromise<Array<WorkspaceFileSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/{group_id}/workspace-files',
            path: {
                'group_id': groupId,
            },
            query: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Upload Workspace File
     * @param groupId
     * @param requestBody
     * @returns WorkspaceFileSchema OK
     * @throws ApiError
     */
    public static uploadWorkspaceFile(
        groupId: number,
        requestBody: WorkspaceFileCreateRequest,
    ): CancelablePromise<WorkspaceFileSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/{group_id}/workspace-files',
            path: {
                'group_id': groupId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete Workspace File
     * @param fileId
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static deleteWorkspaceFile(
        fileId: number,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/groups/workspace-files/{file_id}',
            path: {
                'file_id': fileId,
            },
        });
    }
    /**
     * Add Workspace Comment
     * @param fileId
     * @param requestBody
     * @returns WorkspaceCommentSchema OK
     * @throws ApiError
     */
    public static addWorkspaceComment(
        fileId: number,
        requestBody: WorkspaceCommentCreateRequest,
    ): CancelablePromise<WorkspaceCommentSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/workspace-files/{file_id}/comments',
            path: {
                'file_id': fileId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Submit Group Assignment
     * Confirm the group's submission.
     *
     * Hao's two-step flow: files are uploaded to the workspace first, then a
     * member confirms one as the group's submission. Each confirmation creates a
     * new immutable row, giving the version history his evaluation praised.
     * @param groupId
     * @param requestBody
     * @returns GroupSubmissionSchema OK
     * @throws ApiError
     */
    public static submitGroupAssignment(
        groupId: number,
        requestBody: GroupSubmitRequest,
    ): CancelablePromise<GroupSubmissionSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/{group_id}/submit',
            path: {
                'group_id': groupId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List Group Submissions
     * Latest submission per group for an assignment.
     * @param assignmentId
     * @returns GroupSubmissionSchema OK
     * @throws ApiError
     */
    public static listGroupSubmissions(
        assignmentId: number,
    ): CancelablePromise<Array<GroupSubmissionSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/submissions/{assignment_id}',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Personal Adjustments
     * @param groupSubmissionId
     * @returns PersonalAdjustmentSchema OK
     * @throws ApiError
     */
    public static getPersonalAdjustments(
        groupSubmissionId: number,
    ): CancelablePromise<Array<PersonalAdjustmentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/group-submissions/{group_submission_id}/personal-adjustment',
            path: {
                'group_submission_id': groupSubmissionId,
            },
        });
    }
    /**
     * Save Personal Adjustments
     * Save every member's adjustment at once, as Hao's form did.
     * @param groupSubmissionId
     * @param requestBody
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static savePersonalAdjustments(
        groupSubmissionId: number,
        requestBody: PersonalAdjustmentSaveRequest,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/groups/group-submissions/{group_submission_id}/personal-adjustment',
            path: {
                'group_submission_id': groupSubmissionId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get My Group Result
     * Transparent breakdown for the student: base + adjustment = final.
     * @param groupSubmissionId
     * @returns GroupResultSchema OK
     * @throws ApiError
     */
    public static getMyGroupResult(
        groupSubmissionId: number,
    ): CancelablePromise<GroupResultSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/group-submissions/{group_submission_id}/my-result',
            path: {
                'group_submission_id': groupSubmissionId,
            },
        });
    }
    /**
     * Get My Group Result By Assignment
     * Resolve the student's group and its latest submission for an assignment.
     *
     * Students never see raw group-submission ids, so this looks up their group,
     * finds its most recent submission, and returns the base+adjustment breakdown.
     * @param assignmentId
     * @returns MyGroupResultSchema OK
     * @throws ApiError
     */
    public static getMyGroupResultByAssignment(
        assignmentId: number,
    ): CancelablePromise<MyGroupResultSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/groups/my-group-result/{assignment_id}',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Update Group
     * @param groupId
     * @param requestBody
     * @returns GroupSchema OK
     * @throws ApiError
     */
    public static updateGroup(
        groupId: number,
        requestBody: GroupUpdateRequest,
    ): CancelablePromise<GroupSchema> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/groups/{group_id}',
            path: {
                'group_id': groupId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete Group
     * @param groupId
     * @returns ActionResponse OK
     * @throws ApiError
     */
    public static deleteGroup(
        groupId: number,
    ): CancelablePromise<ActionResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/groups/{group_id}',
            path: {
                'group_id': groupId,
            },
        });
    }
    /**
     * Get Settings
     * @param assignmentId
     * @returns SelfAssessmentSettingSchema OK
     * @throws ApiError
     */
    public static getSelfAssessmentSettings(
        assignmentId: number,
    ): CancelablePromise<SelfAssessmentSettingSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/settings',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Update Settings
     * @param assignmentId
     * @param requestBody
     * @returns SelfAssessmentSettingSchema OK
     * @throws ApiError
     */
    public static updateSelfAssessmentSettings(
        assignmentId: number,
        requestBody: SelfAssessmentSettingUpdateRequest,
    ): CancelablePromise<SelfAssessmentSettingSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/self-assessment/settings',
            path: {
                'assignment_id': assignmentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List Checklist Items
     * @param assignmentId
     * @returns ChecklistItemSchema OK
     * @throws ApiError
     */
    public static listChecklistItems(
        assignmentId: number,
    ): CancelablePromise<Array<ChecklistItemSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/checklist',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Add Checklist Item
     * @param assignmentId
     * @param requestBody
     * @returns ChecklistItemSchema OK
     * @throws ApiError
     */
    public static addChecklistItem(
        assignmentId: number,
        requestBody: ChecklistItemRequest,
    ): CancelablePromise<ChecklistItemSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/self-assessment/checklist',
            path: {
                'assignment_id': assignmentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Reflection Prompts
     * @param assignmentId
     * @returns ReflectionPromptSchema OK
     * @throws ApiError
     */
    public static getReflectionPrompts(
        assignmentId: number,
    ): CancelablePromise<Array<ReflectionPromptSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/reflections',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Save Reflection Prompts
     * @param assignmentId
     * @param requestBody
     * @returns ReflectionPromptSchema OK
     * @throws ApiError
     */
    public static saveReflectionPrompts(
        assignmentId: number,
        requestBody: ReflectionPromptsSaveRequest,
    ): CancelablePromise<Array<ReflectionPromptSchema>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/self-assessment/reflections',
            path: {
                'assignment_id': assignmentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Rubric Tree
     * Criteria hierarchy with current selections.
     *
     * Replaces Mingyue's build_rubric_json (which emitted jsTree's node format)
     * with a plain nested structure; the React checkbox tree renders the same
     * hierarchy and selection state.
     * @param assignmentId
     * @returns RubricTreeNode OK
     * @throws ApiError
     */
    public static getRubricTree(
        assignmentId: number,
    ): CancelablePromise<Array<RubricTreeNode>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/rubric-tree',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Save Rubric Selection
     * @param assignmentId
     * @param requestBody
     * @returns any OK
     * @throws ApiError
     */
    public static saveRubricSelection(
        assignmentId: number,
        requestBody: RubricSelectionSaveRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/self-assessment/rubric-selection',
            path: {
                'assignment_id': assignmentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Self Assessment Form
     * @param assignmentId
     * @returns SelfAssessmentFormSchema OK
     * @throws ApiError
     */
    public static getSelfAssessmentForm(
        assignmentId: number,
    ): CancelablePromise<SelfAssessmentFormSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/form',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Submit Self Assessment
     * Record a self-assessment.
     *
     * Mingyue deliberately allowed repeat submissions and displayed the latest,
     * so this creates a new row rather than updating in place.
     * @param assignmentId
     * @param requestBody
     * @returns SelfAssessmentSubmitResponse OK
     * @throws ApiError
     */
    public static submitSelfAssessment(
        assignmentId: number,
        requestBody: SelfAssessmentSubmitRequest,
    ): CancelablePromise<SelfAssessmentSubmitResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/assignments/{assignment_id}/self-assessment/submit',
            path: {
                'assignment_id': assignmentId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get Self Assessment Status
     * Badge for the student's assignment card (Mingyue SA-10).
     * @param assignmentId
     * @returns SAStatusSchema OK
     * @throws ApiError
     */
    public static getSelfAssessmentStatus(
        assignmentId: number,
    ): CancelablePromise<SAStatusSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/status',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Get Student Self Assessment
     * @param assignmentId
     * @param studentId
     * @returns StudentSelfAssessmentSchema OK
     * @throws ApiError
     */
    public static getStudentSelfAssessment(
        assignmentId: number,
        studentId: number,
    ): CancelablePromise<StudentSelfAssessmentSchema> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/student/{student_id}',
            path: {
                'assignment_id': assignmentId,
                'student_id': studentId,
            },
        });
    }
    /**
     * List Self Assessment Submissions
     * Latest self-assessment per student, for the marker's overview.
     * @param assignmentId
     * @returns StudentSelfAssessmentSchema OK
     * @throws ApiError
     */
    public static listSelfAssessmentSubmissions(
        assignmentId: number,
    ): CancelablePromise<Array<StudentSelfAssessmentSchema>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/assignments/{assignment_id}/self-assessment/submissions',
            path: {
                'assignment_id': assignmentId,
            },
        });
    }
    /**
     * Edit Checklist Item
     * @param itemId
     * @param requestBody
     * @returns ChecklistItemSchema OK
     * @throws ApiError
     */
    public static editChecklistItem(
        itemId: number,
        requestBody: ChecklistItemRequest,
    ): CancelablePromise<ChecklistItemSchema> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/self-assessment/checklist/{item_id}',
            path: {
                'item_id': itemId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete Checklist Item
     * @param itemId
     * @returns any OK
     * @throws ApiError
     */
    public static deleteChecklistItem(
        itemId: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/self-assessment/checklist/{item_id}',
            path: {
                'item_id': itemId,
            },
        });
    }
    /**
     * Save Self Assessment Feedback
     * Teacher feedback on a self-assessment — a single text box, as Mingyue built it.
     * @param submissionId
     * @param requestBody
     * @returns StudentSelfAssessmentSchema OK
     * @throws ApiError
     */
    public static saveSelfAssessmentFeedback(
        submissionId: number,
        requestBody: SAFeedbackRequest,
    ): CancelablePromise<StudentSelfAssessmentSchema> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/self-assessment/submissions/{submission_id}/feedback',
            path: {
                'submission_id': submissionId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
