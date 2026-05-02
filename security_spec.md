# Security Specification: Lumina LMS

## 1. Data Invariants

1.  **Identity Lock**: A user's email and role are immutable once registered.
2.  **Course Ownership**: Only 'admin' users can create courses.
3.  **Relational Integrity**: A Lesson or Activity cannot exist without a parent Course.
4.  **Temporal Integrity**: Students cannot submit an activity before `start_time` or after `end_time`.
5.  **Score Integrity**: Student scores for auto-evaluated MCQs must match the correct answers stored in the questions.
6.  **Admin Protection**: Only admins can grade assignments or delete courses.
7.  **Privacy**: Student submissions are only readable by the student who submitted it and the admins/instructors.

## 2. The Dirty Dozen Payloads

1.  **Identity Spoofing**: Attempt to create a user profile with `role: 'admin'` as a student.
2.  **Shadow Update**: Update a course's `instructorId` to gain control of it.
3.  **Time Shortcut**: Submit a quiz answer after the `end_time` has passed.
4.  **Resource Poisoning**: Create a course with a 1MB string as the `title`.
5.  **Role Escalation**: Update own user profile to change `role` from 'student' to 'admin'.
6.  **Orphaned Lesson**: Create a lesson with a non-existent `courseId`.
7.  **Submission Scraping**: Authenticated student attempts to list all submissions in the system.
8.  **Score Overwrite**: Student submits a quiz result while providing their own `score: 100`.
9.  **ID Injection**: Create a document with an ID containing malicious symbols like "../admin".
10. **Ghost Enrollment**: Enroll a user in a course without creating an Enrollment document (bypassing rules).
11. **Future Submission**: Submit an activity before the `start_time`.
12. **Content Injection**: Inject XSS payload into a lesson's `videoUrl`.

## 3. Test Runner (Draft Rules First)
*(Tests will be implemented in `firestore.rules.test.ts` after rules are drafted)*
