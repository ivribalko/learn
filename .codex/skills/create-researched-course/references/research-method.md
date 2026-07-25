# Research and Curriculum Synthesis Method

Use this contract to research existing courses deeply enough to inform an original curriculum without reconstructing any provider's proprietary course.

## Scope record

Capture these fields before searching:

| Field | Required content |
| --- | --- |
| Topic | Specific subject and boundaries |
| Learner | Prior experience, role, and context |
| Terminal capabilities | Observable tasks learners should perform |
| Depth | Introductory, intermediate, advanced, or mixed |
| Duration | Total effort and expected pace |
| Modality | Self-paced text, code, media, lab, or mixed |
| Constraints | Platform, tools, versions, budget, licensing, or environment |
| Currency cutoff | Date through which changing material is verified |

If the request omits a field, infer a defensible default and label it as an assumption.

## Source portfolio

Aim for a portfolio broad enough to reveal consensus and disagreement:

- Target six to twelve substantive sources from at least four independent providers.
- Include multiple reputable course providers, such as accredited institutions, established learning platforms, recognized professional organizations, or authoritative vendors.
- Include at least two primary or authoritative references such as standards, official documentation, specifications, or institutional syllabi when the topic supports them.
- Include credible reviews or learner discussions from at least two independent venues when available.
- Prefer currently maintained offerings, while retaining an older influential source only when it explains a persistent curriculum convention.
- For a niche topic with fewer sources, use every credible public source available and state the shortfall.

Popularity is supporting evidence, not a proxy for quality. Treat enrollment counts, ratings, rankings, citations, and repeated independent recommendations as signals only when their source and date are visible.

## Search strategy

Use several query families rather than repeating one catalog search:

- `<topic> course syllabus`
- `<topic> curriculum modules`
- `<topic> university course outline`
- `<topic> certification objectives`
- `<topic> official documentation learning path`
- `<topic> course review missing outdated`
- `<topic> learner complaints exercises`
- `<topic> current standard best practices`
- `<topic> roadmap prerequisites`

Search for both broad courses and specialist courses that cover advanced, applied, ethical, operational, or current concerns. Prefer the original page over an aggregator's summary.

## Evidence capture

Record one row per source:

| Field | Capture rule |
| --- | --- |
| Source | Course or reference title linked to the exact public page |
| Provider | Organization and provider category |
| Reputation signal | Accreditation, authority, visible adoption, rating, or independent recognition |
| Evidence type | Syllabus, catalog description, module list, sample, documentation, standard, or review |
| Audience | Stated learner level and prerequisites |
| Outcomes | Publicly stated capabilities, summarized in original words |
| Topics | Normalized concepts visible in public material |
| Sequence | Relative topic order visible in public material |
| Practice | Publicly described labs, exercises, assessment, or project types at a high level |
| Currency | Publication, update, version, or retrieval date |
| Limitations | Paywall, incomplete outline, marketing-only claims, review bias, or missing date |

Do not infer private lesson contents from a marketing page. Mark absent evidence as unknown rather than treating it as absent curriculum.

## Source weighting

Weight evidence by fitness for the claim:

- Use official syllabi, module lists, standards, and documentation for curriculum coverage and sequence.
- Use independent reviews for learner experience, difficulty, pacing, support, staleness, and practice quality.
- Use provider marketing claims only when independently verifiable or clearly labeled.
- Prefer current primary sources for version-sensitive facts.
- Do not let several pages from one provider count as independent consensus.

## Curriculum normalization

- Map synonyms to a neutral concept label.
- Split compound module labels only when public descriptions show distinct concepts.
- Keep branded methods separate until their underlying general concepts can be identified.
- Record the original source label only in research notes when needed for traceability; author the course with independent labels.
- Distinguish conceptual knowledge, procedural skill, tool operation, judgment, and project integration.

## Consensus and sequence synthesis

Build a topic-by-source matrix and an ordering map:

- Count independent provider coverage for each normalized topic.
- Record the earliest relative position of each topic: foundation, early core, middle application, advanced application, or capstone.
- Extract prerequisite edges such as “A before B” when repeated or logically required.
- Resolve disagreements through prerequisite logic, learner level, and target outcomes.
- Classify topics as:
  - Foundation when required to understand later material.
  - Shared core when present across a majority of suitable independent courses.
  - Applied core when needed to perform the target capabilities.
  - Differentiator when valuable but not broadly shared.
  - Current addition when newer evidence, standards, or practice makes it important.
- Create an original chapter sequence from the resulting prerequisite graph. Do not mirror the full sequence of any single source.

For each proposed chapter, record:

| Decision | Evidence |
| --- | --- |
| Why included | Source consensus, prerequisite need, target capability, or identified gap |
| Why positioned here | Prerequisite edges and learner progression |
| What is original | Independent framing, examples, exercises, and integration |
| Currency basis | Current authoritative source or explicit stability rationale |

## Gap and staleness analysis

Check course offerings against current authoritative practice and learner needs:

- Deprecated tools, APIs, syntax, standards, terminology, or workflows
- Missing setup, prerequisites, or conceptual bridges
- Too much passive explanation and too little hands-on practice
- Toy examples without realistic constraints, debugging, tradeoffs, or failure handling
- Missing accessibility, privacy, safety, ethics, security, maintenance, or operational concerns when relevant
- Missing assessment feedback, solutions, or criteria for self-paced learners
- Abrupt progression or capstones that require untaught skills
- Overemphasis on one vendor or ecosystem where transferable concepts matter
- Review reports of unclear pacing, stale screenshots, broken tooling, shallow projects, or missing advanced material

Support a gap claim with a current authoritative reference, repeated independent review evidence, or explicit instructional reasoning. Label inference as inference.

## Originality boundary

Allowed synthesis:

- Concepts commonly taught across independent sources
- General prerequisite relationships and broad progression patterns
- Public standards, specifications, facts, and documented practices
- High-level observations about common assessment forms

Do not reuse:

- Proprietary lesson prose or close paraphrases
- Distinctive module titles or a branded taxonomy
- Provider-specific mnemonics, stories, diagrams, datasets, or examples
- Exercise instructions, quiz questions, projects, solutions, or rubrics
- A single provider's complete module sequence with renamed headings

Create independent examples and activities from the target learner's context. Change the scenario, inputs, constraints, artifacts, and success criteria rather than merely changing names.

## Research outputs

The research and coverage comparison must include:

- Scope and assumptions
- Source portfolio with direct links and reputation rationale
- Normalized curriculum matrix
- Cross-source sequence comparison
- Consensus findings
- Divergences and how they were resolved
- Gaps and outdated content
- Course coverage decisions with evidence
- Originality statement
- Currency risks and evidence limitations

Place citations beside the claims they support. Link to exact pages, not search results or provider homepages. Include an access date for pages without visible publication or update dates.
