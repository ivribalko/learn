# Complete Course Deliverable Contract

The completed output must be a usable self-paced course, not a syllabus alone. Build it progressively through the outline approval, single-chapter authoring, and finalization gates in `SKILL.md`. Adapt the storage format to the target platform while preserving every required section below by completion.

## Default portable structure

When the user does not specify a platform, create:

```text
course/
├── COURSE.md
├── RESEARCH-COVERAGE.md
├── chapters/
│   ├── chapter-foundations/
│   │   ├── README.md
│   │   └── lesson-topic.md
│   └── chapter-application/
│       ├── README.md
│       └── lesson-topic.md
└── final-project/
    ├── PROJECT.md
    └── RUBRIC.md
```

Use descriptive slugs rather than the example names. Add solution files or runnable assets only when the subject and target platform need them.

## Course overview

Include:

- Original course title and concise description
- Intended learner and use case
- Prerequisites with self-check guidance
- Terminal learning objectives written as observable capabilities
- Estimated total effort and suggested pacing
- Required and optional tools with current versions or version policy
- Setup instructions and a way to verify the environment
- Chapter map showing progression and estimated effort
- Assessment and completion policy
- Final project summary
- Guidance for using explanations, examples, exercises, solutions, and checks independently

## Chapter contract

Each chapter must include:

- Original title and purpose
- Prerequisite chapters or skills
- Chapter objectives
- Lesson sequence with rationale
- Estimated effort
- Deliverable or milestone
- Connection to the final project
- Chapter completion criteria

Sequence chapters and lessons by dependency and cognitive load. Introduce vocabulary and tools before requiring them.

## Lesson contract

Fully author every lesson with:

- Original title and estimated effort
- Lesson purpose and prerequisite knowledge
- Two to five observable objectives
- Clear explanations of every new concept
- At least one original worked example for each major skill
- A hands-on exercise with setup, task, constraints, expected result, and completion criteria
- Progressive hints that do not reveal the answer immediately
- A solution or answer key with reasoning
- A knowledge check with answers and explanations
- Common mistakes, symptoms, causes, and corrections
- A concise recap and explicit bridge to the next lesson

Use more examples and practice when the concept is difficult or error-prone. Do not pad a simple lesson to satisfy a count.

## Explanation quality

- Define terms before using them.
- Explain why and when, not only what and how.
- Make assumptions and tradeoffs explicit.
- Distinguish rules from heuristics.
- Include failure cases and debugging paths.
- Use current factual and technical claims, linked to authoritative sources where appropriate.
- Keep examples consistent with the declared environment and prior lessons.

## Hands-on exercise quality

Exercises must be original and independently executable:

- State the learner's goal and starting state.
- Provide or generate legally reusable inputs.
- Specify constraints that reinforce the lesson objectives.
- Define observable expected behavior without prescribing every step.
- Include a self-check, test command, checklist, or comparison method.
- Offer staged hints.
- Supply a worked solution or reference result after the learner attempt.
- Explain why the solution works and note reasonable alternatives.

Progress from constrained practice to integration and independent decisions. Never adapt a researched provider's exercise by superficial renaming.

## Knowledge checks

Each lesson must include enough checks to cover its objectives. Use a useful mix of:

- Concept questions
- Prediction or tracing questions
- Error diagnosis
- Scenario-based choices
- Short construction or explanation prompts

Provide the correct answer and a rationale for every option or expected response. Avoid trivia that does not support a course objective.

## Common mistakes

For each lesson, describe the mistakes most likely to block self-paced learners:

| Mistake | Observable symptom | Likely cause | Correction |
| --- | --- | --- | --- |
| Original mistake description | What the learner sees | Underlying misconception or action | Concrete recovery step |

Include tool, setup, conceptual, and judgment mistakes as relevant.

## Final project

Create an original project that integrates the terminal capabilities:

- Scenario and learner role
- Authentic problem and intended audience
- Required deliverables
- Functional and quality requirements
- Constraints and provided assets
- Milestones mapped to chapters
- Verification or demonstration procedure
- Submission checklist
- Optional extensions that deepen rather than replace core requirements
- Solution outline or evaluator notes suitable for self-paced use

Do not require untaught skills. The project should permit meaningful learner choices while remaining objectively assessable.

## Rubric

Use a criteria-based rubric with four performance levels. Include:

- Correctness or factual quality
- Application of core concepts
- Reasoning and tradeoff quality
- Robustness, testing, or verification
- Clarity and organization
- Domain-specific professional practices

For every criterion, describe observable evidence at each level. Assign weights totaling 100 percent and define the completion threshold. Avoid vague labels without behavioral descriptions.

## Research and coverage comparison

Create `RESEARCH-COVERAGE.md` or an equivalent platform section containing direct source links and these sections:

- Research scope, assumptions, date, and currency cutoff
- Source portfolio and reputation signals
- Public-evidence limitations
- Shared curriculum matrix
- Sequence comparison
- Gaps and outdated content
- Course coverage rationale
- Originality statement
- Sources

Use a source portfolio table:

| Source | Provider type | Public evidence used | Currency | Reputation signal | Limitations |
| --- | --- | --- | --- | --- | --- |
| [Linked title](https://example.com/exact-page) | Institution, platform, standards body, vendor, or review venue | Syllabus, modules, outcomes, documentation, or review | Visible date or access date | Concise evidence | Concise caveat |

Use a coverage matrix with neutral topic names:

| Normalized topic | Source coverage | Typical position | Identified issue | Course response |
| --- | --- | --- | --- | --- |
| Independent concept label | Linked source abbreviations or count | Foundation, early, middle, advanced, or capstone | Gap, staleness, divergence, or none | Module and lesson that address it |

Use a sequence comparison:

| Curriculum decision | Shared pattern | Important divergence | Adopted sequence and rationale |
| --- | --- | --- | --- |
| Original chapter or transition | Source-linked summary | Source-linked alternative | Independent decision based on prerequisites and learner outcomes |

State clearly that public curricula informed topic coverage and ordering, while all authored prose, examples, exercises, checks, projects, and rubric language are original.

## Completion checklist

Before delivery, confirm:

- Every terminal objective maps to lessons, practice, assessment, and final-project criteria.
- Every chapter and lesson contains all required fields.
- Explanations and examples are fully written.
- Exercises have expected results, hints, completion criteria, and solutions.
- Knowledge checks include answers and rationales.
- Common mistakes include recovery guidance.
- The final project integrates the course without requiring untaught skills.
- Rubric weights total 100 percent and use observable performance descriptions.
- Tools, versions, commands, terminology, and examples are internally consistent.
- Time-sensitive claims and links are verified.
- Research findings and instructional inferences are distinguishable.
- Coverage and sequence claims link to exact public sources.
- No proprietary prose, exercise, branded framework, or single-source sequence has been copied.
- No placeholders or unfinished sections remain.
- Platform validation or available content checks pass.
