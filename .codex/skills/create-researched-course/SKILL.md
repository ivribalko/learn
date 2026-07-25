---
name: create-researched-course
description: Research and author original, complete self-paced online courses from current public evidence through an outline-approval and chapter-by-chapter workflow. Use when Codex is asked to create, design, expand, refresh, or compare a course or curriculum and must study reputable course descriptions, syllabi, standards, documentation, and reviews; infer common topic coverage and sequencing without copying proprietary content; identify gaps or outdated material; and deliver objectives, chapters, fully written lessons, examples, exercises, knowledge checks, a final project and rubric, prerequisites, tools, common mistakes, citations, and a source-linked coverage comparison.
---

# Create Researched Course

Build an original course from evidence about what reputable courses teach, how the subject logically develops, and what current offerings miss. Develop it through the mandatory approval gates below until the complete course exists.

## Read the required references

Before researching or authoring, read these files completely:

- [research-method.md](references/research-method.md) for source selection, evidence capture, curriculum synthesis, currency checks, and originality safeguards.
- [course-deliverable.md](references/course-deliverable.md) for the complete course contract, lesson schema, final project, rubric, and source-linked coverage comparison.

## Inspect the destination

- Read applicable repository instructions and existing course schemas before creating files.
- Honor the requested platform and output format.
- When targeting Learn, inspect the active course checkout, its `registry.py`, representative course packages, runner definitions, and authored-file conventions. Keep functional application code course-agnostic.
- When no format is specified, use the portable Markdown structure in `course-deliverable.md`.
- Preserve unrelated work and do not commit or publish unless explicitly asked.

## Frame the course

- Establish the topic, learner profile, prerequisites, target outcomes, depth, expected duration, tools, and delivery constraints.
- Infer reasonable defaults when missing and state them in the deliverable. Ask only when a missing choice would materially change the course.
- Define observable terminal capabilities before selecting chapters.
- Set a currency cutoff using the current date, especially for fast-changing tools, standards, APIs, laws, or professional practices.

## Follow the staged authoring gates

- Research and synthesize enough evidence to design the curriculum before proposing it.
- First provide only an ordered list of chapter titles and the lesson titles within each chapter.
- Do not draft chapter introductions, lesson content, exercises, assessments, projects, rubrics, research notes, or course files with the initial list.
- Stop after the list and wait for explicit user approval. Treat requested revisions as changes to the list, not as approval to begin authoring.
- After approval, author exactly one complete chapter at a time, including all lessons and chapter-level materials required by `course-deliverable.md`.
- Stop after each chapter. Do not begin, outline, scaffold, or partially write another chapter until the user explicitly approves or requests the next chapter.
- Apply requested revisions to the current chapter before moving forward.
- After the user accepts the final chapter, create any remaining course-wide artifacts required by `course-deliverable.md` as a separate finalization step.
- Never collapse these gates into a single response or batch several chapters because the user asked for a complete course.

## Research current public evidence

- Browse the web for current information on every invocation; do not rely on remembered course catalogs.
- Research reputable, popular offerings across multiple independent providers using public descriptions, syllabi, module lists, sample lessons, official documentation, standards, and credible reviews.
- Prefer official course and institutional pages for curriculum claims. Use reviews to identify pacing, clarity, missing practice, learner friction, and staleness.
- Use only lawfully public material. Do not bypass paywalls, authentication, access controls, or copy paid lesson content.
- Record source links, publication or update dates when available, access dates, provider type, public evidence, sequence position, and limitations.
- Continue until the source portfolio meets the sufficiency rules in `research-method.md`, or disclose why the topic cannot support them.

## Synthesize the curriculum

- Normalize equivalent topic names before comparing sources.
- Extract recurring concepts, prerequisite relationships, typical sequence positions, practical skills, assessments, and capstone patterns.
- Derive a consensus sequence from prerequisite logic and repeated ordering, not from any single provider.
- Separate foundational requirements, widely shared core, useful differentiators, and emerging or current material.
- Identify gaps, outdated practices, weak transitions, missing prerequisites, insufficient practice, and neglected real-world concerns.
- Keep a traceable evidence matrix linking every curriculum decision to public sources or explicit instructional reasoning.

## Protect originality

- Use sources as evidence about coverage and ordering, never as prose or exercise templates.
- Write all titles, explanations, examples, scenarios, exercises, checks, projects, and rubric language from scratch.
- Do not preserve a provider's distinctive taxonomy, branded framework, mnemonic, module titles, narrative, datasets, examples, assessment prompts, or proprietary sequence wholesale.
- Generalize consensus concepts into an independent structure and choose original contexts, data, constraints, and progression.
- Quote only when necessary, keep quotations short, label them, and cite the exact public source.
- If a phrase or activity feels recognizable as belonging to one course, replace it with an independently designed alternative.

## Design and author the approved course progressively

- Use backward design from the terminal capabilities to chapter and lesson objectives.
- Make each lesson depend only on stated prerequisites and prepare learners for later work.
- Within the current approved chapter, fully write every lesson according to `course-deliverable.md`; do not leave placeholders such as “add example,” “research this,” or “write exercise.”
- Build original exercises that progress from guided practice to independent application.
- Include answer keys or solution guidance, expected outputs, and knowledge-check rationales suitable for self-paced learning.
- Use current, runnable, and internally consistent examples. Keep tools and versions aligned across prerequisites, lessons, and projects.
- Culminate in an original final project that integrates the stated outcomes and can be scored with the supplied rubric.

## Verify before delivery

- Verify the initial list contains only chapters and their lesson titles.
- Verify each authored chapter against the applicable parts of the completion checklist in `course-deliverable.md`.
- After finalization, check every requested component against the full completion checklist.
- Confirm objectives, explanations, examples, exercises, checks, project criteria, and rubric rows align.
- Verify links and time-sensitive claims against primary or authoritative sources.
- Check that the course is complete, executable where applicable, free of unexplained prerequisite jumps, and clearly distinct from every researched source.
- Ensure the research and coverage comparison distinguishes sourced observations from the course author's inferences.
- Report assumptions, evidence limitations, and unresolved currency risks without weakening the deliverable.

## Deliver

- During outline approval, deliver only the chapter and lesson list.
- During chapter authoring, save and deliver only the current chapter in the requested destination and format.
- During finalization, add the source-linked research and coverage comparison and any remaining course-wide artifacts.
- When the course is complete, summarize the learner, duration, chapter and lesson counts, final project, target path, validation performed, and any remaining limitations.
